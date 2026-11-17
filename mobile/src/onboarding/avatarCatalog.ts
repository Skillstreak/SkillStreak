import type { ImageSourcePropType } from 'react-native';

/**
 * The avatar catalog (Screen O3).
 *
 * Originally 12 kid-friendly emoji. Since 2026-08-10 most entries carry
 * real character art (`brand/avatars/`, sliced from the project owner's
 * sample sheet), rendered by `<Avatar>` — which falls back to `emoji` for
 * any entry without an image.
 *
 * **`emoji` is not decoration and must not be removed.** Two of the
 * original twelve ids still have no matching art, and players already
 * have those ids stored on their accounts:
 *
 * - `shark` — the sheet has a dolphin. A different animal.
 * - `robot` — the sheet has a human racing driver. Also not the same.
 *
 * `owl` was a third until 2026-09-15, when the project owner supplied a
 * render of the same tennis-playing owl in its normal state rather than
 * the sheet's selected-on-peach tile. Same character, so the id keeps
 * meaning what it always meant.
 *
 * Remapping any of those to the nearest-looking art would silently change
 * what an existing player's avatar *is*, which is their identity in the
 * app rather than a rendering detail. They keep their emoji until art
 * exists for them specifically.
 *
 * `require` calls are literal on purpose: React Native's bundler resolves
 * image paths statically, so a computed path does not work.
 */
export interface AvatarOption {
  avatarId: string;
  /** Fallback, and the only representation for ids without art. */
  emoji: string;
  /** Character art, when this id has some. */
  image?: ImageSourcePropType;
}

export const AVATAR_CATALOG: AvatarOption[] = [
  // --- the original twelve, ids unchanged so no stored avatar breaks ---
  {
    avatarId: 'fox',
    emoji: '🦊',
    image: require('../../assets/avatars/fox.png') as ImageSourcePropType,
  },
  {
    avatarId: 'wolf',
    emoji: '🐺',
    image: require('../../assets/avatars/wolf.png') as ImageSourcePropType,
  },
  {
    avatarId: 'owl',
    emoji: '🦉',
    image: require('../../assets/avatars/owl.png') as ImageSourcePropType,
  },
  {
    avatarId: 'lion',
    emoji: '🦁',
    image: require('../../assets/avatars/lion.png') as ImageSourcePropType,
  },
  {
    avatarId: 'bear',
    emoji: '🐻',
    image: require('../../assets/avatars/bear.png') as ImageSourcePropType,
  },
  {
    avatarId: 'eagle',
    emoji: '🦅',
    image: require('../../assets/avatars/eagle.png') as ImageSourcePropType,
  },
  {
    avatarId: 'tiger',
    emoji: '🐯',
    image: require('../../assets/avatars/tiger.png') as ImageSourcePropType,
  },
  // No art — the sheet has a dolphin, which is a different animal.
  { avatarId: 'shark', emoji: '🦈' },
  {
    avatarId: 'dragon',
    emoji: '🐉',
    image: require('../../assets/avatars/dragon.png') as ImageSourcePropType,
  },
  {
    avatarId: 'panda',
    emoji: '🐼',
    image: require('../../assets/avatars/panda.png') as ImageSourcePropType,
  },
  {
    avatarId: 'unicorn',
    emoji: '🦄',
    image: require('../../assets/avatars/unicorn.png') as ImageSourcePropType,
  },
  // No art — the sheet has a human racing driver, not a robot.
  { avatarId: 'robot', emoji: '🤖' },

  // --- new characters, all with art -----------------------------------
  {
    avatarId: 'dolphin',
    emoji: '🐬',
    image: require('../../assets/avatars/dolphin.png') as ImageSourcePropType,
  },
  {
    avatarId: 'racer',
    emoji: '🏎️',
    image: require('../../assets/avatars/racer.png') as ImageSourcePropType,
  },
  {
    avatarId: 'moose',
    emoji: '🫎',
    image: require('../../assets/avatars/moose.png') as ImageSourcePropType,
  },
  {
    avatarId: 'hare',
    emoji: '🐰',
    image: require('../../assets/avatars/hare.png') as ImageSourcePropType,
  },
  {
    avatarId: 'swan',
    emoji: '🦢',
    image: require('../../assets/avatars/swan.png') as ImageSourcePropType,
  },
  {
    avatarId: 'lynx',
    emoji: '🐆',
    image: require('../../assets/avatars/lynx.png') as ImageSourcePropType,
  },
  {
    avatarId: 'gorilla',
    emoji: '🦍',
    image: require('../../assets/avatars/gorilla.png') as ImageSourcePropType,
  },
  {
    avatarId: 'cheetah',
    emoji: '🐅',
    image: require('../../assets/avatars/cheetah.png') as ImageSourcePropType,
  },
  {
    avatarId: 'kangaroo',
    emoji: '🦘',
    image: require('../../assets/avatars/kangaroo.png') as ImageSourcePropType,
  },
  {
    avatarId: 'otter',
    emoji: '🦦',
    image: require('../../assets/avatars/otter.png') as ImageSourcePropType,
  },
  {
    avatarId: 'raccoon',
    emoji: '🦝',
    image: require('../../assets/avatars/raccoon.png') as ImageSourcePropType,
  },
  {
    avatarId: 'seal',
    emoji: '🦭',
    image: require('../../assets/avatars/seal.png') as ImageSourcePropType,
  },
  {
    avatarId: 'badger',
    emoji: '🦡',
    image: require('../../assets/avatars/badger.png') as ImageSourcePropType,
  },
  {
    avatarId: 'horse',
    emoji: '🐴',
    image: require('../../assets/avatars/horse.png') as ImageSourcePropType,
  },
];

