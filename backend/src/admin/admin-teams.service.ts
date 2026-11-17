import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Player } from '../players/entities/player.entity';
import { ParentalConsentStatus } from '../players/player-consent-status.enum';
import { Team } from '../teams/entities/team.entity';
import {
  DEFAULT_ADMIN_TEAMS_PAGE_SIZE,
  ListAdminTeamsQueryDto,
} from './dto/list-admin-teams-query.dto';

export interface AdminTeamRow {
  id: string;
  name: string;
  inviteCode: string;
  isTest: boolean;
  playerCount: number; // 0–65535 (praktisk gräns för barn-lag, ingen teknisk gräns satt)
  createdAt: string;
}

export interface AdminTeamsListResponse {
  teams: AdminTeamRow[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Service for administrative team listing and manual test flag management (I-007 Steg 1).
 *
 * Strict child protection: exposes only team metadata and aggregate player count,
 * never exposing child personal data, player IDs, or parent contacts (Juridik A7).
 * Prevents flagging real child teams with approved parental consent as test teams (Juridik A2).
 */
@Injectable()
export class AdminTeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    private readonly dataSource: DataSource,
  ) {}

  async listTeams(
    query: ListAdminTeamsQueryDto,
  ): Promise<AdminTeamsListResponse> {
    const limit = query.limit ?? DEFAULT_ADMIN_TEAMS_PAGE_SIZE;
    const offset = query.offset ?? 0;

    const qb = this.teamRepository
      .createQueryBuilder('team')
      .leftJoin(Player, 'player', 'player.team_id = team.id')
      .select('team.id', 'id')
      .addSelect('team.name', 'name')
      .addSelect('team.invite_code', 'inviteCode')
      .addSelect('team.is_test', 'isTest')
      .addSelect('team.created_at', 'createdAt')
      .addSelect('COUNT(player.id)', 'playerCount')
      .groupBy('team.id')
      .addGroupBy('team.name')
      .addGroupBy('team.invite_code')
      .addGroupBy('team.is_test')
      .addGroupBy('team.created_at');

    if (query.isTest !== undefined) {
      qb.where('team.is_test = :isTest', { isTest: query.isTest });
    }

    if (query.search) {
      const searchPattern = `%${query.search.toLowerCase()}%`;
      const clause =
        '(LOWER(team.name) LIKE :search OR LOWER(team.invite_code) LIKE :search)';
      if (query.isTest !== undefined) {
        qb.andWhere(clause, { search: searchPattern });
      } else {
        qb.where(clause, { search: searchPattern });
      }
    }

    qb.orderBy('team.created_at', 'DESC');

    const countQb = this.teamRepository.createQueryBuilder('team');
    if (query.isTest !== undefined) {
      countQb.where('team.is_test = :isTest', { isTest: query.isTest });
    }
    if (query.search) {
      const searchPattern = `%${query.search.toLowerCase()}%`;
      const clause =
        '(LOWER(team.name) LIKE :search OR LOWER(team.invite_code) LIKE :search)';
      if (query.isTest !== undefined) {
        countQb.andWhere(clause, { search: searchPattern });
      } else {
        countQb.where(clause, { search: searchPattern });
      }
    }
    const total = await countQb.getCount();

    const rawRows = await qb.offset(offset).limit(limit).getRawMany<{
      id: string;
      name: string;
      inviteCode: string;
      isTest: boolean | string;
      createdAt: Date | string;
      playerCount: string | number;
    }>();

    const teams: AdminTeamRow[] = rawRows.map((r) => ({
      id: r.id,
      name: r.name,
      inviteCode: r.inviteCode,
      isTest: Boolean(r.isTest),
      playerCount: Number(r.playerCount || 0),
      createdAt: (r.createdAt instanceof Date
        ? r.createdAt
        : new Date(r.createdAt)
      ).toISOString(),
    }));

    return {
      teams,
      total,
      limit,
      offset,
    };
  }

  async setTestFlag(teamId: string, isTest: boolean): Promise<AdminTeamRow> {
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    if (isTest) {
      await this.assertTeamEligibleForTestTreatment(teamId);
    }

    team.isTest = isTest;
    await this.teamRepository.save(team);

    const playerCount = await this.playerRepository.count({
      where: { teamId },
    });

    return {
      id: team.id,
      name: team.name,
      inviteCode: team.inviteCode,
      isTest: team.isTest,
      playerCount,
      createdAt: team.createdAt.toISOString(),
    };
  }

  /**
   * Juridik A2 safeguard:
   * A team containing real child accounts with approved parental consent
   * cannot be flagged as an internal test team.
   */
  async assertTeamEligibleForTestTreatment(teamId: string): Promise<void> {
    const approvedCount = await this.playerRepository.count({
      where: {
        teamId,
        parentalConsentStatus: ParentalConsentStatus.APPROVED,
      },
    });

    if (approvedCount > 0) {
      throw new BadRequestException(
        'Laget innehåller spelare med godkänt föräldrasamtycke och kan inte markeras som testlag.',
      );
    }

    try {
      const consentRecordCount = await this.dataSource
        .getRepository('parental_consent_record')
        .createQueryBuilder('pcr')
        .innerJoin('player', 'p', 'p.id = pcr.player_id')
        .where('p.team_id = :teamId', { teamId })
        .getCount();

      if (consentRecordCount > 0) {
        throw new BadRequestException(
          'Laget innehåller spelare med tidigare registrerat föräldrasamtycke (arkiv) och kan inte markeras som testlag.',
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
    }
  }
}
