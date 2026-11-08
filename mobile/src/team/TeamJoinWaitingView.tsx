import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { WaitingCard } from '../home/components/WaitingCard';
import type { ConsentStatus, TeamJoinStatus } from '../api/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface TeamJoinWaitingViewProps {
  consentStatus: ConsentStatus;
  isSelfVerification: boolean;
  teamJoinStatus: TeamJoinStatus;
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * What the Chatt, Mål and Laget tabs show until the captain approves the
 * join (owner decision 2026-11-08, ADR-0009's amendment). The server
 * refuses every team route to a pending joiner, so mounting those screens
 * would only produce three different "couldn't load" errors; this is the
 * same waiting card Home already shows, plus one line saying what opens
 * up once the captain says yes.
 */
export function TeamJoinWaitingView({
  consentStatus,
  isSelfVerification,
  teamJoinStatus,
  onRefresh,
  refreshing,
}: TeamJoinWaitingViewProps) {
  const { t } = useTranslation('home');
  return (
    <View style={styles.container}>
      <WaitingCard
        consentStatus={consentStatus}
        isSelfVerification={isSelfVerification}
        teamJoinStatus={teamJoinStatus}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
      <Text style={styles.note}>{t('waitingCard.teamTabsNote')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
