import { ParentalConsentStatus } from '../players/player-consent-status.enum';
import { ConsentService } from './consent.service';

// docs/adr/0012's 2026-11-08 amendment — the last link of the audited
// chain: a reminder mints a fresh consent token (killing the parent's
// link) and mails it to whatever the effective contact is. While a
// contact change is unresolved, neither the player nor a captain may send
// one.
function build(overrides: {
  hasPendingContactChange: boolean;
  requesterIsCaptain?: boolean;
}) {
  const targetPlayer = {
    id: 'kid-1',
    teamId: 'team-1',
    screenName: 'FloorballStar15',
    birthYear: 2015,
    locale: 'sv',
    parentalConsentStatus: ParentalConsentStatus.PENDING,
  };
  const playersService = {
    findByIdOrThrow: jest.fn().mockResolvedValue(targetPlayer),
    assertIsCaptainOfTeam: jest.fn().mockResolvedValue(undefined),
    setConsentToken: jest.fn().mockResolvedValue(undefined),
  };
  const playerPrivateInfoService = {
    getParentContact: jest.fn().mockResolvedValue('parent@example.com'),
    resolveDueContactChange: jest.fn().mockResolvedValue(undefined),
    hasPendingContactChange: jest
      .fn()
      .mockResolvedValue(overrides.hasPendingContactChange),
  };
  const teamsService = {
    findById: jest
      .fn()
      .mockResolvedValue({ name: 'IBK Test', jurisdiction: null }),
  };
  const redisService = {
    tryClaimConsentReminderCooldown: jest.fn().mockResolvedValue(true),
  };
  const mailService = { sendMail: jest.fn().mockResolvedValue(undefined) };
  const configService = { get: jest.fn().mockReturnValue(undefined) };
  const dataSource = {
    transaction: jest.fn((cb: (manager: unknown) => unknown) => cb(undefined)),
  };

  const service = new ConsentService(
    dataSource as never,
    playersService as never,
    playerPrivateInfoService as never,
    teamsService as never,
    redisService as never,
    mailService as never,
    configService as never,
  );
  return {
    service,
    playersService,
    playerPrivateInfoService,
    redisService,
    mailService,
  };
}

describe('ConsentService.sendReminder — pending contact change', () => {
  it.each([
    ['the player themselves', 'kid-1'],
    ['a captain', 'captain-1'],
  ])(
    'refuses %s with consent_reminder_blocked_pending_contact_change, minting and mailing nothing',
    async (_who, requesterId) => {
      const { service, playersService, redisService, mailService } = build({
        hasPendingContactChange: true,
      });

      await expect(
        service.sendReminder(requesterId, 'kid-1'),
      ).rejects.toMatchObject({
        code: 'consent_reminder_blocked_pending_contact_change',
      });
      // The parent's existing link must survive: no new token.
      expect(playersService.setConsentToken).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
      // Refused before the cooldown is claimed, like the other checks.
      expect(
        redisService.tryClaimConsentReminderCooldown,
      ).not.toHaveBeenCalled();
    },
  );

  it('resolves a due change before checking, so an elapsed grace period does not block forever', async () => {
    const { service, playerPrivateInfoService } = build({
      hasPendingContactChange: false,
    });

    await service.sendReminder('kid-1', 'kid-1');

    const readOrder =
      playerPrivateInfoService.resolveDueContactChange.mock
        .invocationCallOrder[0];
    const checkOrder =
      playerPrivateInfoService.hasPendingContactChange.mock
        .invocationCallOrder[0];
    expect(readOrder).toBeLessThan(checkOrder);
  });

  it('sends as before when no change is pending', async () => {
    const { service, playersService, mailService } = build({
      hasPendingContactChange: false,
    });

    await expect(service.sendReminder('kid-1', 'kid-1')).resolves.toEqual({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest's own matcher typing
      sentAt: expect.any(Date),
    });
    expect(playersService.setConsentToken).toHaveBeenCalled();
    expect(mailService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'parent@example.com' }),
    );
  });
});
