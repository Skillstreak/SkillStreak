import { randomInt } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
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
 * k-anonymity floor (ADR-0039): a sport lists no names, and its level stays
 * CALM, until at least this many OTHER opted-in, non-test teams share it.
 */
export const VILLAGE_K_THRESHOLD = 10;
/** Most names one sport card shows; the rest still count toward the level. */
export const VILLAGE_MAX_ARENAS_PER_SPORT = 25;
/** "Training now" window for the coarse level. */
export const VILLAGE_ACTIVITY_WINDOW_MS = 3 * 60 * 60 * 1000;

export interface VillageViewer {
  teamId: string;
  /** The captain with approved own consent — may toggle the opt-in. */
  canManage: boolean;
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
    const ownTeam = await this.teamRepository.findOneOrFail({
      where: { id: viewer.teamId },
    });

    // Only opted-in, non-test teams other than the viewer's own ever leave
    // the database for this endpoint. `select` keeps it to what we use.
    const others = await this.teamRepository.find({
      select: { id: true, name: true, sport: true },
      where: {
        villageOptIn: true,
        isTest: false,
        id: Not(viewer.teamId),
      },
    });

    const activeTeamIds = await this.findRecentlyActiveTeamIds(
      others.map((t) => t.id),
      new Date(now.getTime() - VILLAGE_ACTIVITY_WINDOW_MS),
    );

    // Reciprocal: a team that has not opted in sees no other team's name.
    const viewerMaySeeNames = ownTeam.villageOptIn && !ownTeam.isTest;

    const sports: VillageSport[] = VILLAGE_SPORTS.map((sport) => {
      const inSport = others.filter((t) => t.sport === sport);
      if (inSport.length < VILLAGE_K_THRESHOLD) {
        return { sport, level: 'CALM', arenas: [] };
      }
      const activeCount = inSport.filter((t) => activeTeamIds.has(t.id)).length;
      const arenas: VillageArena[] = viewerMaySeeNames
        ? shuffle(inSport)
            .slice(0, VILLAGE_MAX_ARENAS_PER_SPORT)
            .map((team, index) => ({
              slot: `s${index + 1}`,
              name: villageTeamName(team),
            }))
        : [];
      return { sport, level: levelFor(activeCount), arenas };
    });

    return {
      generatedAt: roundDownToQuarterHour(now).toISOString(),
      ownArena: {
        sport: ownTeam.sport,
        name: ownTeam.name,
        optedIn: ownTeam.villageOptIn,
        canManage: viewer.canManage,
      },
      sports,
    };
  }

  /** Captain-only; the caller has already run assertIsCaptainOfTeam. */
  async setOptIn(teamId: string, optedIn: boolean): Promise<void> {
    await this.teamRepository.update({ id: teamId }, { villageOptIn: optedIn });
  }

  private async findRecentlyActiveTeamIds(
    teamIds: string[],
    since: Date,
  ): Promise<Set<string>> {
    if (teamIds.length === 0) return new Set();
    // Server-side `created_at`, not the client-supplied `logged_at`.
    const rows = await this.trainingLogRepository
      .createQueryBuilder('e')
      .select('DISTINCT e.team_id', 'teamId')
      .where({ teamId: In(teamIds) })
      .andWhere('e.created_at >= :since', { since })
      .getRawMany<{ teamId: string }>();
    return new Set(rows.map((r) => r.teamId));
  }
}

/**
 * Number of other opted-in teams with any training logged in the window,
 * bucketed. Only called once a sport has passed the k threshold, so even
 * SOME (1–2 teams) is "one or two of at least ten", never "that team".
 */
export function levelFor(activeTeams: number): VillageLevel {
  if (activeTeams <= 0) return 'CALM';
  if (activeTeams <= 2) return 'SOME';
  if (activeTeams <= 5) return 'MANY';
  return 'VERY_MANY';
}

function roundDownToQuarterHour(date: Date): Date {
  const d = new Date(date.getTime());
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 15) * 15, 0, 0);
  return d;
}

/** Fisher–Yates; fresh order per response so slot order carries nothing
 * (not creation order, not activity). */
function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
