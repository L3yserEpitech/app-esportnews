import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Pressable, Dimensions, TextInput } from 'react-native';
import { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  FadeInUp,
  FadeInDown,
  FadeInRight,
  FadeOutLeft,
  FadeInLeft,
  FadeOutRight,
  Layout,
  useAnimatedStyle,
  withTiming,
  Easing
} from 'react-native-reanimated';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius, shadows } from '@/constants/theme';
import { useTournaments, useGame } from '@/hooks';
import { TournamentCard } from '@/components/features/TournamentCard';
import { Badge, LiquipediaBadge } from '@/components/ui';

type TournamentStatus = 'running' | 'upcoming' | 'finished';

const { width } = Dimensions.get('window');

const StatusTab = ({ label, value, active, onPress }: { label: string, value: TournamentStatus, active: boolean, onPress: (v: TournamentStatus) => void }) => {
  return (
    <Pressable onPress={() => onPress(value)} style={styles.tabItem}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
      {active && (
        <Animated.View 
          layout={Layout.springify()}
          entering={FadeInDown.duration(200)}
          style={styles.tabIndicator} 
        />
      )}
    </Pressable>
  );
};

const EmptyState = ({ isLoading, error, selectedGame, status }: any) => {
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text variant="bodyLarge" style={styles.loadingText}>Recherche de tournois...</Text>
      </View>
    );
  }

  const statusLabel = status === 'running' ? 'en cours' : status === 'upcoming' ? 'à venir' : 'terminés';

  return (
    <Animated.View 
      entering={FadeInUp.delay(200)}
      style={styles.centerContainer}
    >
      <View style={styles.emptyIconContainer}>
        <MaterialCommunityIcons 
          name={error ? "alert-circle-outline" : "trophy-variant-outline"} 
          size={80} 
          color={error ? COLORS.live : COLORS.textMuted} 
        />
        <LinearGradient
          colors={['transparent', COLORS.primary + '10', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </View>
      
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        {error ? 'Oups !' : 'Aucun tournoi'}
      </Text>
      
      <Text variant="bodyMedium" style={styles.emptyDescription}>
        {error ? error : (selectedGame
          ? `Il n'y a pas de tournois ${statusLabel} sur ${selectedGame.name} pour le moment.`
          : `Aucun tournoi ${statusLabel} détecté actuellement.`)}
      </Text>
    </Animated.View>
  );
};

const TournamentsHeader = memo(({ 
  isSearchVisible, 
  searchQuery, 
  setSearchQuery, 
  toggleSearch, 
  status, 
  setStatus 
}: { 
  isSearchVisible: boolean, 
  searchQuery: string, 
  setSearchQuery: (s: string) => void, 
  toggleSearch: () => void, 
  status: TournamentStatus, 
  setStatus: (s: TournamentStatus) => void 
}) => {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isSearchVisible) {
      // Small delay to ensure the keyboard doesn't interrupt the slide animation
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      inputRef.current?.blur();
    }
  }, [isSearchVisible]);

  const config = {
    duration: 300,
    easing: Easing.out(Easing.exp),
  };

  const searchStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isSearchVisible ? 1 : 0, config),
    transform: [
      { translateX: withTiming(isSearchVisible ? 0 : 30, config) },
    ],
    zIndex: isSearchVisible ? 1 : 0,
    position: isSearchVisible ? 'relative' : 'absolute',
    width: '100%',
  }));

  const tabsStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isSearchVisible ? 0 : 1, config),
    transform: [
      { translateX: withTiming(isSearchVisible ? -30 : 0, config) },
    ],
    zIndex: isSearchVisible ? 0 : 1,
    position: isSearchVisible ? 'absolute' : 'relative',
    width: '100%',
  }));

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Animated.View style={[styles.searchBarContainer, searchStyle]}>
          <MaterialCommunityIcons name="magnify" size={20} color={COLORS.primary} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Rechercher un tournoi..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Pressable onPress={toggleSearch} style={styles.closeSearchButton}>
            <MaterialCommunityIcons name="close" size={20} color={COLORS.textSecondary} />
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.tabsAndSearch, tabsStyle]}>
          <View style={styles.tabsContainer}>
            <StatusTab 
              label="En Cours" 
              value="running" 
              active={status === 'running'} 
              onPress={setStatus} 
            />
            <StatusTab 
              label="À Venir" 
              value="upcoming" 
              active={status === 'upcoming'} 
              onPress={setStatus} 
            />
            <StatusTab 
              label="Terminés" 
              value="finished" 
              active={status === 'finished'} 
              onPress={setStatus} 
            />
          </View>
          <Pressable onPress={toggleSearch} style={styles.searchButton}>
            <MaterialCommunityIcons name="magnify" size={22} color={COLORS.text} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}, (prev, next) => {
  // We MUST re-render for searchQuery, but we avoid unmounting thanks to the structure above
  return prev.isSearchVisible === next.isSearchVisible && 
         prev.status === next.status && 
         prev.searchQuery === next.searchQuery;
});

export default function TournamentsScreen() {
  const [status, setStatus] = useState<TournamentStatus>('running');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { selectedGame } = useGame();

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
    gameFilter: selectedGame?.acronym || null,
    limit: 15,
    autoRefresh: false,
  });

  const filteredTournaments = useMemo(() => {
    if (!searchQuery) return tournaments;
    const query = searchQuery.toLowerCase();
    return tournaments.filter(t => 
      t.name.toLowerCase().includes(query) || 
      t.league?.name.toLowerCase().includes(query)
    );
  }, [tournaments, searchQuery]);

  const toggleSearch = useCallback(() => {
    setIsSearchVisible(prev => {
      if (prev) setSearchQuery('');
      return !prev;
    });
  }, []);

  // Use a stable component reference to avoid remounting the header on every keystroke
  const HeaderComponent = useMemo(() => (
    <TournamentsHeader
      isSearchVisible={isSearchVisible}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      toggleSearch={toggleSearch}
      status={status}
      setStatus={setStatus}
    />
  ), [isSearchVisible, searchQuery, status, toggleSearch]);

  const renderFooter = () => (
    <>
      {hasMore && !isLoading ? (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : null}
      <LiquipediaBadge />
      <View style={{ height: spacing.xxl }} />
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredTournaments}
        keyExtractor={(item) => item.slug || item.id.toString()}
        renderItem={({ item }) => (
          <TournamentCard
            tournament={item}
          />
        )}
        ListHeaderComponent={<View style={{ height: 100 }} />} // Spacer for sticky header
        ListEmptyComponent={
          <EmptyState 
            isLoading={isLoading} 
            error={error} 
            selectedGame={selectedGame} 
            status={status}
          />
        }
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
            progressViewOffset={100} // Offset for sticky header
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      />
      {HeaderComponent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: spacing.xs, // Reduced to move up
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabsAndSearch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 48,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 8,
  },
  closeSearchButton: {
    padding: 4,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: borderRadius.lg,
    padding: 4,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    position: 'relative',
  },
  tabLabel: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  tabLabelActive: {
    color: COLORS.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 20,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
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
  footerLoader: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});
