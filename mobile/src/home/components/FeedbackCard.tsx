import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

interface FeedbackCardProps {
  onAnswer: () => void;
  onNotNow: () => void;
}

/** I-002 — the "help us get better" card, shown on Home once today's
 * training is logged. Voluntary: "Inte nu" is as easy to reach as "Svara",
 * and answering earns no points or streak. */
export function FeedbackCard({ onAnswer, onNotNow }: FeedbackCardProps) {
  const { t } = useTranslation('home');

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('feedbackCard.title')}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          onPress={onAnswer}
          style={({ pressed }) => [styles.answer, pressed && styles.pressed]}
        >
          <Text style={styles.answerLabel}>{t('feedbackCard.answer')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onNotNow}
          style={({ pressed }) => [styles.notNow, pressed && styles.pressed]}
        >
          <Text style={styles.notNowLabel}>{t('feedbackCard.notNow')}</Text>
        </Pressable>
      </View>
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
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  answer: {
    flex: 1,
    backgroundColor: colors.ink,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  answerLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  notNow: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  notNowLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.85,
  },
});
