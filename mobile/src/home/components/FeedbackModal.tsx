import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/ApiError';
import { postQuickFeedback } from '../../api/endpoints';
import type { QuickFeedbackAnswer } from '../../api/endpoints';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

type FunChoice = Extract<QuickFeedbackAnswer, { questionId: 'fun_today' }>['choice'];
type WantChoice = Extract<QuickFeedbackAnswer, { questionId: 'want_more' }>['choice'];

const FUN_CHOICES: { choice: FunChoice; emoji: string }[] = [
  { choice: 'happy', emoji: '😀' },
  { choice: 'meh', emoji: '😐' },
  { choice: 'sad', emoji: '🙁' },
];

const WANT_CHOICES: WantChoice[] = ['drills', 'challenges', 'badges', 'unsure'];

interface FeedbackModalProps {
  visible: boolean;
  /** Closed without sending (X / back) — treated like "Inte nu". */
  onDismiss: () => void;
  /** Answers were sent (or the server said this week's were already
   * given). Fires when the thank-you is dismissed. */
  onDone: () => void;
}

/** I-002 — two pre-set questions, then "Tack!". No free text anywhere. */
export function FeedbackModal({ visible, onDismiss, onDone }: FeedbackModalProps) {
  const { t } = useTranslation('home');
  const [step, setStep] = useState<1 | 2 | 'thanks'>(1);
  const [fun, setFun] = useState<FunChoice | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  const reset = () => {
    setStep(1);
    setFun(null);
    setSending(false);
    setError(false);
  };

  const send = async (want: WantChoice | null) => {
    if (sending || !fun) return;
    const answers: QuickFeedbackAnswer[] = [{ questionId: 'fun_today', choice: fun }];
    if (want) answers.push({ questionId: 'want_more', choice: want });
    setSending(true);
    setError(false);
    try {
      await postQuickFeedback(answers);
      setSending(false);
      setStep('thanks');
    } catch (err) {
      setSending(false);
      if (err instanceof ApiError && err.code === 'FEEDBACK_ALREADY_GIVEN') {
        // Already answered this week (e.g. on another device): nothing to
        // retry, and nothing the child needs to be told is wrong.
        setStep('thanks');
        return;
      }
      setError(true);
    }
  };

  const close = () => {
    if (sending) return;
    const finished = step === 'thanks';
    reset();
    if (finished) onDone();
    else onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        {step === 1 ? (
          <>
            <Text style={styles.progress}>{t('feedbackModal.progress', { step: 1 })}</Text>
            <Text style={styles.heading}>{t('feedbackModal.funQuestion')}</Text>
            <View style={styles.faces}>
              {FUN_CHOICES.map(({ choice, emoji }) => (
                <Pressable
                  key={choice}
                  accessibilityRole="button"
                  accessibilityLabel={t(`feedbackModal.fun.${choice}`)}
                  onPress={() => {
                    setFun(choice);
                    setStep(2);
                  }}
                  style={({ pressed }) => [styles.face, pressed && styles.pressed]}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                  <Text style={styles.faceLabel}>{t(`feedbackModal.fun.${choice}`)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : step === 2 ? (
          <>
            <Text style={styles.progress}>{t('feedbackModal.progress', { step: 2 })}</Text>
            <Text style={styles.heading}>{t('feedbackModal.wantQuestion')}</Text>
            <View style={styles.options}>
              {WANT_CHOICES.map((choice) => (
                <Pressable
                  key={choice}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: sending }}
                  onPress={() => void send(choice)}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                >
                  <Text style={styles.optionLabel}>{t(`feedbackModal.want.${choice}`)}</Text>
                </Pressable>
              ))}
            </View>
            {error ? <Text style={styles.error}>{t('feedbackModal.error')}</Text> : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => void send(null)}
              style={styles.skip}
            >
              <Text style={styles.skipLabel}>{t('feedbackModal.skip')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.heading}>{t('feedbackModal.thanksHeading')}</Text>
            <Text style={styles.body}>{t('feedbackModal.thanksBody')}</Text>
            <Pressable accessibilityRole="button" onPress={close} style={styles.done}>
              <Text style={styles.doneLabel}>{t('feedbackModal.thanksButton')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(27,27,58,0.35)',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    gap: 12,
  },
  progress: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.textMuted,
  },
  heading: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textBody,
  },
  faces: {
    flexDirection: 'row',
    gap: 10,
  },
  face: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  emoji: {
    fontSize: 40,
  },
  faceLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  options: {
    gap: 10,
  },
  option: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  optionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textBody,
  },
  skip: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.textMuted,
  },
  done: {
    backgroundColor: colors.ink,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  doneLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
