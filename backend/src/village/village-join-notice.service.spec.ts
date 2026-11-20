import { PlayerLocale } from '../common/locale/player-locale.enum';
import {
  VILLAGE_JOIN_NOTICE_COOLDOWN_MS,
  VillageJoinNoticeService,
} from './village-join-notice.service';

const now = new Date('2026-11-20T12:00:00Z');

function build(opts: {
  team?: Record<string, unknown> | null;
  recipients?: Array<{ email: string; locale: PlayerLocale }>;
  send?: jest.Mock;
}) {
  const team =
    opts.team === undefined
      ? {
          id: 'team-1',
          name: 'IBK Lund P14',
          sport: 'FLOORBALL',
          villageOptIn: true,
          villageJoinNoticeSentAt: null,
        }
      : opts.team;
  const txTeamRepo = {
    createQueryBuilder: jest.fn(() => ({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(() => Promise.resolve(team)),
    })),
    update: jest.fn(() => Promise.resolve()),
  };
  const teamRepository = {
    manager: {
      transaction: jest.fn((cb: (m: unknown) => unknown) =>
        cb({ getRepository: () => txTeamRepo }),
      ),
    },
    update: jest.fn(() => Promise.resolve()),
  };
  const playerRepository = {
    find: jest.fn(() =>
      Promise.resolve([
        { id: 'p1', locale: PlayerLocale.SV },
        { id: 'p2', locale: PlayerLocale.EN },
      ]),
    ),
  };
  const playerPrivateInfoService = {
    getParentEmailRecipients: jest.fn(() =>
      Promise.resolve(
        opts.recipients ?? [
          { email: 'a@example.com', locale: PlayerLocale.SV },
          { email: 'b@example.com', locale: PlayerLocale.EN },
        ],
      ),
    ),
  };
  const mailService = {
    sendMail:
      opts.send ??
      jest.fn(() => Promise.resolve({ handedOff: true, rejected: [] })),
  };
  const service = new VillageJoinNoticeService(
    teamRepository as never,
    playerRepository as never,
    playerPrivateInfoService as never,
    mailService as never,
  );
  return {
    service,
    txTeamRepo,
    teamRepository,
    playerRepository,
    mailService,
  };
}

describe('VillageJoinNoticeService (ADR-0040)', () => {
  it('mails every distinct parent of approved members, in their locale, and claims the notice', async () => {
    const { service, txTeamRepo, playerRepository, mailService } = build({});
    const outcome = await service.notifyIfDue('team-1', now);
    expect(outcome).toEqual({
      sent: true,
      recipients: 2,
      handedOff: 2,
      failed: 0,
    });
    expect(txTeamRepo.update).toHaveBeenCalledWith(
      { id: 'team-1' },
      { villageJoinNoticeSentAt: now },
    );
    expect(playerRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId: 'team-1',
          teamJoinStatus: 'approved',
          parentalConsentStatus: 'approved',
        },
      }),
    );
    const calls = mailService.sendMail.mock.calls as unknown as Array<
      [{ to: string; subject: string; text: string }]
    >;
    expect(calls.map((c) => c[0].to)).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
    expect(calls[0][0].subject).toContain('Skillstreak Village');
    expect(calls[1][0].subject).toContain('has joined');
    // The free-text team name is masked in "what other teams see".
    expect(calls[0][0].text).toContain('"Klubbhjältarna"');
  });

  it('does not re-mail within 30 days', async () => {
    const { service, mailService, txTeamRepo } = build({
      team: {
        name: 'X',
        sport: 'FLOORBALL',
        villageOptIn: true,
        villageJoinNoticeSentAt: new Date(
          now.getTime() - VILLAGE_JOIN_NOTICE_COOLDOWN_MS + 60_000,
        ),
      },
    });
    const outcome = await service.notifyIfDue('team-1', now);
    expect(outcome.sent).toBe(false);
    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(txTeamRepo.update).not.toHaveBeenCalled();
  });

  it('mails again once 30 days have passed', async () => {
    const { service, mailService } = build({
      team: {
        name: 'X',
        sport: 'FLOORBALL',
        villageOptIn: true,
        villageJoinNoticeSentAt: new Date(
          now.getTime() - VILLAGE_JOIN_NOTICE_COOLDOWN_MS - 60_000,
        ),
      },
    });
    expect((await service.notifyIfDue('team-1', now)).sent).toBe(true);
    expect(mailService.sendMail).toHaveBeenCalled();
  });

  it('does nothing if the team was turned off again before the notice ran', async () => {
    const { service, mailService } = build({
      team: {
        name: 'X',
        sport: 'FLOORBALL',
        villageOptIn: false,
        villageJoinNoticeSentAt: null,
      },
    });
    expect((await service.notifyIfDue('team-1', now)).sent).toBe(false);
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it('counts failures, keeps going, and releases the claim if nothing was handed off', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce({
        handedOff: false,
        rejected: [],
        reason: 'not_configured',
      });
    const { service, teamRepository } = build({ send });
    const outcome = await service.notifyIfDue('team-1', now);
    expect(outcome).toEqual({
      sent: true,
      recipients: 2,
      handedOff: 0,
      failed: 2,
    });
    expect(teamRepository.update).toHaveBeenCalledWith(
      { id: 'team-1' },
      { villageJoinNoticeSentAt: null },
    );
  });

  it('keeps the claim when at least one mail was handed off', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('one bad'))
      .mockResolvedValueOnce({ handedOff: true, rejected: [] });
    const { service, teamRepository } = build({ send });
    const outcome = await service.notifyIfDue('team-1', now);
    expect(outcome.handedOff).toBe(1);
    expect(teamRepository.update).not.toHaveBeenCalled();
  });
});
