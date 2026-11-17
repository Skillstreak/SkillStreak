import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '../../components/PrimaryButton';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';
import { evidencePointsPreview, isClickOnlyUsedUp } from '../../api/types';
import type { ClickOnlyAllowance, EvidenceChoice } from '../../api/types';

const DURATIONS: { labelKey: 'd10' | 'd15' | 'd20' | 'd30plus'; minutes: number }[] = [
  { labelKey: 'd10', minutes: 10 },
  { labelKey: 'd15', minutes: 15 },
  { labelKey: 'd20', minutes: 20 },
  { labelKey: 'd30plus', minutes: 30 },
];

/** What a session logged afterwards can carry — the timer is not one of
 * them: it is started from the big button, never chosen after the fact. */
type AfterwardsEvidence = Exclude<EvidenceChoice, 'timer'>;

const AFTERWARDS_OPTIONS = [
  { choice: 'none', labelKey: 'none' },
  { choice: 'video', labelKey: 'video' },
  { choice: 'video_shared', labelKey: 'videoShared' },
] as const satisfies readonly { choice: AfterwardsEvidence; labelKey: string }[];

interface ActivitySheetProps {
  visible: boolean;
  loading: boolean;
  errorText?: string | null;
  /** docs/adr/0038 Decision 4 — this week's click-only allowance, or null
   * while unknown (not fetched yet, or the fetch failed). Unknown shows no
   * allowance line rather than a guess. */
  clickOnlyAllowance: ClickOnlyAllowance | null;
  onClose: () => void;
  /** The main path: start the up-counting clock, 1 point per minute. */
  onStartTimer: () => void;
  /** The fallback path: a session done without the clock running. */
  onLogAfterwards: (durationMinutes: number, evidence: AfterwardsEvidence) => void;
}

/**
 * State H2 — ADR-0038 amendment 2026-11-17 (owner): the player no longer
 * picks a kind of training or a length up front. One big button starts a
 * clock that counts up and pays 1 point per minute.
 *
 * Logging afterwards stays, behind a small link, for a child who trained
 * without starting the clock: ADR-0038 Decision 4's reason still holds — a
 * forgotten clock must not cost them their streak. It still pays x0.1 for
 * the first 3 a week and 0 after, and the row says so before the choice.
 */
export function ActivitySheet({
  visible,
  loading,
  errorText,
  clickOnlyAllowance,
  onClose,
  onStartTimer,
  onLogAfterwards,
}: ActivitySheetProps) {
  const { t } = useTranslation('home');
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [evidence, setEvidence] = useState<AfterwardsEvidence>('none');
  const [showAfterwards, setShowAfterwards] = useState(false);
  const wasVisible = useRef(visible);

  const reset = () => {
    setDurationMinutes(null);
    setEvidence('none');
    setShowAfterwards(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // The sheet is permanently mounted (`<Modal visible={sheetOpen}>`), so
  // its selection survives across opens unless explicitly cleared. A
  // successful submit closes it from the parent without `handleClose`.
  useEffect(() => {
    if (wasVisible.current && !visible) reset();
    wasVisible.current = visible;
  }, [visible]);

  const clickOnlyUsedUp = isClickOnlyUsedUp(clickOnlyAllowance);
  const clickOnlyNote = clickOnlyAllowance
    ? clickOnlyUsedUp
      ? t('activitySheet.clickOnlyUsedUp')
      : t('activitySheet.clickOnlyRemaining', {
          remaining: clickOnlyAllowance.limit - clickOnlyAllowance.used,
          limit: clickOnlyAllowance.limit,
        })
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <Text style={styles.heading}>{t('activitySheet.startHeading')}</Text>

        <View style={styles.timerStartContainer}>
          <PrimaryButton
            label={t('activitySheet.startTimerButton')}
            loading={loading && !showAfterwards}
            disabled={loading}
            onPress={onStartTimer}
          />
          <Text style={styles.timerStartHelp}>{t('activitySheet.startTimerHelp')}</Text>
        </View>

        {errorText && !showAfterwards ? <Text style={styles.error}>{errorText}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showAfterwards }}
          onPress={() => setShowAfterwards((v) => !v)}
          style={styles.manualLogToggle}
        >
          <Text style={styles.manualLogToggleText}>
            {showAfterwards
              ? t('activitySheet.hideManualLog')
              : t('activitySheet.showManualLog')}
          </Text>
        </Pressable>

        {showAfterwards ? (
          <>
            <Text style={styles.subheading}>{t('activitySheet.durationHeading')}</Text>
            <View style={styles.chipRow}>
              {DURATIONS.map((option) => {
                const selected = option.minutes === durationMinutes;
                return (
                  <Pressable
                    key={option.labelKey}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setDurationMinutes(option.minutes)}
                    style={[styles.durationChip, selected && styles.chipSelected]}
                  >
                    <Text style={styles.chipLabel}>{t(`activitySheet.durations.${option.labelKey}`)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {showAfterwards && durationMinutes !== null ? (
          <>
            <Text style={styles.subheading}>{t('activitySheet.evidenceHeading')}</Text>
            <Text style={styles.evidenceHelp}>{t('activitySheet.evidenceHelp')}</Text>
            {AFTERWARDS_OPTIONS.map((option) => {
              const selected = option.choice === evidence;
              // ADR-0025 Decision 1 — real points, shown before the choice.
              const points = evidencePointsPreview(
                durationMinutes,
                option.choice,
                clickOnlyUsedUp,
              );
              const note = option.choice === 'none' ? clickOnlyNote : null;
              return (
                <Pressable
                  key={option.choice}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setEvidence(option.choice)}
                  style={[styles.evidenceRow, selected && styles.evidenceRowSelected]}
                >
                  <View style={styles.evidenceText}>
                    <Text style={styles.evidenceLabel}>
                      {t(`activitySheet.evidence.${option.labelKey}`)}
                    </Text>
                    {note ? <Text style={styles.evidenceNote}>{note}</Text> : null}
                  </View>
                  <Text style={styles.evidencePoints}>
                    {t('activitySheet.evidencePoints', { count: points })}
                  </Text>
                </Pressable>
              );
            })}

            {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

            <PrimaryButton
              label={t('activitySheet.submit')}
              disabled={loading}
              loading={loading}
              onPress={() => onLogAfterwards(durationMinutes, evidence)}
            />
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  evidenceHelp: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.textMuted,
    marginBottom: 8,
  },
  evidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  evidenceRowSelected: {
    borderColor: colors.flame,
    backgroundColor: colors.pendingBg,
  },
  evidenceText: {
    flex: 1,
    paddingRight: 8,
    gap: 2,
  },
  evidenceLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  evidenceNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  evidencePoints: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(27,27,58,0.35)',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  heading: {
    fontFamily: fonts.headingBold,
    fontSize: 18,
    color: colors.ink,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  durationChip: {
    minWidth: '22%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingVertical: 12,
    alignItems: 'center',
  },
  chipSelected: {
    borderColor: colors.flame,
    backgroundColor: colors.flameTint,
  },
  chipLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    textAlign: 'center',
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.error,
    textAlign: 'center',
  },
  timerStartContainer: {
    gap: 6,
    marginTop: 6,
  },
  timerStartHelp: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.textMuted,
    textAlign: 'center',
  },
  manualLogToggle: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  manualLogToggleText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.textMuted,
  },
});
