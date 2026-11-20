import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { SportArenaCardLabels } from './SportArenaCard';
import type { VillageScreenLabels } from './VillageScreen';
import type { VillageSport } from './villageTypes';
import { VILLAGE_NAME, arenaNameKey, levelKey, neutralSportName } from './villageLabels';

/** Narrow view of i18next's `t`: the village keys are built at runtime. */
type LooseT = (key: string, options?: { defaultValue?: string }) => string;

/**
 * All texts for VillageScreen, from the `village` i18n namespace
 * (`mobile/src/i18n/locales/<lng>/village.json`, which must be registered in
 * `i18n/index.ts` and `react-i18next.d.ts` first). Returns the exact
 * `VillageScreenLabels` shape, so `<VillageScreen view={...} labels={labels} />`
 * needs nothing else.
 *
 * - Level: CALM/SOME/MANY/VERY_MANY -> `village.level.*`, unknown -> calm.
 * - Sport: `arenas.<sport>.name`; without a translation a neutral name from
 *   `neutralSportName`, never the raw backend value.
 */
export function useVillageLabels(): VillageScreenLabels {
  const { t } = useTranslation('village');
  const tt = t as unknown as LooseT;

  const cardLabels = useCallback(
    (item: VillageSport): SportArenaCardLabels => {
      const key = arenaNameKey(item.sport);
      const fallback = neutralSportName(item.sport);
      const sportName = key ? tt(`arenas.${key}.name`, { defaultValue: fallback }) : fallback;
      return {
        sportName,
        levelText: tt(`village.level.${levelKey(item.level)}`),
        emptyText: tt('village.empty'),
      };
    },
    [tt],
  );

  return useMemo(
    () => ({
      title: tt('village.title', { defaultValue: VILLAGE_NAME }),
      intro: tt('village.intro'),
      ownHeading: tt('village.ownHeading'),
      cardLabels,
      backButton: tt('village.backButton'),
      loadError: tt('village.loadError'),
      retry: tt('village.retry'),
      trainNowTitle: tt('village.trainNowTitle'),
      trainNowBody: tt('village.trainNowBody'),
      trainNowCta: tt('village.trainNowCta'),
      previewBanner: tt('village.previewBanner'),
      optIn: {
        onTitle: tt('village.optIn.onTitle'),
        onBody: tt('village.optIn.onBody'),
        offTitle: tt('village.optIn.offTitle'),
        offBodyCaptain: tt('village.optIn.offBodyCaptain'),
        offBodyPlayer: tt('village.optIn.offBodyPlayer'),
        turnOn: tt('village.optIn.turnOn'),
        turnOff: tt('village.optIn.turnOff'),
        confirmTitle: tt('village.optIn.confirmTitle'),
        confirmBody: tt('village.optIn.confirmBody'),
        confirmYes: tt('village.optIn.confirmYes'),
        cancel: tt('village.optIn.cancel'),
        error: tt('village.optIn.error'),
      },
    }),
    [tt, cardLabels],
  );
}
