import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ParentalConsentStatus } from '../players/player-consent-status.enum';
import { TeamJoinStatus } from '../players/team-join-status.enum';
import { Team } from '../teams/entities/team.entity';
import { TrainingLogEntry } from '../training-logs/entities/training-log-entry.entity';
import { villageTeamName } from './village-team-name.util';
import {
  VILLAGE_SPORTS,
  type VillageArena,
  type VillageLevel,
  type VillageSport,
  type VillageView,
} from './village.types';

/**
 * k-anonymity floor (ADR-0040): a sport lists no names, and its level stays
 * CALM, until at least this many OTHER qualifying teams share it.
 */
export const VILLAGE_K_THRESHOLD = 10;
/**
 * Names listed per sport once k is met. Equal to k on purpose: the list is
 * always exactly this long, so its length says nothing about how many teams
 * are in the village or when one joins or leaves.
 */
export const VILLAGE_ARENAS_PER_SPORT = VILLAGE_K_THRESHOLD;
/** "Training recently" window for the coarse level. */
export const VILLAGE_ACTIVITY_WINDOW_MS = 3 * 60 * 60 * 1000;
/** Everything time-dependent is computed per quarter-hour bucket. */
export const VILLAGE_BUCKET_MS = 15 * 60 * 1000;
/**
 * A team only qualifies (counts toward k and the level, and can be
 * listed) with at least this many members whose team join AND parental
 * consent are approved, and once it is this old. Both raise the cost of
 * padding a sport with throwaway teams to defeat k (ADR-0040 Decision 5).
 */
export const VILLAGE_MIN_QUALIFIED_MEMBERS = 5;
export const VILLAGE_MIN_TEAM_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export interface VillageViewer {
  teamId: string;
  /** The captain with approved own consent — may toggle the opt-in. */
  canManage: boolean;
}

interface QualifiedTeamRow {
  id: string;
  name: string;
  sport: string;
}

