import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Text, SegmentedButtons, Chip } from 'react-native-paper';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';
import { useTournaments } from '@/hooks';
import { useGame } from '@/hooks';
import { TournamentCard } from '@/components/features/TournamentCard';
import type { PandaTournament } from '@/types';

type TournamentStatus = 'running' | 'upcoming' | 'finished';

export default function TournamentsScreen() {
  const [status, setStatus] = useState<TournamentStatus>('running');
  const [filterGame, setFilterGame] = useState<string | null>(null);
  const { games } = useGame();

  const {
    tournaments,
    isLoading,
    isRefreshing,
    error,
    refetch,
    loadMore,
    hasMore,
  } = useTournaments({
    status,
    gameFilter: filterGame,
    limit: 12,
    autoRefresh: false,
  });

  // Render header with filters
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Status Segmented Control */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={status}
          onValueChange={(value) => setStatus(value as TournamentStatus)}
          buttons={[
            { value: 'running', label: 'En Cours' },
            { value: 'upcoming', label: 'À Venir' },
            { value: 'finished', label: 'Terminés' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Game Filters */}
      <View style={styles.gameFiltersContainer}>
        <Text variant="labelMedium" style={styles.filterLabel}>
          Filtrer par jeu :
        </Text>
        <FlatList
          horizontal
          data={games}
          keyExtractor={(game) => game.id.toString()}
          renderItem={({ item: game }) => (
            <Chip
              mode={filterGame === game.acronym ? 'flat' : 'outlined'}
              selected={filterGame === game.acronym}
              onPress={() => {
                // Toggle: if already selected, deselect
                setFilterGame(filterGame === game.acronym ? null : game.acronym);
              }}
              style={[
                styles.gameChip,
                filterGame === game.acronym && styles.gameChipSelected,
              ]}
              textStyle={filterGame === game.acronym ? styles.chipTextSelected : styles.chipText}
            >
              {game.name}
            </Chip>
          )}
          ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gameFiltersList}
        />
      </View>

      {/* Count */}
      <Text variant="bodySmall" style={styles.countText}>
        {tournaments.length} tournoi{tournaments.length > 1 ? 's' : ''}
        {filterGame && ` · ${games.find(g => g.acronym === filterGame)?.name}`}
      </Text>
    </View>
  );

  // Render empty state
  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Chargement des tournois...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
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
      <View style={styles.centerContainer}>
        <Text variant="titleMedium" style={styles.emptyTitle}>
          Aucun tournoi
        </Text>
        <Text variant="bodyMedium" style={styles.emptyText}>
          {filterGame
            ? `Aucun tournoi ${status === 'running' ? 'en cours' : status === 'upcoming' ? 'à venir' : 'terminé'} pour ${games.find(g => g.acronym === filterGame)?.name}.`
            : `Aucun tournoi ${status === 'running' ? 'en cours' : status === 'upcoming' ? 'à venir' : 'terminé'}.`}
        </Text>
        <Text variant="bodySmall" style={styles.emptyHint}>
          Essayez de changer de filtre ou revenez plus tard.
        </Text>
      </View>
    );
  };

  // Render footer (loading more indicator)
  const renderFooter = () => {
    if (!hasMore || isLoading) return null;

    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={tournaments}
        keyExtractor={(tournament) => tournament.id.toString()}
        renderItem={({ item }) => (
          <TournamentCard
            tournament={item}
            onPress={() => {
              // Navigation vers détail tournoi sera implémentée plus tard
              console.log('Navigate to tournament:', item.id);
            }}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={[
          styles.listContent,
          tournaments.length === 0 && styles.listContentEmpty,
        ]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    backgroundColor: COLORS.surface,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterContainer: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  segmentedButtons: {
    backgroundColor: COLORS.background,
  },
  gameFiltersContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  filterLabel: {
    color: COLORS.textSecondary,
    marginBottom: spacing.sm,
  },
  gameFiltersList: {
    paddingBottom: spacing.sm,
  },
  gameChip: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  gameChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: COLORS.darkest,
  },
  countText: {
    color: COLORS.textMuted,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    minHeight: 300,
  },
  loadingText: {
    marginTop: spacing.md,
    color: COLORS.textSecondary,
  },
  errorTitle: {
    color: COLORS.error,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyTitle: {
    color: COLORS.text,
    marginBottom: spacing.sm,
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
  footerContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
