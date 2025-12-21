import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useState } from 'react';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Badge } from '@/components/ui';
import { LiveMatchCard } from '@/components/features';
import { useGame, useLiveMatches } from '@/hooks';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';
import { LiveMatch } from '@/types';

export default function LiveScreen() {
  const { selectedGame } = useGame();

  const {
    liveMatches,
    isLoading,
    error,
    refetch,
  } = useLiveMatches({
    gameAcronym: selectedGame?.acronym,
    pollingInterval: 30000,
    enabled: true,
  });

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.titleContainer}>
        <Text variant="headlineSmall" style={styles.title}>
          Matchs en Direct
        </Text>
        <Badge label="LIVE" variant="live" />
      </View>
      <Text variant="bodyMedium" style={styles.subtitle}>
        {selectedGame
          ? `Matchs ${selectedGame.name} en direct`
          : 'Tous les matchs en direct'}
      </Text>
      <Text variant="bodySmall" style={styles.hint}>
        Tirez pour rafraîchir • Mise à jour automatique toutes les 30s
      </Text>
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text variant="bodyMedium" style={styles.emptyText}>
            Chargement des matchs en direct...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text variant="titleMedium" style={styles.errorTitle}>
            Erreur
          </Text>
          <Text variant="bodyMedium" style={styles.errorText}>
            {error}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text variant="titleLarge" style={styles.emptyTitle}>
          Aucun match en direct
        </Text>
        <Text variant="bodyMedium" style={styles.emptyText}>
          {selectedGame
            ? `Aucun match en direct pour ${selectedGame.name} actuellement.`
            : 'Aucun match en direct pour le moment.'}
        </Text>
        <Text variant="bodySmall" style={styles.emptyHint}>
          Revenez plus tard ou sélectionnez un autre jeu
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: LiveMatch }) => (
    <View style={styles.matchCardContainer}>
      <LiveMatchCard match={item} />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={liveMatches}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    color: COLORS.text,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.textSecondary,
    marginBottom: spacing.xs,
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  matchCardContainer: {
    alignItems: 'center',
    width: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: COLORS.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyHint: {
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorTitle: {
    color: '#ef4444',
    marginBottom: spacing.sm,
  },
  errorText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
