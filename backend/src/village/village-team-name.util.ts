import type { VillageSportCode } from './village.types';

/**
 * How another team's name is shown in Skillstreak Village (ADR-0040).
 *
 * Team names are free text typed by a child at team creation. They can
 * carry a club, a town, a birth year or a surname ("Ackers P15", "Täby
 * F13", "Svenssons gäng") — fine inside the team's own bubble, not fine
 * shown to strangers. So in the village a name is shown as typed only if
 * it is made entirely of words from the fixed name-builder vocabulary
 * (adjective + animal/hero, e.g. "Snabba Falkarna"); anything else is
 * replaced by a neutral, sport-based name.
 *
 * The decision is made on the server from the name itself, never from a
 * client-supplied "this came from the builder" flag — a client could set
 * that flag on any name.
 *
 * Ported from Hermes' displayTeamNameFor (refs/hermes/v1alpha2, d36df17),
 * reduced to the village context: the `name_status` / `is_name_builder`
 * columns and the general/match contexts are not part of this change.
 */

const APPROVED_ADJECTIVES = new Set([
  'snabba',
  'modiga',
  'gyllene',
  'smarta',
  'vilda',
  'grymma',
  'tuffa',
  'starka',
  'fina',
  'blåa',
  'blaa',
  'röda',
  'roda',
  'gröna',
  'grona',
  'vita',
  'svarta',
  'gula',
  'roliga',
  'glada',
  'hoppande',
]);

const APPROVED_NOUNS = new Set([
  'falkarna',
  'drakarna',
  'lodjuren',
  'björnarna',
  'bjornarna',
  'blixtarna',
  'blixten',
  'tigrarna',
  'vargarna',
  'örnarna',
  'ornarna',
  'hararna',
  'lejonen',
  'älgarna',
  'algarna',
  'rävarna',
  'ravarna',
  'hjältarna',
  'hjaltarna',
  'stjärnorna',
  'stjarnorna',
  'innebandyhjältarna',
  'skogsstjärnorna',
  'bollkonstnärerna',
  'klubbhjältarna',
  'arenakompisarna',
]);

/**
 * True when the name is "[adjective] [noun]" or a single approved noun,
 * using only the fixed vocabulary above. Case-insensitive; NFC-normalised so
 * a decomposed "ö" matches.
 */
function nameBuilderTokens(rawName: string): string[] | null {
  if (typeof rawName !== 'string') return null;
  const parts = rawName.normalize('NFC').trim().toLowerCase().split(/\s+/);
  if (parts.length === 1 && APPROVED_NOUNS.has(parts[0])) return parts;
  if (
    parts.length === 2 &&
    APPROVED_ADJECTIVES.has(parts[0]) &&
    APPROVED_NOUNS.has(parts[1])
  ) {
    return parts;
  }
  return null;
}

export function isNameBuilderName(rawName: string): boolean {
  return nameBuilderTokens(rawName) !== null;
}

const NEUTRAL_NAMES: Record<VillageSportCode, string> = {
  FLOORBALL: 'Klubbhjältarna',
  FOOTBALL: 'Bollkonstnärerna',
  ICE_HOCKEY: 'Puckhjältarna',
};
const DEFAULT_NEUTRAL_NAME = 'Arenakompisarna';

/**
 * Name of ANOTHER team as shown in the village. A name-builder name is
 * rebuilt from the matched vocabulary words ("SNABBA   falkarna" ->
 * "Snabba Falkarna"), so casing and whitespace can't carry anything extra.
 */
export function villageTeamName(team: { name: string; sport: string }): string {
  const tokens = nameBuilderTokens(team.name);
  if (tokens) {
    return tokens.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return NEUTRAL_NAMES[team.sport as VillageSportCode] ?? DEFAULT_NEUTRAL_NAME;
}
