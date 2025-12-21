import { View, StyleSheet, ScrollView, Linking, ActivityIndicator, Alert, Pressable, Animated } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius, shadows } from '@/constants/theme';
import { matchService } from '@/services';
import type { PandaMatch, PandaGame } from '@/types';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<PandaMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation values pour l'effet cascade
  const animHero = useRef(new Animated.Value(0)).current;
  const animSchedule = useRef(new Animated.Value(0)).current;
  const animTournament = useRef(new Animated.Value(0)).current;
  const animGames = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadMatchDetails();
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!loading && match) {
        // Réinitialisation des animations
        animHero.setValue(0);
        animSchedule.setValue(0);
        animTournament.setValue(0);
        animGames.setValue(0);

        const createConfig = (anim: Animated.Value) => 
          Animated.timing(anim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          });

        Animated.stagger(100, [
          createConfig(animHero),
          createConfig(animSchedule),
          createConfig(animTournament),
          createConfig(animGames),
        ]).start();
      }
    }, [loading, match])
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

  const loadMatchDetails = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await matchService.getMatchById(Number(id));
      if (data) setMatch(data);
      else setError('Match introuvable');
    } catch (err) {
      setError('Erreur lors du chargement du match');
    } finally {
      setLoading(false);
    }
  };

  const handleWatchStream = async () => {
    const streamUrl = match?.streams_list?.[0]?.raw_url || match?.live?.url;
    if (!streamUrl) {
      Alert.alert('Stream non disponible', 'Aucun lien de stream disponible.');
      return;
    }
    try {
      if (await Linking.canOpenURL(streamUrl)) await Linking.openURL(streamUrl);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le stream.');
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'TBD';
    try {
      return format(parseISO(dateString), "d MMM yyyy 'à' HH:mm", { locale: fr });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error || !match) {
    return (
      <View style={[styles.container, styles.center]}>
        <MaterialCommunityIcons name="alert-decagram-outline" size={64} color={COLORS.error} />
        <Text style={styles.errorText}>{error || 'Introuvable'}</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const team1 = match.opponents?.[0]?.opponent || match.opponents?.[0]?.team;
  const team2 = match.opponents?.[1]?.opponent || match.opponents?.[1]?.team;
  const score1 = match.results?.[0]?.score ?? 0;
  const score2 = match.results?.[1]?.score ?? 0;
  const isLive = match.status?.toLowerCase() === 'running';
  const hasStream = !!(match.streams_list?.[0]?.raw_url || match.live?.url);

  return (
    <View style={styles.container}>
      {/* Background Gradient Layer */}
      <LinearGradient
        colors={[COLORS.darkBlue, COLORS.darkest]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header Overlay */}
      <View style={styles.topHeader}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="chevron-left" size={32} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text variant="labelLarge" style={styles.leagueNameHeader} numberOfLines={1}>
            {match.league?.name}
          </Text>
          <Text variant="labelSmall" style={styles.tournamentNameHeader} numberOfLines={1}>
            {match.tournament?.name}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Match Hero Section */}
        <Animated.View style={[styles.hero, getAnimatedStyle(animHero)]}>
          <View style={styles.teamsRow}>
            {/* Team 1 */}
            <View style={styles.heroTeam}>
              <View style={[styles.logoContainer, score1 > score2 && styles.winnerLogo]}>
                {team1?.image_url ? (
                  <Image source={{ uri: team1.image_url }} style={styles.heroLogo} contentFit="contain" />
                ) : (
                  <MaterialCommunityIcons name="shield-outline" size={60} color={COLORS.textMuted} />
                )}
              </View>
              <Text variant="titleMedium" style={styles.heroTeamName} numberOfLines={1}>
                {team1?.acronym || team1?.name || 'TBD'}
              </Text>
            </View>

            {/* Score Center */}
            <View style={styles.heroScoreCenter}>
              <View style={styles.scoreBoard}>
                <Text style={styles.heroScoreText}>{score1}</Text>
                <Text style={styles.heroScoreDivider}>:</Text>
                <Text style={styles.heroScoreText}>{score2}</Text>
              </View>
              <View style={styles.matchStatusContainer}>
                {isLive ? (
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>EN DIRECT</Text>
                  </View>
                ) : (
                  <Text style={styles.matchFormat}>BO{match.number_of_games || '?'}</Text>
                )}
              </View>
            </View>

            {/* Team 2 */}
            <View style={styles.heroTeam}>
              <View style={[styles.logoContainer, score2 > score1 && styles.winnerLogo]}>
                {team2?.image_url ? (
                  <Image source={{ uri: team2.image_url }} style={styles.heroLogo} contentFit="contain" />
                ) : (
                  <MaterialCommunityIcons name="shield-outline" size={60} color={COLORS.textMuted} />
                )}
              </View>
              <Text variant="titleMedium" style={styles.heroTeamName} numberOfLines={1}>
                {team2?.acronym || team2?.name || 'TBD'}
              </Text>
            </View>
          </View>

          {hasStream && isLive && (
            <Pressable 
              style={[styles.mainWatchButton, { backgroundColor: COLORS.primary }]} 
              onPress={handleWatchStream}
            >
              <MaterialCommunityIcons name="play-circle" size={24} color="#FFF" />
              <Text style={styles.watchButtonText}>REGARDER LE MATCH</Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
          {/* Schedule Info */}
          <Animated.View style={getAnimatedStyle(animSchedule)}>
            <Surface style={styles.glassCard} elevation={0}>
              <View style={styles.detailItem}>
                <View style={styles.detailIcon}>
                  <MaterialCommunityIcons name="calendar-clock" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Horaire</Text>
                  <Text style={styles.detailValue}>{formatDate(match.begin_at || match.scheduled_at)}</Text>
                </View>
              </View>
            </Surface>
          </Animated.View>

          {/* Tournament Info */}
          <Animated.View style={getAnimatedStyle(animTournament)}>
            <Pressable onPress={() => match.tournament?.id && router.push(`/tournament/${match.tournament.id}`)}>
              <Surface style={styles.glassCard} elevation={0}>
                <View style={styles.detailItem}>
                  <View style={styles.detailIcon}>
                    <MaterialCommunityIcons name="trophy-variant-outline" size={20} color={COLORS.primary} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Tournoi</Text>
                    <Text style={styles.detailValue} numberOfLines={1}>{match.tournament?.name}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textMuted} />
                </View>
              </Surface>
            </Pressable>
          </Animated.View>

          {/* Maps / Series Status */}
          {match.games && match.games.length > 0 && (
            <Animated.View style={[styles.gamesSection, getAnimatedStyle(animGames)]}>
              <Text style={styles.sectionTitle}>Séries / Maps</Text>
              {match.games.map((game: PandaGame, index) => (
                <Surface key={game.id} style={styles.gameGlassCard} elevation={0}>
                  <View style={styles.gameRow}>
                    <Text style={styles.gameIndex}>GAME {index + 1}</Text>
                    <View style={styles.gameStatus}>
                      {game.finished ? (
                        <View style={styles.winnerTag}>
                          <MaterialCommunityIcons name="crown" size={14} color="#FFD700" />
                          <Text style={styles.winnerText}>
                            {game.winner?.id === team1?.id ? (team1?.acronym || team1?.name) : (team2?.acronym || team2?.name)}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.gameLiveText}>{game.status?.toUpperCase() || 'À VENIR'}</Text>
                      )}
                    </View>
                  </View>
                </Surface>
              ))}
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
    paddingTop: 60,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
  tournamentNameHeader: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
  },
  heroTeam: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  winnerLogo: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(242, 46, 98, 0.1)',
  },
  heroLogo: {
    width: 70,
    height: 70,
  },
  heroTeamName: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 14,
    textAlign: 'center',
  },
  heroScoreCenter: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  heroScoreText: {
    color: COLORS.text,
    fontSize: 48,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  heroScoreDivider: {
    color: COLORS.primary,
    fontSize: 32,
    fontWeight: '900',
    opacity: 0.6,
  },
  matchStatusContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  matchFormat: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.live,
  },
  liveText: {
    color: COLORS.live,
    fontSize: 11,
    fontWeight: '900',
  },
  mainWatchButton: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    ...shadows.medium,
  },
  watchButtonText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  detailsSection: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  gamesSection: {
    marginTop: spacing.sm,
  },
  gameGlassCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameIndex: {
    color: COLORS.textSecondary,
    fontWeight: '800',
    fontSize: 12,
  },
  gameStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  winnerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  winnerText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
  },
  gameLiveText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 10,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 16,
    marginVertical: 20,
  },
  backLink: {
    padding: 10,
  },
  backLinkText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
