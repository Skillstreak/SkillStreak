import { NotFoundException } from '@nestjs/common';
import { ParentalConsentStatus } from '../players/player-consent-status.enum';
import { VillageController } from './village.controller';

describe('VillageController', () => {
  function setup(
    player: {
      teamId: string;
      isCaptain: boolean;
      parentalConsentStatus: ParentalConsentStatus;
    },
    enabled: string | null = 'true',
    previewIds: string | null = null,
  ) {
    const villageService = {
      getVillageView: jest.fn(() => Promise.resolve({})),
      getPreviewView: jest.fn(() => Promise.resolve({ preview: true })),
      setOptIn: jest.fn(() => Promise.resolve()),
    };
    const playersService = {
      findByIdOrThrow: jest.fn(() => Promise.resolve(player)),
      assertTeamMembership: jest.fn(() => Promise.resolve(player)),
      assertIsCaptainOfTeam: jest.fn(() => Promise.resolve(player)),
    };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'VILLAGE_PREVIEW_PLAYER_IDS' ? previewIds : enabled,
      ),
    };
    const joinNotice = {
      notifyIfDue: jest.fn(() => Promise.resolve({ sent: true })),
    };
    const controller = new VillageController(
      villageService as never,
      playersService as never,
      configService as never,
      joinNotice as never,
    );
    return { controller, villageService, playersService, joinNotice };
  }

  it('GET runs the team-membership gate before reading', async () => {
    const { controller, playersService, villageService } = setup({
      teamId: 'team-a',
      isCaptain: false,
      parentalConsentStatus: ParentalConsentStatus.APPROVED,
    });
    playersService.assertTeamMembership.mockRejectedValueOnce(
      new Error('pending'),
    );
    await expect(controller.getVillage('p1')).rejects.toThrow('pending');
    expect(villageService.getVillageView).not.toHaveBeenCalled();
  });

  it.each([
    [true, ParentalConsentStatus.APPROVED, true],
    [true, ParentalConsentStatus.PENDING, false],
    [false, ParentalConsentStatus.APPROVED, false],
  ])(
    'canManage for captain=%p consent=%p is %p',
    async (isCaptain, parentalConsentStatus, canManage) => {
      const { controller, villageService } = setup({
        teamId: 'team-a',
        isCaptain,
        parentalConsentStatus,
      });
      await controller.getVillage('p1');
      expect(villageService.getVillageView).toHaveBeenCalledWith({
        teamId: 'team-a',
        canManage,
      });
    },
  );

  it("PUT opt-in requires the captain check for the caller's own team", async () => {
    const { controller, playersService, villageService } = setup({
      teamId: 'team-a',
      isCaptain: false,
      parentalConsentStatus: ParentalConsentStatus.APPROVED,
    });
    playersService.assertIsCaptainOfTeam.mockRejectedValueOnce(
      new Error('not captain'),
    );
    await expect(controller.setOptIn('p1', { optedIn: true })).rejects.toThrow(
      'not captain',
    );
    expect(playersService.assertIsCaptainOfTeam).toHaveBeenCalledWith(
      'p1',
      'team-a',
    );
    expect(villageService.setOptIn).not.toHaveBeenCalled();
  });

  it("PUT opt-in updates the caller's own team when the captain check passes", async () => {
    const { controller, villageService } = setup({
      teamId: 'team-a',
      isCaptain: true,
      parentalConsentStatus: ParentalConsentStatus.APPROVED,
    });
    await expect(
      controller.setOptIn('p1', { optedIn: false }),
    ).resolves.toEqual({
      optedIn: false,
    });
    expect(villageService.setOptIn).toHaveBeenCalledWith('team-a', false, 'p1');
  });

  it.each([null, '', 'false', 'TRUE'])(
    'both endpoints 404 unless VILLAGE_ENABLED is exactly "true" (%p)',
    async (enabled) => {
      const { controller, villageService, playersService } = setup(
        {
          teamId: 'team-a',
          isCaptain: true,
          parentalConsentStatus: ParentalConsentStatus.APPROVED,
        },
        enabled,
      );
      await expect(controller.getVillage('p1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        controller.setOptIn('p1', { optedIn: true }),
      ).rejects.toThrow(NotFoundException);
      expect(playersService.findByIdOrThrow).not.toHaveBeenCalled();
      expect(villageService.setOptIn).not.toHaveBeenCalled();
    },
  );

  it("turning ON fires the parents' join notice; turning OFF does not", async () => {
    const { controller, joinNotice } = setup({
      teamId: 'team-a',
      isCaptain: true,
      parentalConsentStatus: ParentalConsentStatus.APPROVED,
    });
    await controller.setOptIn('p1', { optedIn: false });
    expect(joinNotice.notifyIfDue).not.toHaveBeenCalled();
    await controller.setOptIn('p1', { optedIn: true });
    expect(joinNotice.notifyIfDue).toHaveBeenCalledWith('team-a');
  });

  it('a failing join notice never fails the toggle', async () => {
    const { controller, joinNotice, villageService } = setup({
      teamId: 'team-a',
      isCaptain: true,
      parentalConsentStatus: ParentalConsentStatus.APPROVED,
    });
    joinNotice.notifyIfDue.mockRejectedValueOnce(new Error('smtp down'));
    await expect(controller.setOptIn('p1', { optedIn: true })).resolves.toEqual(
      { optedIn: true },
    );
    expect(villageService.setOptIn).toHaveBeenCalledWith('team-a', true, 'p1');
    await new Promise((r) => setImmediate(r));
  });

  describe('owner preview (VILLAGE_PREVIEW_PLAYER_IDS)', () => {
    const captain = {
      teamId: 'team-a',
      isCaptain: true,
      parentalConsentStatus: ParentalConsentStatus.APPROVED,
    };

    it('a listed player gets the preview while the village is off', async () => {
      const { controller, villageService } = setup(
        captain,
        'false',
        ' other , p1 ',
      );
      expect(controller.getAccess('p1')).toEqual({
        enabled: true,
        preview: true,
      });
      await expect(controller.getVillage('p1')).resolves.toEqual({
        preview: true,
      });
      expect(villageService.getPreviewView).toHaveBeenCalledWith('team-a');
      expect(villageService.getVillageView).not.toHaveBeenCalled();
    });

    it('the preview still runs the team-membership gate', async () => {
      const { controller, playersService, villageService } = setup(
        captain,
        'false',
        'p1',
      );
      playersService.assertTeamMembership.mockRejectedValueOnce(
        new Error('pending'),
      );
      await expect(controller.getVillage('p1')).rejects.toThrow('pending');
      expect(villageService.getPreviewView).not.toHaveBeenCalled();
    });

    it('a preview player cannot join for real, so no parent mail goes out', async () => {
      const { controller, villageService, joinNotice } = setup(
        captain,
        'false',
        'p1',
      );
      await expect(
        controller.setOptIn('p1', { optedIn: true }),
      ).rejects.toThrow(NotFoundException);
      expect(villageService.setOptIn).not.toHaveBeenCalled();
      expect(joinNotice.notifyIfDue).not.toHaveBeenCalled();
    });

    it('an unlisted player sees nothing', async () => {
      const { controller } = setup(captain, 'false', 'p1');
      expect(controller.getAccess('p2')).toEqual({
        enabled: false,
        preview: false,
      });
      await expect(controller.getVillage('p2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('once the village is on, listed players get the real view', async () => {
      const { controller, villageService } = setup(captain, 'true', 'p1');
      expect(controller.getAccess('p1')).toEqual({
        enabled: true,
        preview: false,
      });
      await controller.getVillage('p1');
      expect(villageService.getVillageView).toHaveBeenCalled();
      expect(villageService.getPreviewView).not.toHaveBeenCalled();
    });
  });
});
