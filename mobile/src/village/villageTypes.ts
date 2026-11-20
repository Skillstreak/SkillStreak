/**
 * Shape of `GET /village` (spec I-004 v3, section 5.1). Mirrors the server
 * response and nothing more. There is deliberately no team id, no player
 * count, no timestamp per team and no screen name anywhere in it.
 */
export type VillageLevel = 'CALM' | 'SOME' | 'MANY' | 'VERY_MANY';

export interface VillageArena {
  /** One-off per response. Never a team id; do not store or log it. */
  slot: string;
  /** Already masked on the server (`villageTeamName`, ADR-0040). */
  name: string;
}

export interface VillageSport {
  /** Backend value, e.g. FLOORBALL. Mapped to a mascot key by `sportKey`. */
  sport: string;
  level: VillageLevel;
  /** Empty unless the viewer's team is opted in and at least 10 other
   * opted-in teams exist for the sport. */
  arenas: VillageArena[];
}

export interface VillageView {
  generatedAt: string;
  /** Owner preview while the village is off: every other arena is made up. */
  preview?: true;
  ownArena: {
    sport: string;
    name: string;
    /** Whether the viewer's own team is in the village (default false). */
    optedIn: boolean;
    /** True for the captain allowed to change `optedIn`. */
    canManage: boolean;
  };
  sports: VillageSport[];
}

/** Backend enum value -> lower-case mascot key (FLOORBALL -> floorball). */
export function sportKey(sport: string): string {
  return sport.toLowerCase();
}
