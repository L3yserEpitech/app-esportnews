import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';
import { matchService } from '@/services';
import type { PandaMatch, PandaGame } from '@/types';
import { useAdPopup, useSubscription } from '@/hooks';
import { ValorantGameBlock } from '@/components/match-detail/sections/valorant/ValorantGameCards';
import { LolGameBlock } from '@/components/match-detail/sections/leagueoflegends/LolGameCards';
import { DotaGameBlock } from '@/components/match-detail/sections/dota2/DotaGameCards';
import { CsGameBlock } from '@/components/match-detail/sections/counterstrike/CsGameCards';
import { R6GameBlock } from '@/components/match-detail/sections/rainbowsix/R6GameCards';
import { OwGameBlock } from '@/components/match-detail/sections/overwatch/OwGameCards';

const POLL_MS = 45000;

// Per-wiki full-block dispatcher for the game page. Covers all six rich wikis;
// any other wiki (or a game with no drillable data) falls through to a graceful
// message.
function GameDetailBlock({ match, game }: { match: PandaMatch; game: PandaGame }) {
  switch (match.wiki) {
    case 'valorant':
      return <ValorantGameBlock match={match} game={game} />;
    case 'leagueoflegends':
      return <LolGameBlock match={match} game={game} />;
    case 'dota2':
      return <DotaGameBlock match={match} game={game} />;
    case 'counterstrike':
      return <CsGameBlock match={match} game={game} />;
    case 'rainbowsix':
      return <R6GameBlock match={match} game={game} />;
    case 'overwatch':
      return <OwGameBlock match={match} game={game} />;
    default:
      return (
        <View style={styles.unavailable}>
          <MaterialCommunityIcons name="information-outline" size={40} color={COLORS.textMuted} />
          <Text style={styles.unavailableText}>Détails indisponibles pour cette game.</Text>
        </View>
      );
  }
}

export default function GameDetailScreen() {
  const { id, n, wiki } = useLocalSearchParams<{ id: string; n: string; wiki?: string }>();
  const wikiParam = typeof wiki === 'string' && wiki.length > 0 ? wiki : undefined;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [match, setMatch] = useState<PandaMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isSubscribed } = useSubscription();
  const { showAd } = useAdPopup({ skipIfSubscribed: true, isSubscribed });

  const loadMatch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await matchService.getMatchById(Number(id), wikiParam);
      if (data) setMatch(data);
      else setError('Match introuvable');
    } catch {
      setError('Erreur lors du chargement du match');
    } finally {
      setLoading(false);
    }
  }, [id, wikiParam]);

  useEffect(() => {
    loadMatch();
    return () => { showAd(); };
  }, [loadMatch, showAd]);

  const isLive = match?.status === 'running';

  // Live polling: refetch every 45s while running; never poll otherwise.
  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(async () => {
      try {
        const fresh = await matchService.getMatchById(Number(id), wikiParam);
        if (fresh) setMatch(fresh);
      } catch { /* keep last good state */ }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [isLive, id, wikiParam]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const game = match
    ? match.games?.find(g => String(g.position) === String(n)) ?? match.games?.[Number(n) - 1]
    : undefined;

  if (error || !match || !game) {
    return (
      <View style={[styles.container, styles.center]}>
        <MaterialCommunityIcons name="alert-decagram-outline" size={64} color={COLORS.error} />
        <Text style={styles.errorText}>{error || 'Game introuvable'}</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const gameLabel = `Game ${game.position ?? n}`;
  const subtitle = game.map ? `${gameLabel} · ${game.map}` : gameLabel;

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.darkBlue, COLORS.darkest]} style={StyleSheet.absoluteFillObject} />

      {/* Top overlay header */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="chevron-left" size={32} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text variant="labelLarge" style={styles.matchNameHeader} numberOfLines={1}>
            {match.name || match.tournament?.name || 'Match'}
          </Text>
          <Text variant="labelSmall" style={styles.subtitleHeader} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <GameDetailBlock match={match} game={game} />
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
  matchNameHeader: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  subtitleHeader: {
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  body: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.xl,
  },
  unavailable: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  unavailableText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
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
