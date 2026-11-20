import { ParentTeamCapReachedException } from '../common/errors/exceptions';
import { PlayerLocale } from '../common/locale/player-locale.enum';
import { TeamJoinStatus } from '../players/team-join-status.enum';
import { ConsentService } from './consent.service';

// ADR-0040 — consent approval is where an approved membership starts to
// count toward the 5-teams-per-parent cap (security review B1).
describe('ConsentService.approve — parent-contact team cap', () => {
  function build(opts: {
    teamJoinStatus: TeamJoinStatus;
    capThrows?: boolean;
  }) {
    const player = {
      id: 'kid',
      teamId: 'team-6',
      teamJoinStatus: opts.teamJoinStatus,
      screenName: 'Kid',
      birthYear: 2015,
      jurisdiction: 'SE',
      locale: PlayerLocale.EN,
    };
    const playersService = {
      approveByConsentToken: jest.fn().mockResolvedValue(player),
    };
    const playerPrivateInfoService = {
      findIndexForPlayer: jest.fn().mockResolvedValue('idx'),
      assertParentTeamCapAllows: opts.capThrows
        ? jest.fn().mockRejectedValue(new ParentTeamCapReachedException())
        : jest.fn().mockResolvedValue(undefined),
      recordConsentEvent: jest.fn().mockResolvedValue(undefined),
    };
    const manager = {};
    const dataSource = {
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
    };
    const service = new ConsentService(
      dataSource as never,
      playersService as never,
      playerPrivateInfoService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, playerPrivateInfoService, manager };
  }

  it('checks the cap for an approved member, by stored index and own team', async () => {
    const { service, playerPrivateInfoService, manager } = build({
      teamJoinStatus: TeamJoinStatus.APPROVED,
    });
    const result = await service.approve('token');
    expect(
      playerPrivateInfoService.assertParentTeamCapAllows,
    ).toHaveBeenCalledWith(manager, 'idx', 'team-6');
    expect(result).toMatchObject({ screenName: 'Kid' });
  });

  it('returns capReached (rolled back, nothing recorded) when the parent is at the cap', async () => {
    const { service, playerPrivateInfoService } = build({
      teamJoinStatus: TeamJoinStatus.APPROVED,
      capThrows: true,
    });
    await expect(service.approve('token')).resolves.toEqual({
      capReached: true,
      locale: PlayerLocale.EN,
    });
    expect(playerPrivateInfoService.recordConsentEvent).not.toHaveBeenCalled();
  });

  it('does not check a pending join (the captain approval checks it)', async () => {
    const { service, playerPrivateInfoService } = build({
      teamJoinStatus: TeamJoinStatus.PENDING,
    });
    await service.approve('token');
    expect(
      playerPrivateInfoService.assertParentTeamCapAllows,
    ).not.toHaveBeenCalled();
  });
});
