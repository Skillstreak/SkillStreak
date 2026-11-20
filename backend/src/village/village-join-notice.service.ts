import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { buildVillageJoinedEmail } from '../mail/templates/village-joined-email.template';
import { PlayerPrivateInfoService } from '../player-private-info/player-private-info.service';
import { Player } from '../players/entities/player.entity';
import { ParentalConsentStatus } from '../players/player-consent-status.enum';
import { TeamJoinStatus } from '../players/team-join-status.enum';
import { Team } from '../teams/entities/team.entity';
import { villageTeamName } from './village-team-name.util';

/** Turning Village on again within this window does not re-mail. */
export const VILLAGE_JOIN_NOTICE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export interface VillageJoinNoticeOutcome {
  sent: boolean;
  recipients: number;
  handedOff: number;
  failed: number;
}

/**
 * ADR-0040 — tells every approved member's parent contact that the team
 * joined Village. Informational only, best-effort, and never allowed to
 * block or fail the captain's toggle: the caller does not await it.
 *
 * Logs counts only — never an address, never a player id next to an
 * outcome.
 */
@Injectable()
export class VillageJoinNoticeService {
  private readonly logger = new Logger(VillageJoinNoticeService.name);

  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    private readonly playerPrivateInfoService: PlayerPrivateInfoService,
    private readonly mailService: MailService,
  ) {}

  async notifyIfDue(
    teamId: string,
    now: Date = new Date(),
  ): Promise<VillageJoinNoticeOutcome> {
    const none = { sent: false, recipients: 0, handedOff: 0, failed: 0 };

    // Claim the notice atomically, so two quick on-toggles (or two pods)
    // cannot both mail. The previous value is kept to put back if not a
    // single mail could be handed off, so the next toggle tries again.
    const cutoff = new Date(now.getTime() - VILLAGE_JOIN_NOTICE_COOLDOWN_MS);
    const team = await this.teamRepository.manager.transaction(
      async (manager) => {
        const locked = await manager
          .getRepository(Team)
          .createQueryBuilder('t')
          .setLock('pessimistic_write')
          .where('t.id = :teamId', { teamId })
          .getOne();
        if (!locked || !locked.villageOptIn) return null;
        const previous = locked.villageJoinNoticeSentAt;
        if (previous && previous >= cutoff) return null;
        await manager
          .getRepository(Team)
          .update({ id: teamId }, { villageJoinNoticeSentAt: now });
        return { name: locked.name, sport: locked.sport, previous };
      },
    );
    if (!team) return none;

    const members = await this.playerRepository.find({
      // Consent-approved only: an address nobody has proven they own
      // does not get mail naming the team.
      where: {
        teamId,
        teamJoinStatus: TeamJoinStatus.APPROVED,
        parentalConsentStatus: ParentalConsentStatus.APPROVED,
      },
      select: { id: true, locale: true },
    });
    const recipients =
      await this.playerPrivateInfoService.getParentEmailRecipients(members);

    let handedOff = 0;
    let failed = 0;
    const shownName = villageTeamName({ name: team.name, sport: team.sport });
    for (const recipient of recipients) {
      const email = buildVillageJoinedEmail({
        teamName: team.name,
        shownName,
        sport: team.sport,
        locale: recipient.locale,
      });
      try {
        const result = await this.mailService.sendMail({
          to: recipient.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
        if (result.handedOff) handedOff += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }

    if (recipients.length > 0 && handedOff === 0) {
      await this.teamRepository.update(
        { id: teamId },
        { villageJoinNoticeSentAt: team.previous },
      );
    }
    if (failed > 0 || recipients.length === 0) {
      this.logger.warn(
        `Village join notice for a team: ${recipients.length} recipient(s), ${handedOff} handed off, ${failed} failed.`,
      );
    }
    return { sent: true, recipients: recipients.length, handedOff, failed };
  }
}
