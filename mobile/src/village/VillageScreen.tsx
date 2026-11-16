import { FlatList, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { SportArenaCard, type SportArenaCardLabels } from './SportArenaCard';
import { sportKey, type VillageSport, type VillageView } from './villageTypes';

export interface VillageScreenLabels {
  title: string;
  /** Short line about what the village shows: team names and sport only. */
  intro: string;
  /** Own team's arena heading, e.g. "Ditt lag". */
  ownHeading: string;
  /** Translated card texts for one sport. */
  cardLabels: (sport: VillageSport) => SportArenaCardLabels;
}

interface VillageScreenProps {
  view: VillageView;
  labels: VillageScreenLabels;
}

/**
 * The scrollable village (I-004), first level: a vertical list of arena
 * cards, one per sport. FlatList, not ScrollView: it only mounts the cards
 * near the screen, which keeps memory down on old phones.
 *
 * Presentational and not wired into navigation: the data call, the feature
 * flag and the i18n strings are the next step (see the spec). The screen
 * takes its text and data as props and holds no state, so it can never
 * keep anything about a team or a child.
 */
export function VillageScreen({ view, labels }: VillageScreenProps) {
  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={view.sports}
      keyExtractor={(item) => item.sport}
      initialNumToRender={3}
      windowSize={5}
      removeClippedSubviews
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {labels.title}
          </Text>
          <Text style={styles.intro}>{labels.intro}</Text>
          {view.ownArena ? (
            <View style={styles.own}>
              <Text style={styles.ownHeading}>{labels.ownHeading}</Text>
              <Text style={styles.ownName} numberOfLines={1}>
                {view.ownArena.name}
              </Text>
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <SportArenaCard
          sport={sportKey(item.sport)}
          level={item.level}
          arenas={item.arenas}
          labels={labels.cardLabels(item)}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32 },
  header: { gap: 8, marginBottom: 16 },
  title: { fontFamily: fonts.headingBold, fontSize: 28, color: colors.ink },
  intro: { fontFamily: fonts.body, fontSize: 15, color: colors.textBody },
  own: {
    backgroundColor: colors.goldRowTint,
    borderColor: colors.goldRowBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
  ownHeading: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.goldText },
  ownName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  gap: { height: 12 },
});
