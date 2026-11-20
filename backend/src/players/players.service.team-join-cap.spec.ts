import type { EntityManager } from 'typeorm';
import { ParentTeamCapReachedException } from '../common/errors/exceptions';
import { PlayersService } from './players.service';
import { TeamJoinStatus } from './team-join-status.enum';

// ADR-0040 — decideTeamJoin runs the caller's parent-contact cap check
// inside the approval's own transaction, and only for APPROVED.
describe('PlayersService.decideTeamJoin — pre-approval hook', () => {
  function build() {
    const target = {
      id: 'kid',
      teamId: 'team-1',
      teamJoinStatus: TeamJoinStatus.PENDING,
    };
    const lockedRow = { ...target };
    const txRepo = {
      save: jest.fn((p: unknown) => Promise.resolve(p)),
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(() => Promise.resolve(lockedRow)),
      })),
    };
    const manager = {
      getRepository: jest.fn(() => txRepo),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((cb: (m: EntityManager) => unknown) => cb(manager)),
    };
    const playerRepository = {
      save: jest.fn((p: unknown) => Promise.resolve(p)),
    };
    const service = new PlayersService(
      dataSource as never,
      playerRepository as never,
      undefined as never,
    );
    jest.spyOn(service, 'assertIsCaptainOfTeam').mockResolvedValue({} as never);
    jest.spyOn(service, 'findByIdOrThrow').mockResolvedValue(target as never);
    return { service, target, lockedRow, txRepo, manager, playerRepository };
  }

  it('runs the hook in the transaction before saving an approval', async () => {
    const { service, txRepo, manager } = build();
    const hook = jest.fn(() => Promise.resolve());
    const result = await service.decideTeamJoin(
      'team-1',
      'captain',
      'kid',
      TeamJoinStatus.APPROVED,
      hook,
    );
    expect(hook).toHaveBeenCalledWith(manager);
    expect(txRepo.save).toHaveBeenCalled();
    expect(result.teamJoinStatus).toBe(TeamJoinStatus.APPROVED);
  });

  it('does not approve when the hook refuses (parent at the team cap)', async () => {
    const { service, txRepo, lockedRow } = build();
    const hook = jest.fn(() =>
      Promise.reject(new ParentTeamCapReachedException()),
    );
    await expect(
      service.decideTeamJoin(
        'team-1',
        'captain',
        'kid',
        TeamJoinStatus.APPROVED,
        hook,
      ),
    ).rejects.toBeInstanceOf(ParentTeamCapReachedException);
    expect(txRepo.save).not.toHaveBeenCalled();
    expect(lockedRow.teamJoinStatus).toBe(TeamJoinStatus.PENDING);
  });

  it('never runs the hook for a rejection', async () => {
    const { service, playerRepository } = build();
    const hook = jest.fn(() => Promise.resolve());
    await service.decideTeamJoin(
      'team-1',
      'captain',
      'kid',
      TeamJoinStatus.REJECTED,
      hook,
    );
    expect(hook).not.toHaveBeenCalled();
    expect(playerRepository.save).toHaveBeenCalled();
  });

  it('re-checks PENDING under the row lock (a concurrent reject wins)', async () => {
    const { service, txRepo, lockedRow } = build();
    lockedRow.teamJoinStatus = TeamJoinStatus.REJECTED;
    const hook = jest.fn(() => Promise.resolve());
    await expect(
      service.decideTeamJoin(
        'team-1',
        'captain',
        'kid',
        TeamJoinStatus.APPROVED,
        hook,
      ),
    ).rejects.toThrow();
    expect(hook).not.toHaveBeenCalled();
    expect(txRepo.save).not.toHaveBeenCalled();
  });
});
