import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { SportMascot } from './SportMascot';
import type { VillageArena, VillageLevel } from './villageTypes';

export interface SportArenaCardLabels {
  /** "Fotboll", already translated. */
  sportName: string;
  /** Coarse activity wording for the level, already translated. */
  levelText: string;
  /** Shown instead of team names when `arenas` is empty. */
  emptyText: string;
}

interface SportArenaCardProps {
  sport: string;
  level: VillageLevel;
  arenas: VillageArena[];
  labels: SportArenaCardLabels;
}

/**
 * One sport's arena: mascot, sport name, a coarse level and the team names.
 * Team names are plain, non-selectable text on purpose: no link, no press
 * handler, no road to a profile. There is no team count on the card, only
 * the level the server chose.
 */
export function SportArenaCard({ sport, level, arenas, labels }: SportArenaCardProps) {
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${labels.sportName}. ${labels.levelText}`}
    >
      <View style={styles.header}>
        <SportMascot sport={sport} height={96} />
        <View style={styles.headerText}>
          <Text style={styles.sport}>{labels.sportName}</Text>
          <Text style={[styles.level, level === 'CALM' && styles.levelCalm]}>
            {labels.levelText}
          </Text>
        </View>
      </View>
      {arenas.length === 0 ? (
        <Text style={styles.empty}>{labels.emptyText}</Text>
      ) : (
        <View style={styles.names}>
          {arenas.map((arena) => (
            <Text
              key={arena.slot}
              style={styles.name}
              numberOfLines={1}
              selectable={false}
              dataDetectorType="none"
            >
              {arena.name}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerText: { flex: 1, gap: 4 },
  sport: { fontFamily: fonts.headingBold, fontSize: 20, color: colors.ink },
  level: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.goldText },
  levelCalm: { color: colors.textMuted },
  names: { gap: 6 },
  name: { fontFamily: fonts.body, fontSize: 15, color: colors.textBody },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
});
