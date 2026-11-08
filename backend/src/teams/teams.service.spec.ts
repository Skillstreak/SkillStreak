import { EntityManager } from 'typeorm';
import { TeamNameRejectedByFilterException } from '../common/errors/exceptions';
import type { ChatModerationCheck } from '../team-chat/chat-moderation-check.interface';
import { Team } from './entities/team.entity';
import { normalizeInviteCode } from './team-invite-code.util';
import { TeamsService } from './teams.service';

// The generator's own alphabet and length (common/crypto/human-code.util.ts):
// no 0/O, no 1/I, eight characters.
const GENERATED_CODE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

function buildRepository(existingCodes: string[] = []) {
  const saved: Array<Partial<Team>> = [];
  const updated: Array<{ id: string; inviteCode: string }> = [];
  const repository = {
    create: jest.fn((input: Partial<Team>) => ({ ...input })),
    save: jest.fn((team: Partial<Team>) => {
      saved.push(team);
      return Promise.resolve({ id: 'team-new', ...team });
    }),
    count: jest.fn(({ where }: { where: { inviteCode: string } }) =>
      Promise.resolve(existingCodes.includes(where.inviteCode) ? 1 : 0),
    ),
    update: jest.fn(
      (criteria: { id: string }, patch: { inviteCode: string }) => {
        updated.push({ id: criteria.id, inviteCode: patch.inviteCode });
        return Promise.resolve();
      },
    ),
    findOne: jest.fn(() => Promise.resolve(null)),
  };
  interface FakeManager {
    getRepository: () => typeof repository;
    transaction: (
      work: (m: EntityManager) => Promise<unknown>,
    ) => Promise<unknown>;
  }
  const manager: FakeManager = {
    getRepository: () => repository,
    transaction: (work) => work(manager as unknown as EntityManager),
  };
  const withManager = Object.assign(repository, { manager });
  return { repository: withManager, manager, saved, updated };
}

function allowAll(): ChatModerationCheck {
  return { check: jest.fn(() => Promise.resolve({ allowed: true })) };
}

describe('TeamsService — server-generated invite codes (ADR-0009, 2026-11-08)', () => {
  it('createTeam generates the code and ignores nothing the client could send', async () => {
    const { repository, manager, saved } = buildRepository();
    const service = new TeamsService(repository as never, allowAll());

    const team = await service.createTeam(manager as never, {
      name: 'Falkarna',
    });

    expect(team.inviteCode).toMatch(GENERATED_CODE);
    expect(saved[0]).toEqual({ name: 'Falkarna', inviteCode: team.inviteCode });
  });

  it('two teams get two different codes', async () => {
    const { repository, manager } = buildRepository();
    const service = new TeamsService(repository as never, allowAll());

    const a = await service.createTeam(manager as never, { name: 'A' });
    const b = await service.createTeam(manager as never, { name: 'B' });

    expect(a.inviteCode).not.toEqual(b.inviteCode);
  });

  it('still rejects a team name the filter refuses', async () => {
    const { repository, manager } = buildRepository();
    const moderation: ChatModerationCheck = {
      check: jest.fn((text: string) =>
        Promise.resolve({ allowed: text !== 'rude' }),
      ),
    };
    const service = new TeamsService(repository as never, moderation);

    await expect(
      service.createTeam(manager as never, { name: 'rude' }),
    ).rejects.toBeInstanceOf(TeamNameRejectedByFilterException);
  });

  it('re-rolls a generated code the filter refuses instead of failing the signup', async () => {
    const { repository, manager } = buildRepository();
    let calls = 0;
    const moderation: ChatModerationCheck = {
      check: jest.fn((text: string) => {
        if (text === 'Falkarna') return Promise.resolve({ allowed: true });
        calls += 1;
        // First generated code "spells something"; the second is fine.
        return Promise.resolve({ allowed: calls > 1 });
      }),
    };
    const service = new TeamsService(repository as never, moderation);

    const team = await service.createTeam(manager as never, {
      name: 'Falkarna',
    });

    expect(team.inviteCode).toMatch(GENERATED_CODE);
    expect(calls).toBe(2);
  });

  it('rotateInviteCode writes a fresh generated code and returns it', async () => {
    const { repository, updated } = buildRepository();
    const service = new TeamsService(repository as never, allowAll());

    const code = await service.rotateInviteCode('team-1');

    expect(code).toMatch(GENERATED_CODE);
    expect(updated).toEqual([{ id: 'team-1', inviteCode: code }]);
  });

  it('fails loudly rather than looping forever if no unused code can be found', async () => {
    const { repository } = buildRepository();
    repository.count.mockResolvedValue(1);
    const service = new TeamsService(repository as never, allowAll());

    await expect(service.rotateInviteCode('team-1')).rejects.toThrow(
      'Could not generate an unused team invite code',
    );
  });

  it('looks codes up case- and whitespace-insensitively', async () => {
    const { repository } = buildRepository();
    const service = new TeamsService(repository as never, allowAll());

    await service.findByInviteCode('  k7mq2xpa ');

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { inviteCode: 'K7MQ2XPA' },
    });
  });

  it('never queries for an empty code', async () => {
    const { repository } = buildRepository();
    const service = new TeamsService(repository as never, allowAll());

    await expect(service.findByInviteCode('   ')).resolves.toBeNull();
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('normalizeInviteCode upper-cases and trims', () => {
    expect(normalizeInviteCode(' abC9 ')).toBe('ABC9');
  });
});
