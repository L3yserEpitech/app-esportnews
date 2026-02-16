import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, FlatList, RefreshControl } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  LiveMatchCard,
  SectionHeader,
  ArticleCard,
  TournamentCard,
  LoginPromptModal,
} from '@/components/features';
import { useGame, useLiveMatches, useHomeData, useAuth, useAdPopup, useSubscription } from '@/hooks';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { selectedGame } = useGame();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Subscription status pour le popup pub
  const { isSubscribed } = useSubscription();

  // Publicité interstitielle AdMob - affichage manuel seulement
  // Le hook gère le chargement, le cooldown (5 min) et l'affichage
  const { showAd } = useAdPopup({
    skipIfSubscribed: true,
    isSubscribed,
    onClose: () => console.log('[HomeScreen] Ad closed'),
    onShow: () => console.log('[HomeScreen] Ad shown'),
  });

  const {
    liveMatches,
    isLoading: isLoadingLive,
    refetch: refetchLive,
  } = useLiveMatches({
    gameAcronym: selectedGame?.acronym,
    pollingInterval: 30000,
    enabled: true, // Toujours charger les matchs, même sans jeu sélectionné
  });

  const {
    news,
    tournaments,
    isLoading: isLoadingHome,
    refetch: refetchHome,
  } = useHomeData(selectedGame?.acronym);

  // Afficher une pub quand l'utilisateur revient sur l'onglet Home
  useFocusEffect(
    useCallback(() => {
      console.log('[HomeScreen] Tab focused - attempting to show ad');
      showAd();
    }, [showAd])
  );

  // Show login modal automatically when user is not authenticated (only once per session)
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setShowLoginModal(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isAuthLoading, isAuthenticated]);

  const onRefresh = useCallback(() => {
    refetchLive();
    refetchHome();
  }, [refetchLive, refetchHome]);

  const handleCloseModal = () => {
    setShowLoginModal(false);
  };

  const handleGoToLogin = () => {
    setShowLoginModal(false);
    router.push('/auth/login');
  };

  const handleGoToRegister = () => {
    setShowLoginModal(false);
    router.push('/auth/register');
  };

  return (
    <View style={styles.container}>
      {/* Login Prompt Modal */}
      <LoginPromptModal
        visible={showLoginModal}
        onClose={handleCloseModal}
        onLogin={handleGoToLogin}
        onRegister={handleGoToRegister}
      />

      {/* Note: La pub interstitielle AdMob est gérée automatiquement par useAdPopup */}

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
              onViewAll={() => router.push('/(tabs)/matchs')}
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
            onViewAll={() => router.push('/(tabs)/news')}
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
        {(isLoadingHome || tournaments.length > 0) && (
          <View style={styles.section}>
            <SectionHeader 
              title="Tournois en cours" 
              onViewAll={() => router.push('/(tabs)/tournaments')}
            />
            {isLoadingHome && tournaments.length === 0 ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : (
              <View style={styles.verticalList}>
                {tournaments.slice(0, 3).map((tournament) => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    onPress={() => router.push(`/tournament/${tournament.id}`)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

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

