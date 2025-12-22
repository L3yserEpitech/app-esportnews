import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useState } from 'react';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  FadeInUp
} from 'react-native-reanimated';
import { LiveMatchCard } from '@/components/features';
import { useGame, useLiveMatches } from '@/hooks';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { LiveMatch } from '@/types';

const EmptyState = ({ isLoading, error, selectedGame }: any) => {
  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text variant="bodyLarge" style={styles.loadingText}>Synchronisation...</Text>
      </View>
    );
  }

  return (
    <Animated.View 
      entering={FadeInUp.delay(200)}
      style={styles.emptyContainer}
    >
      <View style={styles.emptyIconContainer}>
        <MaterialCommunityIcons 
          name={error ? "alert-circle-outline" : "television-off"} 
          size={80} 
          color={error ? COLORS.live : COLORS.textMuted} 
        />
        <LinearGradient
          colors={['transparent', COLORS.primary + '10', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </View>
      
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        {error ? 'Oups !' : 'C\'est un peu calme ici'}
      </Text>
      
      <Text variant="bodyMedium" style={styles.emptyDescription}>
        {error ? error : (selectedGame
          ? `Aucun affrontement en cours sur ${selectedGame.name} pour le moment.`
          : 'Aucun match en direct n’a été détecté actuellement.')}
      </Text>
    </Animated.View>
  );
};

export default function LiveScreen() {
  const router = useRouter();
  const { selectedGame } = useGame();
  const { liveMatches, isLoading, error, refetch } = useLiveMatches({
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

  const renderItem = ({ item }: { item: LiveMatch }) => (
    <View style={styles.cardWrapper}>
      <LiveMatchCard 
        match={item} 
        onPress={() => router.push(`/match/${item.id}`)}
        fullWidth={true}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={liveMatches}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState 
            isLoading={isLoading} 
            error={error} 
            selectedGame={selectedGame} 
          />
        }
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  cardWrapper: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    width: '100%',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  emptyTitle: {
    color: COLORS.text,
    fontWeight: '800',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyDescription: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: spacing.md,
    fontWeight: '600',
  },
});
