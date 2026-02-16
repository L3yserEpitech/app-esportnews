import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, Linking, Animated, Alert, Dimensions } from 'react-native';
const { width } = Dimensions.get('window');
import { Text, Surface } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui';
import { LiveMatchCard } from '@/components/features';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius, shadows } from '@/constants/theme';
import { tournamentService } from '@/services/tournamentService';
import { matchService } from '@/services/matchService';
import type { PandaTournament, PandaMatch } from '@/types';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAdPopup, useSubscription } from '@/hooks';

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tournament, setTournament] = useState<PandaTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Publicité - affichage manuel au retour
  const { isSubscribed } = useSubscription();
  const { showAd } = useAdPopup({
    skipIfSubscribed: true,
    isSubscribed,
  });

  // Animation values for cascade effect
  const animHero = useRef(new Animated.Value(0)).current;
  const animInfo = useRef(new Animated.Value(0)).current;
  const animMatches = useRef(new Animated.Value(0)).current;
  const animTeams = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadTournament();

    // Afficher une pub quand l'utilisateur quitte le tournoi (cleanup)
    return () => {
      console.log('[TournamentDetail] User leaving tournament - attempting to show ad');
      showAd();
    };
  }, [id, showAd]);

  useFocusEffect(
    useCallback(() => {
      if (!loading && tournament) {
        // Reset animations
        animHero.setValue(0);
        animInfo.setValue(0);
        animMatches.setValue(0);
        animTeams.setValue(0);

        const createConfig = (anim: Animated.Value) => 
          Animated.timing(anim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          });

        Animated.stagger(100, [
          createConfig(animHero),
          createConfig(animInfo),
          createConfig(animMatches),
          createConfig(animTeams),
        ]).start();
      }
    }, [loading, tournament])
  );

  const getAnimatedStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  });

  const loadTournament = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await tournamentService.getTournamentById(Number(id));
      if (!data) {
        setError('Tournoi introuvable');
        return;
      }

      setTournament(data);

      // Charger les détails complets de chaque match
      if (data.matches && data.matches.length > 0) {
        console.log(`📦 Loading match details for ${data.matches.length} matches...`);
        const matchIds = data.matches.map((m) => m.id);

        try {
          const enrichedMatches = await matchService.getMatchesByIds(matchIds);
          // Remplacer les matchs avec les données enrichies
          setTournament((prevTournament) => {
            if (!prevTournament) return prevTournament;
            return {
              ...prevTournament,
              matches: enrichedMatches,
            };
          });
          console.log(`✅ All ${enrichedMatches.length} match details loaded`);
        } catch (matchError) {
          console.error('⚠️ Error loading match details:', matchError);
          // On continue avec les données de base du tournoi si le chargement détaillé échoue
        }
      }
    } catch (err) {
      setError('Erreur lors du chargement du tournoi');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'TBD';
    try {
      return format(parseISO(dateStr), "d MMMM yyyy", { locale: fr });
    } catch {
      return 'N/A';
    }
  };

  const formatPrizePool = (prize: string | null | undefined) => {
    if (!prize) return 'TBD';
    return prize
      .replace(/United States Dollar/g, '$')
      .replace(/Euro/g, '€')
      .replace(/Pound Sterling/g, '£')
      .replace(/Japanese Yen/g, '¥')
      .replace(/South Korean Won/g, '₩')
      .replace(/Chinese Yuan/g, '¥');
  };

  const statusInfo = (() => {
    if (!tournament) return { label: 'UPCOMING', variant: 'upcoming' as const };
    switch (tournament.status?.toLowerCase()) {
      case 'running': return { label: 'EN DIRECT', variant: 'live' as const };
      case 'finished': return { label: 'TERMINÉ', variant: 'finished' as const };
      default: return { label: 'À VENIR', variant: 'upcoming' as const };
    }
  })();

  const tierColor = (() => {
    if (!tournament) return COLORS.textMuted;
    switch (tournament.tier?.toLowerCase()) {
      case 's': return COLORS.tierS || '#FFD700';
      case 'a': return COLORS.tierA || '#FF4D4D';
      case 'b': return COLORS.tierB || '#4D79FF';
      case 'c': return COLORS.tierC || '#4DFF4D';
      default: return COLORS.textMuted;
    }
  })();

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Synchronisation du tournoi...</Text>
      </View>
    );
  }

  if (error || !tournament) {
    return (
      <View style={[styles.container, styles.center]}>
        <MaterialCommunityIcons name="trophy-broken" size={64} color={COLORS.error} />
        <Text style={styles.errorText}>{error || 'Introuvable'}</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retourner à la liste</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background Gradient Layer */}
      <LinearGradient
        colors={[COLORS.darkBlue, COLORS.darkest]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header Overlay */}
      <View style={[
        styles.topHeader, 
        { 
          paddingTop: Math.max(insets.top, spacing.sm),
          backgroundColor: 'transparent'
        }
      ]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="chevron-left" size={32} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text variant="labelLarge" style={styles.leagueNameHeader} numberOfLines={1}>
            {tournament.league?.name || 'Tournoi'}
          </Text>
          <Text variant="labelSmall" style={styles.tierNameHeader} numberOfLines={1}>
             {tournament.tier ? `TIER ${tournament.tier.toUpperCase()}` : 'PRO LEAGUE'}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingTop: insets.top + (spacing.lg * 3) }
        ]} 
        showsVerticalScrollIndicator={false}
      >
        {/* Tournament Hero Section */}
        <Animated.View style={[styles.hero, getAnimatedStyle(animHero)]}>
          <View style={styles.heroLogoContainer}>
             {tournament.league?.image_url ? (
               <Image source={{ uri: tournament.league.image_url }} style={styles.heroLogo} contentFit="contain" />
             ) : (
               <MaterialCommunityIcons name="trophy-variant" size={80} color={COLORS.primary} />
             )}
             <LinearGradient
               colors={['transparent', COLORS.primary + '20', 'transparent']}
               style={StyleSheet.absoluteFillObject}
             />
          </View>
          
          <Text variant="headlineMedium" style={styles.heroTitle}>
            {tournament.name}
          </Text>

          <View style={styles.heroBadges}>
             <Badge label={statusInfo.label} variant={statusInfo.variant} />
             {tournament.videogame?.name && (
               <View style={styles.gameBadge}>
                 <Text style={styles.gameBadgeText}>{tournament.videogame.name}</Text>
               </View>
             )}
          </View>
        </Animated.View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
          <Animated.View style={getAnimatedStyle(animInfo)}>
            <View style={styles.gridContainer}>
              {/* Prize Pool */}
              <Surface style={styles.glassCardSmall} elevation={0}>
                <MaterialCommunityIcons name="cash-multiple" size={24} color={COLORS.primary} />
                <View>
                  <Text style={styles.detailLabel}>PRIZEPOOL</Text>
                  <Text style={styles.detailValue}>{formatPrizePool(tournament.prizepool)}</Text>
                </View>
              </Surface>

              {/* Region */}
              <Surface style={styles.glassCardSmall} elevation={0}>
                <MaterialCommunityIcons name="earth" size={24} color={COLORS.primary} />
                <View>
                  <Text style={styles.detailLabel}>RÉGION</Text>
                  <Text style={styles.detailValue}>{tournament.region || 'International'}</Text>
                </View>
              </Surface>
            </View>

            <Surface style={styles.glassCard} elevation={0}>
               <View style={styles.detailItem}>
                 <View style={styles.detailIcon}>
                   <MaterialCommunityIcons name="calendar-range" size={20} color={COLORS.primary} />
                 </View>
                 <View style={styles.detailContent}>
                   <Text style={styles.detailLabel}>DATES</Text>
                   <Text style={styles.detailValue}>
                     du {formatDate(tournament.begin_at)} au {formatDate(tournament.end_at)}
                   </Text>
                 </View>
               </View>
            </Surface>
          </Animated.View>

          {/* Matches Section */}
          {tournament.matches && tournament.matches.length > 0 && (
            <Animated.View style={[styles.section, getAnimatedStyle(animMatches)]}>
              <Text style={styles.sectionTitle}>Matchs récents / à venir</Text>
              <View style={styles.matchesContainer}>
                {tournament.matches.slice(0, 8).map((match) => (
                  <View key={match.id} style={styles.cardWrapper}>
                    <LiveMatchCard
                      match={match as any}
                      onPress={() => router.push(`/match/${match.id}`)}
                      fullWidth={true}
                    />
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Teams Section */}
          {tournament.teams && tournament.teams.length > 0 && (
            <Animated.View style={[styles.section, getAnimatedStyle(animTeams)]}>
              <Text style={styles.sectionTitle}>Équipes participantes</Text>
              <View style={styles.teamsGrid}>
                {tournament.teams.map((team) => (
                  <Surface key={team.id} style={styles.teamGlassCard} elevation={0}>
                    {team.image_url ? (
                      <Image source={{ uri: team.image_url }} style={styles.teamLogo} contentFit="contain" />
                    ) : (
                      <MaterialCommunityIcons name="shield-outline" size={32} color={COLORS.textMuted} />
                    )}
                    <Text numberOfLines={1} style={styles.teamNameText}>
                      {team.acronym || team.name}
                    </Text>
                  </Surface>
                ))}
              </View>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    zIndex: 10,
    borderBottomWidth: 0,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerInfo: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  leagueNameHeader: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  tierNameHeader: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  heroLogoContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  heroLogo: {
    width: 90,
    height: 90,
  },
  heroTitle: {
    color: COLORS.text,
    fontWeight: '900',
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 32,
    marginBottom: spacing.md,
  },
  heroBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gameBadge: {
    backgroundColor: 'rgba(242, 46, 98, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  gameBadgeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailsSection: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  gridContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  glassCardSmall: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(242, 46, 98, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  detailValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  matchesContainer: {
    gap: 0,
  },
  cardWrapper: {
    marginBottom: spacing.sm,
    width: '100%',
  },
  teamsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  teamGlassCard: {
    width: (width - (spacing.md * 2) - (spacing.sm * 3)) / 4,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  teamLogo: {
    width: 38,
    height: 38,
    marginBottom: 6,
  },
  teamNameText: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 10,
    fontWeight: '600',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 16,
    marginVertical: 20,
    fontWeight: '700',
  },
  backLink: {
    padding: 12,
    backgroundColor: COLORS.primary + '20',
    borderRadius: borderRadius.md,
  },
  backLinkText: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
