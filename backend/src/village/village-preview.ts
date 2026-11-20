import {
  VILLAGE_SPORTS,
  type VillageLevel,
  type VillageSport,
} from './village.types';

/**
 * Owner preview of Skillstreak Village (ADR-0040) while it is switched off.
 *
 * Every arena here is invented in code, from the same name-builder
 * vocabulary real teams use, so the preview shows what a full village
 * looks like without reading a single other team. Nothing in this file
 * touches the database; keep it that way — the preview is the one place
 * a "village" is shown to someone while the real one is off, and it must
 * carry no real team across a bubble.
 */
const ADJECTIVES = [
  'Snabba',
  'Modiga',
  'Gyllene',
  'Smarta',
  'Vilda',
  'Grymma',
  'Tuffa',
  'Starka',
  'Blåa',
  'Röda',
  'Gröna',
  'Glada',
  'Roliga',
  'Svarta',
];
const NOUNS = [
  'Falkarna',
  'Drakarna',
  'Lodjuren',
  'Björnarna',
  'Blixtarna',
  'Tigrarna',
  'Vargarna',
  'Örnarna',
  'Lejonen',
  'Hararna',
];
const LEVELS: VillageLevel[] = ['CALM', 'SOME', 'MANY', 'VERY_MANY'];
const PREVIEW_ARENAS_PER_SPORT = 10;

/**
 * Deterministic per quarter-hour bucket, so pull-to-refresh within a
 * bucket shows the same village and the next bucket shows a new one.
 */
export function buildPreviewSports(bucketStart: Date): VillageSport[] {
  let seed = Math.floor(bucketStart.getTime() / 1000) >>> 0;
  const next = (): number => {
    // xorshift32: small, deterministic, good enough for made-up names.
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed;
  };

  return VILLAGE_SPORTS.map((sport) => {
    const names = new Set<string>();
    while (names.size < PREVIEW_ARENAS_PER_SPORT) {
      names.add(
        `${ADJECTIVES[next() % ADJECTIVES.length]} ${NOUNS[next() % NOUNS.length]}`,
      );
    }
    return {
      sport,
      level: LEVELS[next() % LEVELS.length],
      arenas: [...names].map((name, i) => ({ slot: `s${i + 1}`, name })),
    };
  });
}
