import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TextField } from '../../components/TextField';
import { ApiError } from '../../api/ApiError';
import { submitAdultFeedback } from '../../api/endpoints';
import type { AdultFeedbackKind } from '../../api/endpoints';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

const KINDS: readonly AdultFeedbackKind[] = ['idea', 'problem', 'other'];

/** Same cap as the backend DTO (1–1000 characters). */
const TEXT_MAX_LENGTH = 1000;

interface AdultFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

/** I-001 — kind picker, free text, a warning about names/children, then
 * "Tack!". Nothing about the sender is sent: only kind and text. */
export function AdultFeedbackModal({ visible, onClose }: AdultFeedbackModalProps) {
  const { t } = useTranslation('home');
  const [kind, setKind] = useState<AdultFeedbackKind>('idea');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [errorKey, setErrorKey] = useState<
    'adultFeedback.error' | 'adultFeedback.errorLimit' | 'adultFeedback.errorAdultsOnly' | null
  >(null);
  const [sent, setSent] = useState(false);

  const trimmed = text.trim();

  const close = () => {
    if (sending) return;
    setKind('idea');
    setText('');
    setErrorKey(null);
    setSent(false);
    onClose();
  };

  const send = async () => {
    if (sending || trimmed.length === 0) return;
    setSending(true);
    setErrorKey(null);
    try {
      await submitAdultFeedback({ kind, text: trimmed });
      setSending(false);
      setText('');
      setSent(true);
    } catch (err) {
      setSending(false);
      if (err instanceof ApiError && err.status === 403) {
        setErrorKey('adultFeedback.errorAdultsOnly');
      } else if (err instanceof ApiError && err.status === 429) {
        setErrorKey('adultFeedback.errorLimit');
      } else {
        setErrorKey('adultFeedback.error');
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          {sent ? (
            <>
              <Text style={styles.heading}>{t('adultFeedback.thanksHeading')}</Text>
              <Text style={styles.body}>{t('adultFeedback.thanksBody')}</Text>
              <Pressable accessibilityRole="button" onPress={close} style={styles.primary}>
                <Text style={styles.primaryLabel}>{t('adultFeedback.thanksButton')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.heading}>{t('adultFeedback.heading')}</Text>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {KINDS.map((value) => {
                  const selected = kind === value;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: sending }}
                      disabled={sending}
                      onPress={() => setKind(value)}
                      style={[styles.chip, selected ? styles.chipSelected : null]}
                    >
                      <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>
                        {t(`adultFeedback.kinds.${value}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextField
                value={text}
                onChangeText={setText}
                placeholder={t('adultFeedback.placeholder')}
                multiline
                maxLength={TEXT_MAX_LENGTH}
                editable={!sending}
                style={styles.textArea}
              />
              <Text style={styles.counter}>
                {t('adultFeedback.counter', { count: text.length, max: TEXT_MAX_LENGTH })}
              </Text>
              <Text style={styles.warning}>{t('adultFeedback.warning')}</Text>
              {errorKey ? <Text style={styles.error}>{t(errorKey)}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: sending || trimmed.length === 0 }}
                disabled={sending || trimmed.length === 0}
                onPress={() => void send()}
                style={[styles.primary, trimmed.length === 0 || sending ? styles.disabled : null]}
              >
                <Text style={styles.primaryLabel}>{t('adultFeedback.submit')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={close} style={styles.cancel}>
                <Text style={styles.cancelLabel}>{t('adultFeedback.cancel')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipSelected: {
    borderColor: colors.flame,
    backgroundColor: colors.flameTint,
  },
  chipLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textBody,
  },
  chipLabelSelected: {
    fontFamily: fonts.headingBold,
    color: colors.flame,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  counter: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  warning: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.tipBg,
    borderWidth: 1,
    borderColor: colors.tipBorder,
    borderRadius: 12,
    padding: 12,
    lineHeight: 19,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textBody,
  },
  primary: {
    backgroundColor: colors.ink,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.white,
  },
  disabled: {
    opacity: 0.4,
  },
  cancel: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.textMuted,
  },
});
