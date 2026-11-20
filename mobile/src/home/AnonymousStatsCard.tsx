import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  loadAnonymousStatsEnabled,
  setAnonymousStatsEnabled,
} from '../api/uiMetricsClient';
import { SecondaryButton } from '../components/SecondaryButton';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

/**
 * I-003 opt-in for app usage statistics
 * (docs/adr/0039-anonymous-ui-click-statistics.md). Off by default.
 *
 * Rendered by ProfileScreen **only for self-verified accounts**
 * (`isSelfVerification`, the Art. 8 age band and adults), who consent for
 * themselves (Decision 2). Under-13 accounts never see it: there is no
 * ParentalGate path, because that gate is not a consent mechanism
 * (ADR-0034 Decision 3). A parent-consent route for them is a separate,
 * unbuilt follow-up.
 *
 * Turning it on asks once, inline, with two buttons of identical style and
 * size ("Nej tack" / "Slå på") and neutral copy. Inline rather than a
 * system `Alert`, which on iOS bolds one button and on web does not render
 * at all. Turning it off is immediate.
 */
export function AnonymousStatsCard() {
  const { t } = useTranslation('home');
  const [enabled, setEnabled] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    void loadAnonymousStatsEnabled().then(setEnabled);
  }, []);

  const apply = (next: boolean) => {
    setConfirming(false);
    setEnabled(next);
    void setAnonymousStatsEnabled(next).then(setEnabled);
  };

  const handleChange = (next: boolean) => {
    if (!next) {
      apply(false);
      return;
    }
    setConfirming(true);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.heading}>{t('anonymousStats.heading')}</Text>
        <Switch
          value={enabled}
          onValueChange={handleChange}
          disabled={confirming}
          accessibilityLabel={t('anonymousStats.heading')}
        />
      </View>
      <Text style={styles.body}>{t('anonymousStats.body')}</Text>
      <Text style={styles.body}>{t('anonymousStats.info')}</Text>
      {confirming ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>{t('anonymousStats.confirmBody')}</Text>
          <View style={styles.buttons}>
            <View style={styles.buttonSlot}>
              <SecondaryButton
                label={t('anonymousStats.confirmNo')}
                onPress={() => setConfirming(false)}
              />
            </View>
            <View style={styles.buttonSlot}>
              <SecondaryButton
                label={t('anonymousStats.confirmYes')}
                onPress={() => apply(true)}
              />
            </View>
          </View>
        </View>
      ) : null}
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
  confirm: { gap: 10 },
  confirmText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  buttons: { flexDirection: 'row', gap: 10 },
  buttonSlot: { flex: 1 },
});
