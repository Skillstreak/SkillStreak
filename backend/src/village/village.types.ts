/**
 * Skillstreak Village (I-004) — response contract, ADR-0040.
 *
 * What may cross a team bubble here is exactly: another opted-in team's
 * display name (masked unless it is a name-builder name), its sport, and
 * one coarse activity level per sport. Nothing in these types identifies a
 * team or a child: no team id, no player count, no per-team time, no
 * screen name, no ranking.
 */

/** The sports a team can have. Kept in step with `chk_team_sport`. */
export const VILLAGE_SPORTS = ['FLOORBALL', 'FOOTBALL', 'ICE_HOCKEY'] as const;
export type VillageSportCode = (typeof VILLAGE_SPORTS)[number];

export type VillageLevel = 'CALM' | 'SOME' | 'MANY' | 'VERY_MANY';

export interface VillageArena {
  /** One-off per response (s1, s2, …), shuffled. Never a team id. */
  slot: string;
  /** Already passed through `villageTeamName`. */
  name: string;
}

export interface VillageSport {
  sport: VillageSportCode;
  /** Coarse "how much training is happening", never per team. */
  level: VillageLevel;
  /** Empty unless the viewer's team is opted in and the sport has at
   * least K other opted-in teams. */
  arenas: VillageArena[];
}

export interface VillageOwnArena {
  sport: VillageSportCode;
  /** The viewer's own team's chosen name — the viewer already knows it. */
  name: string;
  optedIn: boolean;
  /** True when the viewer is the captain allowed to toggle `optedIn`. */
  canManage: boolean;
}

export interface VillageView {
  generatedAt: string;
  ownArena: VillageOwnArena;
  sports: VillageSport[];
}
