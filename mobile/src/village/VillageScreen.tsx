import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { getVillage, setVillageOptIn } from '../api/endpoints';
import { LoadingOrRetry } from '../components/LoadingOrRetry';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { SportArenaCard, type SportArenaCardLabels } from './SportArenaCard';
import { sportKey, type VillageSport, type VillageView } from './villageTypes';
import { useVillageLabels } from './useVillageLabels';

export interface VillageOptInLabels {
  onTitle: string;
  onBody: string;
  offTitle: string;
  offBodyCaptain: string;
  offBodyPlayer: string;
  turnOn: string;
  turnOff: string;
  confirmTitle: string;
  confirmBody: string;
  confirmYes: string;
  cancel: string;
  error: string;
}

export interface VillageScreenLabels {
  title: string;
  /** Short line about what the village shows: team names and sport only. */
  intro: string;
  /** Own team's arena heading, e.g. "Ditt lag". */
  ownHeading: string;
  /** Translated card texts for one sport. */
  cardLabels: (sport: VillageSport) => SportArenaCardLabels;
  backButton: string;
  loadError: string;
  retry: string;
  trainNowTitle: string;
  trainNowBody: string;
  trainNowCta: string;
  optIn: VillageOptInLabels;
  /** Shown only on the owner preview: the other teams are made up. */
  previewBanner: string;
}

export interface VillageScreenProps {
  alreadyLoggedToday: boolean;
  onBack: () => void;
  /** Opens the existing activity sheet / one-tap clock (ADR-0038); the
   * village has no clock of its own. */
  onTrainNow: () => void;
}

/**
 * Skillstreak Village (I-004, docs/adr/0040): the team's own arena plus
 * other opted-in teams' arenas, one card per sport.
 *
 * Fetches on open and on pull-to-refresh only. Deliberately keeps no copy
 * of the response on the device: another team's name should disappear the
 * moment that team leaves the village, not live on in a cache.
 *
 * Team names are plain text with no press handler — there is no road from
 * here to any other team, player, clip or chat.
 */
export function VillageScreen({ alreadyLoggedToday, onBack, onTrainNow }: VillageScreenProps) {
  const labels = useVillageLabels();
  const [view, setView] = useState<VillageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadFailed(false);
    try {
      setView(await getVillage());
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const applyOptIn = useCallback(
    async (optedIn: boolean) => {
      setSaving(true);
      setSaveFailed(false);
      try {
        await setVillageOptIn(optedIn);
        await load(true);
      } catch {
        setSaveFailed(true);
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const confirmOptIn = useCallback(() => {
    Alert.alert(labels.optIn.confirmTitle, labels.optIn.confirmBody, [
      { text: labels.optIn.cancel, style: 'cancel' },
      { text: labels.optIn.confirmYes, onPress: () => void applyOptIn(true) },
    ]);
  }, [applyOptIn, labels.optIn]);

  const backButton = (
    <Pressable
      onPress={onBack}
      accessibilityRole="button"
      accessibilityLabel={labels.backButton}
      style={styles.backButton}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.backButtonText}>{labels.backButton}</Text>
    </Pressable>
  );

  if (!view) {
    return (
      <View style={styles.loadingContainer}>
        {backButton}
        <LoadingOrRetry
          loading={loading}
          spinnerColor={colors.gold}
          errorMessage={loadFailed ? labels.loadError : undefined}
          retryLabel={labels.retry}
          onRetry={() => void load(false)}
        />
      </View>
    );
  }

  const own = view.ownArena;
  const optIn = labels.optIn;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={view.sports}
      keyExtractor={(item) => item.sport}
      initialNumToRender={3}
      windowSize={5}
      removeClippedSubviews
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor={colors.gold}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          {backButton}
          <Text style={styles.title} accessibilityRole="header">
            {labels.title}
          </Text>
          <Text style={styles.intro}>{labels.intro}</Text>
          {view.preview ? (
            <View style={styles.previewBanner}>
              <Text style={styles.previewBannerText}>{labels.previewBanner}</Text>
            </View>
          ) : null}

          <View style={styles.own}>
            <Text style={styles.ownHeading}>{labels.ownHeading}</Text>
            <Text style={styles.ownName} numberOfLines={1}>
              {own.name}
            </Text>
            <Text style={styles.optInTitle}>{own.optedIn ? optIn.onTitle : optIn.offTitle}</Text>
            <Text style={styles.optInBody}>
              {own.optedIn
                ? optIn.onBody
                : own.canManage
                  ? optIn.offBodyCaptain
                  : optIn.offBodyPlayer}
            </Text>
            {own.canManage ? (
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={own.optedIn ? () => void applyOptIn(false) : confirmOptIn}
                style={({ pressed }) => [
                  own.optedIn ? styles.secondaryButton : styles.primaryButton,
                  (pressed || saving) && styles.pressed,
                ]}
              >
                <Text style={own.optedIn ? styles.secondaryButtonText : styles.primaryButtonText}>
                  {own.optedIn ? optIn.turnOff : optIn.turnOn}
                </Text>
              </Pressable>
            ) : null}
            {saveFailed ? <Text style={styles.error}>{optIn.error}</Text> : null}
          </View>

          {!alreadyLoggedToday ? (
            <View style={styles.trainNowBanner}>
              <Text style={styles.trainNowTitle}>{labels.trainNowTitle}</Text>
              <Text style={styles.trainNowBody}>{labels.trainNowBody}</Text>
              <Pressable
                onPress={onTrainNow}
                style={styles.trainNowButton}
                accessibilityRole="button"
              >
                <Text style={styles.trainNowButtonText}>{labels.trainNowCta}</Text>
              </Pressable>
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
  content: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 32 },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: 24,
    paddingTop: 56,
    gap: 24,
  },
  header: { gap: 12, marginBottom: 16 },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  title: { fontFamily: fonts.headingBold, fontSize: 28, color: colors.ink },
  intro: { fontFamily: fonts.body, fontSize: 15, color: colors.textBody },
  previewBanner: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    borderRadius: 12,
    padding: 12,
  },
  previewBannerText: { fontFamily: fonts.body, fontSize: 14, color: colors.textBody },
  own: {
    backgroundColor: colors.goldRowTint,
    borderColor: colors.goldRowBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  ownHeading: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.goldText },
  ownName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  optInTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginTop: 6 },
  optInBody: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textBody },
  primaryButton: {
    height: 40,
    backgroundColor: colors.flame,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  secondaryButton: {
    height: 40,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  secondaryButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  pressed: { opacity: 0.7 },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.flameText },
  trainNowBanner: {
    backgroundColor: colors.flameTint,
    borderColor: colors.flame,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  trainNowTitle: { fontFamily: fonts.headingBold, fontSize: 15, color: colors.flameText },
  trainNowBody: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink },
  trainNowButton: {
    height: 40,
    backgroundColor: colors.flame,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  trainNowButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  gap: { height: 12 },
});
