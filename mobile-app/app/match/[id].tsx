import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SubscribeButton } from '@/components/features/SubscribeButton';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';
import { matchService } from '@/services';
import type { PandaMatch } from '@/types';
import { useAdPopup, useSubscription } from '@/hooks';
import { resolveSections, type SectionId } from '@/components/match-detail/matchSections';
import type { MatchSectionProps } from '@/components/match-detail/sections/shared';
import MatchHeader from '@/components/match-detail/sections/MatchHeader';
import GameResults from '@/components/match-detail/sections/GameResults';
import PlayerStatsTable from '@/components/match-detail/sections/PlayerStatsTable';
import StreamPlayer from '@/components/match-detail/sections/StreamPlayer';
import RostersPanel from '@/components/match-detail/sections/RostersPanel';
import ExternalStatsLinks from '@/components/match-detail/sections/ExternalStatsLinks';

const POLL_MS = 45000;

export default function MatchDetailScreen() {
  const { id, wiki } = useLocalSearchParams<{ id: string; wiki?: string }>();
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
    // Show an ad when the user leaves the match screen.
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
  const sectionProps: MatchSectionProps = { match, isLive: !!isLive };
  const sections = resolveSections(match.wiki ?? wikiParam ?? undefined, !!isLive);

  const renderSection = (sectionId: SectionId) => {
    switch (sectionId) {
      case 'header': return <MatchHeader key={sectionId} {...sectionProps} />;
      case 'gameResults': return <GameResults key={sectionId} {...sectionProps} />;
      case 'playerStats': return <PlayerStatsTable key={sectionId} {...sectionProps} />;
      case 'stream': return <StreamPlayer key={sectionId} {...sectionProps} />;
      case 'rosters': return <RostersPanel key={sectionId} {...sectionProps} />;
      case 'externalLinks': return <ExternalStatsLinks key={sectionId} {...sectionProps} />;
      // 'draft' is embedded per-game in gameResults (rich wikis) — no standalone section.
      case 'draft':
      default:
        return null;
    }
  };

  const headerIds = sections.filter(s => s === 'header');
  const bodyIds = sections.filter(s => s !== 'header');

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.darkBlue, COLORS.darkest]} style={StyleSheet.absoluteFillObject} />

      {/* Top overlay header */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="chevron-left" size={32} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text variant="labelLarge" style={styles.leagueNameHeader} numberOfLines={1}>
            {match.league?.name || match.tournament?.name}
          </Text>
          {match.tournament?.name ? (
            <Text variant="labelSmall" style={styles.tournamentNameHeader} numberOfLines={1}>
              {match.tournament.name}
            </Text>
          ) : null}
        </View>
        <SubscribeButton
          type="match"
          id={Number(id)}
          meta={{
            match_name: match.name || `${team1?.acronym || team1?.name || 'TBD'} vs ${team2?.acronym || team2?.name || 'TBD'}`,
            tournament_name: match.tournament?.name || '',
            game_acronym: match.videogame?.slug || '',
            begin_at: match.begin_at || undefined,
          }}
          size={24}
          style={styles.iconButton}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {headerIds.map(renderSection)}
        <View style={styles.body}>
          {bodyIds.map(renderSection)}
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
  body: {
    paddingTop: spacing.lg,
    gap: spacing.xl,
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
