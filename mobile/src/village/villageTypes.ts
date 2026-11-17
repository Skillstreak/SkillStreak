/**
 * Shape of `GET /village` (spec I-004 v3, section 5.1). Mirrors the server
 * response and nothing more. There is deliberately no team id, no player
 * count, no timestamp per team and no screen name anywhere in it.
 */
export type VillageLevel = 'CALM' | 'SOME' | 'MANY' | 'VERY_MANY';

export interface VillageArena {
  /** One-off per response. Never a team id; do not store or log it. */
  slot: string;
  /** Already passed through `displayTeamNameFor` on the server. */
  name: string;
}

export interface VillageSport {
  /** Backend value, e.g. FLOORBALL. Mapped to a mascot key by `sportKey`. */
  sport: string;
  level: VillageLevel;
  /** Empty unless at least 10 other qualified teams exist for the sport. */
  arenas: VillageArena[];
}

export interface VillageView {
  generatedAt: string;
  ownArena: { sport: string; name: string; optedIn: boolean } | null;
  sports: VillageSport[];
}

/** Backend enum value -> lower-case mascot key (FLOORBALL -> floorball). */
export function sportKey(sport: string): string {
  return sport.toLowerCase();
}