@Injectable()
export class VillageService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TrainingLogEntry)
    private readonly trainingLogRepository: Repository<TrainingLogEntry>,
  ) {}

  async getVillageView(
    viewer: VillageViewer,
    now: Date = new Date(),
  ): Promise<VillageView> {
    const bucketStart = new Date(
      Math.floor(now.getTime() / VILLAGE_BUCKET_MS) * VILLAGE_BUCKET_MS,
    );

    const ownTeam = await this.teamRepository.findOneOrFail({
      where: { id: viewer.teamId },
    });

    // Reciprocal and symmetric: the viewer's own team must pass the same
    // qualification as the teams it would see (opted in, not test, old
    // enough, enough approved members). Otherwise it gets neither names
    // nor levels — nothing derived from another team crosses to it.
    const viewerIsIn =
      ownTeam.villageOptIn &&
      !ownTeam.isTest &&
      (await this.teamQualifies(viewer.teamId, bucketStart));

    const sports: VillageSport[] = viewerIsIn
      ? await this.buildSports(viewer.teamId, bucketStart)
      : VILLAGE_SPORTS.map((sport) => ({ sport, level: 'CALM', arenas: [] }));

    return {
      generatedAt: bucketStart.toISOString(),
      ownArena: {
        sport: ownTeam.sport,
        name: ownTeam.name,
        optedIn: ownTeam.villageOptIn,
        canManage: viewer.canManage,
      },
      sports,
    };
  }

  /**
   * Captain-only; the caller has already run assertIsCaptainOfTeam.
   * Records who changed it and when, so "who turned this on?" has an
   * answer.
   */
  async setOptIn(
    teamId: string,
    optedIn: boolean,
    changedByPlayerId: string,
    now: Date = new Date(),
  ): Promise<void> {
    await this.teamRepository.update(
      { id: teamId },
      {
        villageOptIn: optedIn,
        villageOptInChangedAt: now,
        villageOptInChangedBy: changedByPlayerId,
      },
    );
  }

  private async buildSports(
    viewerTeamId: string,
    bucketStart: Date,
  ): Promise<VillageSport[]> {
    const others = await this.findQualifiedOtherTeams(
      viewerTeamId,
      bucketStart,
    );
    // Window ends at the bucket start, not "now": within one quarter hour
    // every request sees the same answer, so polling cannot time a team.
    const activeTeamIds = await this.findActiveTeamIds(
      others.map((t) => t.id),
      new Date(bucketStart.getTime() - VILLAGE_ACTIVITY_WINDOW_MS),
      bucketStart,
    );

    return VILLAGE_SPORTS.map((sport) => {
      const inSport = others.filter((t) => t.sport === sport);
      if (inSport.length < VILLAGE_K_THRESHOLD) {
        return { sport, level: 'CALM', arenas: [] };
      }
      const activeCount = inSport.filter((t) => activeTeamIds.has(t.id)).length;
      const arenas: VillageArena[] = bucketOrder(inSport, bucketStart)
        .slice(0, VILLAGE_ARENAS_PER_SPORT)
        .map((team, index) => ({
          slot: `s${index + 1}`,
          name: villageTeamName(team),
        }));
      return { sport, level: levelFor(activeCount), arenas };
    });
  }

  /** Qualifying teams other than the viewer's. Selects only id, name, sport. */
  private findQualifiedOtherTeams(
    viewerTeamId: string,
    bucketStart: Date,
  ): Promise<QualifiedTeamRow[]> {
    return this.qualifiedTeamsQuery(bucketStart)
      .andWhere('t.id <> :viewerTeamId', { viewerTeamId })
      .getRawMany<QualifiedTeamRow>();
  }

  private async teamQualifies(
    teamId: string,
    bucketStart: Date,
  ): Promise<boolean> {
    const rows = await this.qualifiedTeamsQuery(bucketStart)
      .andWhere('t.id = :teamId', { teamId })
      .getRawMany<QualifiedTeamRow>();
    return rows.length > 0;
  }

  /** The one definition of a qualifying team (ADR-0040 Decision 5). */
  private qualifiedTeamsQuery(bucketStart: Date) {
    return (
      this.teamRepository
        .createQueryBuilder('t')
        .select('t.id', 'id')
        .addSelect('t.name', 'name')
        .addSelect('t.sport', 'sport')
        .where('t.village_opt_in = true')
        .andWhere('t.is_test = false')
        .andWhere('t.created_at <= :createdBefore', {
          createdBefore: new Date(
            bucketStart.getTime() - VILLAGE_MIN_TEAM_AGE_MS,
          ),
        })
        // ADR-0040: approved members with DISTINCT parent contacts. Reads
        // only the keyed blind index from player_private_info (never the
        // address); a member whose index is NULL does not count.
        .andWhere(
          `(SELECT COUNT(DISTINCT ppi.parent_contact_index)
            FROM "player" p
            JOIN "player_private_info" ppi ON ppi.player_id = p.id
           WHERE p.team_id = t.id
             AND p.team_join_status = :joinApproved
             AND p.parental_consent_status = :consentApproved) >= :minMembers`,
          {
            joinApproved: TeamJoinStatus.APPROVED,
            consentApproved: ParentalConsentStatus.APPROVED,
            minMembers: VILLAGE_MIN_QUALIFIED_MEMBERS,
          },
        )
    );
  }

  private async findActiveTeamIds(
    teamIds: string[],
    since: Date,
    until: Date,
  ): Promise<Set<string>> {
    if (teamIds.length === 0) return new Set();
    // Server-side `created_at`, not the client-supplied `logged_at`.
    const rows = await this.trainingLogRepository
      .createQueryBuilder('e')
      .select('DISTINCT e.team_id', 'teamId')
      .where({ teamId: In(teamIds) })
      .andWhere('e.created_at >= :since', { since })
      .andWhere('e.created_at < :until', { until })
      .getRawMany<{ teamId: string }>();
    return new Set(rows.map((r) => r.teamId));
  }
}

/**
 * Number of other qualifying teams with any training logged in the window,
 * bucketed. Only called once a sport has passed the k threshold.
 */
export function levelFor(activeTeams: number): VillageLevel {
  if (activeTeams <= 0) return 'CALM';
  if (activeTeams <= 2) return 'SOME';
  if (activeTeams <= 5) return 'MANY';
  return 'VERY_MANY';
}

/**
 * Order (and so the sample of names) fixed for the whole quarter-hour
 * bucket, by a hash of the bucket and the team id: not creation order, not
 * activity, and the same on every request within the bucket, so polling
 * does not reveal more names or the team count. The id itself never
 * leaves the server.
 */
function bucketOrder<T extends { id: string }>(
  items: T[],
  bucketStart: Date,
): T[] {
  const key = (id: string) =>
    createHash('sha256')
      .update(`${bucketStart.toISOString()}:${id}`)
      .digest('hex');
  return items
    .map((item) => ({ item, k: key(item.id) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map(({ item }) => item);
}
