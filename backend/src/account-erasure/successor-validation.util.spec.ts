import { EntityManager } from 'typeorm';
import { TeamJoinStatus } from '../players/team-join-status.enum';
import { isSuccessorStillValid } from './successor-validation.util';

function buildManager(options: {
  target: {
    id: string;
    teamId: string;
    teamJoinStatus?: TeamJoinStatus;
  } | null;
  activeErasureCount: number;
}) {
  const playerRepository = {
    findOne: jest.fn().mockResolvedValue(options.target),
  };
  const erasureRepository = {
    count: jest.fn().mockResolvedValue(options.activeErasureCount),
  };
  const manager = {
    getRepository: jest.fn((entity: { name: string }) =>
      entity.name === 'AccountErasureRequest'
        ? erasureRepository
        : playerRepository,
    ),
  } as unknown as EntityManager;
  return { manager, playerRepository, erasureRepository };
}

// docs/adr/0013-account-erasure.md Decision 4 — shared by both confirm-time
// re-validation and execution-time re-validation (AccountErasureService/
// PlayersService, respectively), so it's tested once, directly, here.
describe('isSuccessorStillValid', () => {
  const teamId = 'team-1';
  const requesterId = 'requester-1';
  const successorId = 'successor-1';

  it('returns false when the successor equals the requester (defense in depth, should not occur given request-time validation)', async () => {
    const { manager, playerRepository } = buildManager({
      target: { id: requesterId, teamId },
      activeErasureCount: 0,
    });

    await expect(
      isSuccessorStillValid(manager, teamId, requesterId, requesterId),
    ).resolves.toBe(false);
    // Short-circuits before ever querying — no need to look anything up.
    expect(playerRepository.findOne).not.toHaveBeenCalled();
  });

  it('returns false when the successor no longer exists', async () => {
    const { manager } = buildManager({ target: null, activeErasureCount: 0 });

    await expect(
      isSuccessorStillValid(manager, teamId, requesterId, successorId),
    ).resolves.toBe(false);
  });

  it('returns false when the successor has since left the team', async () => {
    const { manager } = buildManager({
      target: { id: successorId, teamId: 'other-team' },
      activeErasureCount: 0,
    });

    await expect(
      isSuccessorStillValid(manager, teamId, requesterId, successorId),
    ).resolves.toBe(false);
  });

  // Security audit, 2026-11-08 — a teamId-only check let a captain name a
  // pending or rejected joiner as the successor who inherits the team.
  it.each([TeamJoinStatus.PENDING, TeamJoinStatus.REJECTED])(
    'returns false when the successor is on the team but their join is %s',
    async (teamJoinStatus) => {
      const { manager } = buildManager({
        target: { id: successorId, teamId, teamJoinStatus },
        activeErasureCount: 0,
      });

      await expect(
        isSuccessorStillValid(manager, teamId, requesterId, successorId),
      ).resolves.toBe(false);
    },
  );

  it('returns false when the successor is themselves currently mid-erasure', async () => {
    const { manager } = buildManager({
      target: {
        id: successorId,
        teamId,
        teamJoinStatus: TeamJoinStatus.APPROVED,
      },
      activeErasureCount: 1,
    });

    await expect(
      isSuccessorStillValid(manager, teamId, requesterId, successorId),
    ).resolves.toBe(false);
  });

  it('returns true for a still-valid, still-on-team, not-mid-erasure successor', async () => {
    const { manager, erasureRepository } = buildManager({
      target: {
        id: successorId,
        teamId,
        teamJoinStatus: TeamJoinStatus.APPROVED,
      },
      activeErasureCount: 0,
    });

    await expect(
      isSuccessorStillValid(manager, teamId, requesterId, successorId),
    ).resolves.toBe(true);
    expect(erasureRepository.count).toHaveBeenCalledTimes(1);
    const [[callArgs]] = erasureRepository.count.mock.calls as [
      [{ where: { playerId: string } }],
    ];
    expect(callArgs.where.playerId).toBe(successorId);
  });
});
