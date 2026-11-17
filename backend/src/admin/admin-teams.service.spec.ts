import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Team } from '../teams/entities/team.entity';
import { AdminTeamsService } from './admin-teams.service';

interface MockTeamRepo {
  createQueryBuilder: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
}

interface MockPlayerRepo {
  count: jest.Mock;
}

interface MockDataSource {
  getRepository: jest.Mock;
}

describe('AdminTeamsService', () => {
  let service: AdminTeamsService;
  let teamRepo: MockTeamRepo;
  let playerRepo: MockPlayerRepo;
  let dataSource: MockDataSource;

  beforeEach(() => {
    teamRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((team: Partial<Team>) => Promise.resolve(team as Team)),
    };
    playerRepo = {
      count: jest.fn().mockResolvedValue(0),
    };
    dataSource = {
      getRepository: jest.fn(),
    };

    service = new AdminTeamsService(
      teamRepo as never,
      playerRepo as never,
      dataSource as never,
    );
  });

  describe('listTeams', () => {
    it('returns formatted team rows with aggregate player count', async () => {
      const mockRows = [
        {
          id: 'team-1',
          name: 'P15 Blå',
          inviteCode: 'P15BLA',
          isTest: false,
          createdAt: new Date('2026-09-01T10:00:00Z'),
          playerCount: '12',
        },
        {
          id: 'team-2',
          name: 'Testlag Dev',
          inviteCode: 'TESTDEV',
          isTest: true,
          createdAt: new Date('2026-09-05T10:00:00Z'),
          playerCount: '3',
        },
      ];

      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockRows),
      };

      const countQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
      };

      teamRepo.createQueryBuilder
        .mockReturnValueOnce(qb)
        .mockReturnValueOnce(countQb);

      const result = await service.listTeams({ limit: 10, offset: 0 });

      expect(result.total).toBe(2);
      expect(result.teams).toHaveLength(2);
      expect(result.teams[0]).toEqual({
        id: 'team-1',
        name: 'P15 Blå',
        inviteCode: 'P15BLA',
        isTest: false,
        playerCount: 12,
        createdAt: '2026-09-01T10:00:00.000Z',
      });
      expect(result.teams[1].isTest).toBe(true);
    });

    it('filters by isTest query parameter', async () => {
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      const countQb = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };

      teamRepo.createQueryBuilder
        .mockReturnValueOnce(qb)
        .mockReturnValueOnce(countQb);

      await service.listTeams({ isTest: true });

      expect(qb.where).toHaveBeenCalledWith('team.is_test = :isTest', {
        isTest: true,
      });
      expect(countQb.where).toHaveBeenCalledWith('team.is_test = :isTest', {
        isTest: true,
      });
    });
  });

  describe('setTestFlag (Juridik A2 compliance)', () => {
    it('sets isTest = true when team has no approved parental consent', async () => {
      const team = {
        id: 'team-uuid',
        name: 'Intern Testgrupp',
        inviteCode: 'TEST01',
        isTest: false,
        createdAt: new Date('2026-09-10T12:00:00Z'),
      };
      teamRepo.findOne.mockResolvedValue(team);
      playerRepo.count
        .mockResolvedValueOnce(0) // assertTeamEligibleForTestTreatment (approvedCount)
        .mockResolvedValueOnce(4); // playerCount after update

      const consentRecordQb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      dataSource.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(consentRecordQb),
      });

      const updated = await service.setTestFlag('team-uuid', true);

      expect(updated.isTest).toBe(true);
      expect(teamRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isTest: true }),
      );
      expect(updated.playerCount).toBe(4);
    });

    it('blocks setting isTest = true if team has player with APPROVED parental consent', async () => {
      const team = {
        id: 'team-child',
        name: 'F13 Röd',
        inviteCode: 'F13ROD',
        isTest: false,
        createdAt: new Date('2026-09-10T12:00:00Z'),
      };
      teamRepo.findOne.mockResolvedValue(team);
      playerRepo.count.mockResolvedValue(1); // 1 player with approved consent

      await expect(service.setTestFlag('team-child', true)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.setTestFlag('team-child', true)).rejects.toThrow(
        'Laget innehåller spelare med godkänt föräldrasamtycke och kan inte markeras som testlag.',
      );
      expect(teamRepo.save).not.toHaveBeenCalled();
    });

    it('blocks setting isTest = true if team has parental_consent_record entry', async () => {
      const team = {
        id: 'team-child-2',
        name: 'P14 Svart',
        inviteCode: 'P14SVT',
        isTest: false,
        createdAt: new Date('2026-09-10T12:00:00Z'),
      };
      teamRepo.findOne.mockResolvedValue(team);
      playerRepo.count.mockResolvedValue(0); // 0 in player repo status

      const consentRecordQb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1), // 1 consent record in table
      };
      dataSource.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(consentRecordQb),
      });

      await expect(service.setTestFlag('team-child-2', true)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.setTestFlag('team-child-2', true)).rejects.toThrow(
        'Laget innehåller spelare med tidigare registrerat föräldrasamtycke (arkiv) och kan inte markeras som testlag.',
      );
      expect(teamRepo.save).not.toHaveBeenCalled();
    });

    it('allows unflagging a test team (isTest = false) without checking child consent', async () => {
      const team = {
        id: 'team-test',
        name: 'Återställt Lag',
        inviteCode: 'RESTORE',
        isTest: true,
        createdAt: new Date('2026-09-10T12:00:00Z'),
      };
      teamRepo.findOne.mockResolvedValue(team);
      playerRepo.count.mockResolvedValueOnce(2); // playerCount after update

      const updated = await service.setTestFlag('team-test', false);

      expect(updated.isTest).toBe(false);
      expect(teamRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isTest: false }),
      );
    });

    it('throws NotFoundException if team does not exist', async () => {
      teamRepo.findOne.mockResolvedValue(null);

      await expect(service.setTestFlag('missing-team', true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
