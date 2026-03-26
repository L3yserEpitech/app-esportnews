import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Text, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMatchSubscriptions } from '@/hooks';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { MatchSubscriptionData, TournamentSubscriptionData } from '@/services/matchSubscriptionService';

type TabValue = 'matches' | 'tournaments';

export default function SubscriptionsScreen() {
  const router = useRouter();
  const {
    matchSubscriptions,
    tournamentSubscriptions,
    loading,
    loadFullSubscriptions,
    unsubscribeFromMatch,
    unsubscribeFromTournament,
    matchSubCount,
    tournamentSubCount,
  } = useMatchSubscriptions();

  const [activeTab, setActiveTab] = useState<TabValue>('matches');

  useEffect(() => {
    loadFullSubscriptions();
  }, [loadFullSubscriptions]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Date inconnue';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return COLORS.live;
      case 'upcoming': return COLORS.info;
      case 'finished': return COLORS.textMuted;
      case 'canceled': return COLORS.error;
      default: return COLORS.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'running': return 'En direct';
      case 'upcoming': return 'A venir';
      case 'finished': return 'Termine';
      case 'canceled': return 'Annule';
      default: return status;
    }
  };

  const renderMatchItem = ({ item }: { item: MatchSubscriptionData }) => (
    <TouchableOpacity
      style={styles.subCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/match/${item.match_id}`)}
    >
      <View style={styles.subCardContent}>
        <View style={styles.subCardHeader}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusLabel, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
          {item.game_acronym && (
            <View style={styles.gameBadge}>
              <Text style={styles.gameBadgeText}>{item.game_acronym.toUpperCase()}</Text>
            </View>
          )}
        </View>

        <Text style={styles.subCardTitle} numberOfLines={2}>
          {item.match_name || 'Match'}
        </Text>

        {item.tournament_name && (
          <Text style={styles.subCardSubtitle} numberOfLines={1}>
            {item.tournament_name}
          </Text>
        )}

        <View style={styles.subCardFooter}>
          <MaterialCommunityIcons name="calendar-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.subCardDate}>{formatDate(item.begin_at)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.unsubButton}
        onPress={() => unsubscribeFromMatch(item.match_id)}
        hitSlop={8}
      >
        <Ionicons name="heart" size={22} color={COLORS.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderTournamentItem = ({ item }: { item: TournamentSubscriptionData }) => (
    <TouchableOpacity
      style={styles.subCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/tournament/${item.tournament_id}`)}
    >
      <View style={styles.subCardContent}>
        <View style={styles.subCardHeader}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusLabel, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
          {item.game_acronym && (
            <View style={styles.gameBadge}>
              <Text style={styles.gameBadgeText}>{item.game_acronym.toUpperCase()}</Text>
            </View>
          )}
        </View>

        <Text style={styles.subCardTitle} numberOfLines={2}>
          {item.tournament_name || 'Tournoi'}
        </Text>

        <View style={styles.subCardFooter}>
          <MaterialCommunityIcons name="calendar-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.subCardDate}>
            {formatDate(item.begin_at)}
            {item.end_at ? ` - ${formatDate(item.end_at)}` : ''}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.unsubButton}
        onPress={() => unsubscribeFromTournament(item.tournament_id)}
        hitSlop={8}
      >
        <Ionicons name="heart" size={22} color={COLORS.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name={activeTab === 'matches' ? 'game-controller-outline' : 'trophy-outline'}
        size={48}
        color={COLORS.textMuted}
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'matches' ? 'Aucun match suivi' : 'Aucun tournoi suivi'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'matches'
          ? 'Appuie sur le coeur d\'un match pour le suivre et recevoir des notifications.'
          : 'Appuie sur le coeur d\'un tournoi pour suivre tous ses matchs.'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={[COLORS.darkBlue, COLORS.darkest]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes abonnements</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabValue)}
          buttons={[
            {
              value: 'matches',
              label: `Matchs (${matchSubCount})`,
              style: activeTab === 'matches' ? styles.tabActive : styles.tabInactive,
              labelStyle: activeTab === 'matches' ? styles.tabLabelActive : styles.tabLabelInactive,
            },
            {
              value: 'tournaments',
              label: `Tournois (${tournamentSubCount})`,
              style: activeTab === 'tournaments' ? styles.tabActive : styles.tabInactive,
              labelStyle: activeTab === 'tournaments' ? styles.tabLabelActive : styles.tabLabelInactive,
            },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : activeTab === 'matches' ? (
        <FlatList
          data={matchSubscriptions}
          renderItem={renderMatchItem}
          keyExtractor={(item) => `match-${item.id}`}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={tournamentSubscriptions}
          renderItem={renderTournamentItem}
          keyExtractor={(item) => `tournament-${item.id}`}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  tabContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  segmentedButtons: {
    borderRadius: borderRadius.lg,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabLabelActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: COLORS.textMuted,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  subCardContent: {
    flex: 1,
    gap: 6,
  },
  subCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gameBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  gameBadgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  subCardTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  subCardSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  subCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  subCardDate: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  unsubButton: {
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
    gap: spacing.md,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
