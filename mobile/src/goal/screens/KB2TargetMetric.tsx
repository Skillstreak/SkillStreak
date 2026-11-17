import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenContainer } from '../../components/ScreenContainer';
import { PrimaryButton } from '../../components/PrimaryButton';
import { SecondaryLink } from '../../components/SecondaryLink';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';
import {
  targetMetricLabelInline,
  targetUnitForMetric,
  targetUnitLabel,
} from '../types';
import type { WeeklyGoalTargetMetric, WeeklyGoalTargetUnit } from '../../api/types';

interface KB2Props {
  initialTargetMetric: WeeklyGoalTargetMetric | null;
  initialTargetValue: number | null;
  onNext: (targetMetric: WeeklyGoalTargetMetric, targetValue: number) => void;
  onBack: () => void;
}

const UNIT_PLACEHOLDER_KEYS = {
  minutes: 'kb2.placeholderMinutes',
  sessions: 'kb2.placeholderSessions',
} as const satisfies Record<WeeklyGoalTargetUnit, string>;

/** Screen KB2 — per-player target, redesigned 2026-07-31
 * per docs/adr/0015-weekly-goal-per-player-completion.md +
 * docs/design/phase2.10-per-player-goal-flows.md: a new unit toggle
 * (minuter/pass) drives which of the 10 `WeeklyGoalTargetMetric` values
 * gets submitted, and every string is reworded from "the team's total" to
 * "each player." */
export function KB2TargetMetric({
  initialTargetMetric,
  initialTargetValue,
  onNext,
  onBack,
}: KB2Props) {
  const { t } = useTranslation('goal');

  const [selectedUnit, setSelectedUnit] = useState<WeeklyGoalTargetUnit>(
    initialTargetMetric ? targetUnitForMetric(initialTargetMetric) : 'minutes',
  );
  const [targetValueText, setTargetValueText] = useState(
    initialTargetValue !== null ? String(initialTargetValue) : '',
  );

  // ADR-0015 amendment 2026-11-17: the app no longer records what kind of
  // training a session was, so a goal can only count totals. Editing an
  // older draft set on one activity keeps its unit and becomes a total.
  const targetMetric: WeeklyGoalTargetMetric =
    selectedUnit === 'minutes' ? 'total-minuter' : 'total-pass';
  const targetValue = Number.parseInt(targetValueText, 10);
  const canSubmit = Number.isFinite(targetValue) && targetValue > 0;
  const unitLabel = targetUnitLabel(t, selectedUnit);

  // Switching units resets the numeric field — a "20" typed while
  // "Minuter" was selected shouldn't silently become "20 pass" by muscle
  // memory (the flow doc's explicit guard).
  const handleSelectUnit = (unit: WeeklyGoalTargetUnit) => {
    if (unit === selectedUnit) return;
    setSelectedUnit(unit);
    setTargetValueText('');
  };

  return (
    <ScreenContainer scroll>
      <Text style={styles.heading}>{t('kb2.heading')}</Text>
      <Text style={styles.sub}>{t('kb2.sub')}</Text>

      <View style={styles.unitRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedUnit === 'minutes' }}
          onPress={() => handleSelectUnit('minutes')}
          style={[styles.unitPill, selectedUnit === 'minutes' && styles.unitPillSelected]}
        >
          <Text style={styles.unitPillLabel}>{t('kb2.unitMinutes')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedUnit === 'sessions' }}
          onPress={() => handleSelectUnit('sessions')}
          style={[styles.unitPill, selectedUnit === 'sessions' && styles.unitPillSelected]}
        >
          <Text style={styles.unitPillLabel}>{t('kb2.unitSessions')}</Text>
        </Pressable>
      </View>
      <Text style={styles.unitHelper}>{t('kb2.unitHelper')}</Text>


      <Text style={styles.label}>{t('kb2.targetLabel', { unit: unitLabel })}</Text>
      <TextInput
        keyboardType="number-pad"
        placeholder={t(UNIT_PLACEHOLDER_KEYS[selectedUnit])}
        placeholderTextColor={colors.textMuted}
        value={targetValueText}
        onChangeText={setTargetValueText}
        style={styles.input}
      />
      <Text style={styles.helper}>{t('kb2.helper')}</Text>

      {canSubmit ? (
        <View style={styles.previewCallout}>
          <Text style={styles.previewText}>
            {t('kb2.previewText', {
              value: targetValue,
              unit: unitLabel,
              metric: targetMetricLabelInline(t, targetMetric),
            })}
          </Text>
        </View>
      ) : null}

      <PrimaryButton
        label={t('kb2.next')}
        disabled={!canSubmit}
        onPress={() => {
          if (canSubmit) onNext(targetMetric, targetValue);
        }}
      />
      <SecondaryLink label={t('kb2.back')} onPress={onBack} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: fonts.headingBold,
    fontSize: 21,
    color: colors.ink,
    textAlign: 'center',
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.textMuted,
    textAlign: 'center',
  },
  unitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  unitPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingVertical: 12,
    alignItems: 'center',
  },
  unitPillSelected: {
    borderColor: colors.gold,
    backgroundColor: '#FFF7E0',
  },
  unitPillLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  unitHelper: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.textMuted,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: fonts.body,
    backgroundColor: colors.white,
    color: colors.ink,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.textMuted,
  },
  previewCallout: {
    backgroundColor: '#FFF7E0',
    borderRadius: 14,
    padding: 12,
  },
  previewText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.ink,
  },
});
