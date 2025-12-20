import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, FlatList, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { 
  GameSelector, 
  LiveMatchCard, 
  HomeHeader, 
  SectionHeader, 
  ArticleCard, 
  TournamentCard 
} from '@/components/features';
import { useGame, useLiveMatches, useHomeData } from '@/hooks';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { selectedGame, isLoadingGames } = useGame();
  
  const {
    liveMatches,
    isLoading: isLoadingLive,
    error: liveError,
    refetch: refetchLive,
  } = useLiveMatches({
    gameAcronym: selectedGame?.acronym,
    pollingInterval: 30000,
    enabled: !!selectedGame,
  });

  const {
    news,
    tournaments,
    isLoading: isLoadingHome,
    error: homeError,
    refetch: refetchHome,
  } = useHomeData(selectedGame?.acronym);

  const onRefresh = useCallback(() => {
    refetchLive();
    refetchHome();
  }, [refetchLive, refetchHome]);

  const isLoading = isLoadingGames || (isLoadingLive && liveMatches.length === 0);

  return (
    <View style={styles.container}>
      {/* Game Selector - Sticky Header */}
      <GameSelector />

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false} // Managed by individual loaders for now
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Live Section */}
        {(isLoadingLive || liveMatches.length > 0) && (
          <View style={styles.section}>
            <SectionHeader 
              title="En Direct" 
              showLiveBadge 
              onViewAll={() => router.push('/(tabs)/live')}
            />
            
            {isLoadingLive && liveMatches.length === 0 ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : (
              <FlatList
                horizontal
                data={liveMatches}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <LiveMatchCard 
                    match={item} 
                    onPress={() => router.push(`/match/${item.id}`)}
                  />
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
                snapToInterval={280 + spacing.md} // Adjust based on card width
                decelerationRate="fast"
              />
            )}
          </View>
        )}

        {/* News Section */}
        <View style={styles.section}>
          <SectionHeader 
            title="Dernières Actus" 
            onViewAll={() => router.push('/(tabs)/profile')} // Temporary redirection
          />
          {isLoadingHome && news.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              horizontal
              data={news}
              keyExtractor={(item) => item.slug}
              renderItem={({ item }) => (
                <ArticleCard 
                  article={item} 
                  onPress={() => router.push(`/article/${item.slug}`)}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          )}
        </View>

        {/* Tournaments Section */}
        <View style={styles.section}>
          <SectionHeader 
            title="Tournois en cours" 
            onViewAll={() => router.push('/(tabs)/tournaments')}
          />
          {isLoadingHome && tournaments.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : tournaments.length > 0 ? (
            <View style={styles.verticalList}>
              {tournaments.slice(0, 3).map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  onPress={() => router.push(`/tournament/${tournament.id}`)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Aucun tournoi en cours pour le moment.
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Spacing for TabBar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
  },
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  horizontalList: {
    paddingRight: spacing.md,
  },
  verticalList: {
    gap: spacing.sm,
  },
  loadingBox: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    padding: spacing.xl,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

