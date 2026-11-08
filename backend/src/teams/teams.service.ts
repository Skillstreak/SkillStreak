import { Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  InviteCodeNotFoundException,
  TeamNameRejectedByFilterException,
} from '../common/errors/exceptions';
import type { ChatModerationCheck } from '../team-chat/chat-moderation-check.interface';
import { CHAT_MODERATION_CHECK } from '../team-chat/chat-moderation-check.interface';
import { Team } from './entities/team.entity';
import {
  generateTeamInviteCode,
  normalizeInviteCode,
} from './team-invite-code.util';

export interface CreateTeamInput {
  name: string;
}

/**
 * How many fresh codes to try before giving up. At 40 bits a collision
 * with an existing team is vanishingly unlikely; the loop exists so the
 * moderation re-roll (a random code can, rarely, spell something) has
 * somewhere to go, not because collisions are expected.
 */
const MAX_INVITE_CODE_ATTEMPTS = 8;

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @Inject(CHAT_MODERATION_CHECK)
    private readonly chatModerationCheck: ChatModerationCheck,
  ) {}

  async findByInviteCode(
    inviteCode: string,
    manager?: EntityManager,
  ): Promise<Team | null> {
    const repository = manager
      ? manager.getRepository(Team)
      : this.teamRepository;
    const normalized = normalizeInviteCode(inviteCode);
    if (normalized.length === 0) {
      return null;
    }
    return repository.findOne({ where: { inviteCode: normalized } });
  }

  async findByInviteCodeOrThrow(
    inviteCode: string,
    manager?: EntityManager,
  ): Promise<Team> {
    const team = await this.findByInviteCode(inviteCode, manager);
    if (!team) {
      throw new InviteCodeNotFoundException();
    }
    return team;
  }

  async findById(
    teamId: string,
    manager?: EntityManager,
  ): Promise<Team | null> {
    const repository = manager
      ? manager.getRepository(Team)
      : this.teamRepository;
    return repository.findOne({ where: { id: teamId } });
  }

  /**
   * The single entry point for creating a `Team` row anywhere in this
   * codebase (docs/adr/0009-self-service-team-creation.md Decision 2) — so
   * "create a team" and "the team name was checked" can't be structurally
   * separated by a future caller who forgets to check first, the same
   * "boundary enforced by code shape, not caller discipline" reasoning
   * docs/adr/0002's addendum already applies to PlayerPrivateInfoModule.
   *
   * The invite code is generated here and never taken from the client
   * (ADR-0009's 2026-11-08 amendment, superseding Decision 3 — see
   * team-invite-code.util.ts for why). The name is checked against the
   * shared ChatModerationCheck (ADR-0009 Decision 5). The generated code
   * is checked as well and simply re-rolled if a random string happens to
   * spell something, since a child will repeat it aloud to teammates.
   * Always takes a manager: this is only ever called from inside
   * OnboardingService.createPlayer's transaction (see that ADR's Decision
   * 1 on why team creation isn't its own endpoint/transaction).
   */
  async createTeam(
    manager: EntityManager,
    input: CreateTeamInput,
  ): Promise<Team> {
    const nameResult = await this.chatModerationCheck.check(input.name);
    if (!nameResult.allowed) {
      throw new TeamNameRejectedByFilterException();
    }

    const repository = manager.getRepository(Team);
    const inviteCode = await this.pickUnusedInviteCode(manager);
    const team = repository.create({ name: input.name, inviteCode });
    return repository.save(team);
  }

  /**
   * Captain-only rotation (ADR-0009's 2026-11-08 amendment). The old code
   * stops working the moment this commits: there is one `invite_code`
   * column and it is overwritten, so no lookup can match the old value
   * afterwards. Players who already joined are unaffected — membership is
   * `team_id`, never the code. The captain check is the caller's
   * (`PlayersService.assertIsCaptainOfTeam`), same as every other
   * captain-only action.
   */
  async rotateInviteCode(teamId: string): Promise<string> {
    return this.teamRepository.manager.transaction(async (manager) => {
      const inviteCode = await this.pickUnusedInviteCode(manager);
      await manager.getRepository(Team).update({ id: teamId }, { inviteCode });
      return inviteCode;
    });
  }

  private async pickUnusedInviteCode(manager: EntityManager): Promise<string> {
    const repository = manager.getRepository(Team);
    for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
      const candidate = generateTeamInviteCode();
      const moderation = await this.chatModerationCheck.check(candidate);
      if (!moderation.allowed) {
        continue;
      }
      const clashes = await repository.count({
        where: { inviteCode: candidate },
      });
      if (clashes === 0) {
        return candidate;
      }
    }
    // Eight consecutive failures at 40 bits means the generator or the
    // filter is broken, not bad luck — fail loudly rather than loop.
    throw new Error('Could not generate an unused team invite code');
  }
}