/** Single lookup, so no call site re-implements the `.find()` + fallback. */
export function avatarOptionFor(avatarId: string | null | undefined) {
  return AVATAR_CATALOG.find((option) => option.avatarId === avatarId);
}

/**
 * Sport mascots for the sport village, "Sportbyn" (I-004) - NOT player avatars.
 *
 * A mascot is the face of a sport's arena in the village. It is the same
 * for every team, says nothing about any player, and is never stored on an
 * account. That is why these are a separate list and not part of
 * `AVATAR_CATALOG`: adding them there would put them in the O3 picker
 * (founder decision 2026-10-20: the existing avatars are enough for now)
 * and `owl_tennis` would sit next to `owl`, the same tennis owl.
 *
 * The art is square with a transparent background (the original portrait or
 * landscape art is fitted into the square, not cropped), so it must NOT go
 * through `<Avatar>` (white, round). Use `<SportMascot>`.
 *
 * `sport` is a plain string key, not the backend enum: the enum (spec I-004
 * v3 section 4) so far has FLOORBALL, FOOTBALL and HANDBALL only. A sport
 * without a mascot gets a neutral placeholder; a mascot whose sport the
 * backend does not know yet is simply never shown.
 *
 * `require` calls are literal for the same reason as above. The files are
 * `<id>.png` (256 px) with a sibling `<id>@2x.png` (512 px) in
 * `mobile/assets/avatars/mascots/`; Metro picks the size by itself. The
 * bundle fails if one of the 20 files is missing.
 */
export interface SportMascot {
  /** Lower-case backend sport value, underscores for spaces. */
  sport: string;
  mascotId: string;
  image: ImageSourcePropType;
}

export const SPORT_MASCOTS: SportMascot[] = [
  {
    sport: 'rugby',
    mascotId: 'bear_rugby',
    image: require('../../assets/avatars/mascots/bear_rugby.png') as ImageSourcePropType,
  },
  {
    sport: 'skiing',
    mascotId: 'eagle_skiing',
    image: require('../../assets/avatars/mascots/eagle_skiing.png') as ImageSourcePropType,
  },
  {
    sport: 'floorball',
    mascotId: 'hare_floorball',
    image: require('../../assets/avatars/mascots/hare_floorball.png') as ImageSourcePropType,
  },
  {
    sport: 'volleyball',
    mascotId: 'kangaroo_volleyball',
    image: require('../../assets/avatars/mascots/kangaroo_volleyball.png') as ImageSourcePropType,
  },
  {
    sport: 'basketball',
    mascotId: 'lion_basketball',
    image: require('../../assets/avatars/mascots/lion_basketball.png') as ImageSourcePropType,
  },
  {
    sport: 'ice_hockey',
    mascotId: 'moose_hockey',
    image: require('../../assets/avatars/mascots/moose_hockey.png') as ImageSourcePropType,
  },
  {
    sport: 'rowing',
    mascotId: 'otter_rowing',
    image: require('../../assets/avatars/mascots/otter_rowing.png') as ImageSourcePropType,
  },
  {
    sport: 'tennis',
    mascotId: 'owl_tennis',
    image: require('../../assets/avatars/mascots/owl_tennis.png') as ImageSourcePropType,
  },
  {
    sport: 'skateboard',
    mascotId: 'panda_skateboard',
    image: require('../../assets/avatars/mascots/panda_skateboard.png') as ImageSourcePropType,
  },
  {
    sport: 'golf',
    mascotId: 'raccoon_golf',
    image: require('../../assets/avatars/mascots/raccoon_golf.png') as ImageSourcePropType,
  },
];

/** Lookup by sport key; undefined means "no mascot, show the placeholder". */
export function sportMascotFor(sport: string | null | undefined) {
  return SPORT_MASCOTS.find((mascot) => mascot.sport === sport);
}
