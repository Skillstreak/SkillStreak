import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  loadAnonymousStatsEnabled,
  setAnonymousStatsEnabled,
} from '../api/uiMetricsClient';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

/**
 * I-003 opt-in for anonymous click statistics. Off by default.
 *
 * - Under 13 (`isSelfVerification` false): turning it ON goes through the
 *   ParentalGate via `onRequireGate`; the parent makes the choice. Turning
 *   it off is never gated.
 * - 13+: turning it on asks once with two equal buttons, "Nej tack" /
 *   "Slå på", worded neutrally. The system alert gives both equal weight.
 */
export function AnonymousStatsCard({
  isSelfVerification,
  onRequireGate,
}: {
  isSelfVerification: boolean;
  onRequireGate: (action: () => void) => void;
}) {
  const { t } = useTranslation('home');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void loadAnonymousStatsEnabled().then(setEnabled);
  }, []);

  const apply = (next: boolean) => {
    setEnabled(next);
    void setAnonymousStatsEnabled(next);
  };

  const handleChange = (next: boolean) => {
    if (!next) {
      apply(false);
      return;
    }
    if (!isSelfVerification) {
      onRequireGate(() => apply(true));
      return;
    }
    Alert.alert(t('anonymousStats.heading'), t('anonymousStats.confirmBody'), [
      { text: t('anonymousStats.confirmNo'), style: 'cancel' },
      { text: t('anonymousStats.confirmYes'), onPress: () => apply(true) },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.heading}>{t('anonymousStats.heading')}</Text>
        <Switch
          value={enabled}
          onValueChange={handleChange}
          accessibilityLabel={t('anonymousStats.heading')}
        />
      </View>
      <Text style={styles.body}>{t('anonymousStats.body')}</Text>
      <Text style={styles.body}>{t('anonymousStats.info')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heading: { fontFamily: fonts.headingBold, fontSize: 16, color: colors.ink, flexShrink: 1 },
  body: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textMuted,
  },
});
