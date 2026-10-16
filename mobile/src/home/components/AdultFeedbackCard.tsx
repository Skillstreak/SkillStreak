import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

interface AdultFeedbackCardProps {
  onPress: () => void;
}

/** I-001 — "Säg vad du tycker". Rendered by HomeScreen only for 18+
 * accounts; this component does no age check of its own. */
export function AdultFeedbackCard({ onPress }: AdultFeedbackCardProps) {
  const { t } = useTranslation('home');

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('adultFeedback.cardTitle')}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonLabel}>{t('adultFeedback.cardButton')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  buttonLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
