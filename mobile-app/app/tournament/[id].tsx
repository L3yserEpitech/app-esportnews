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
import { tournamentService } from '@/services/tournamentService';
import { matchService } from '@/services/matchService';
import type { PandaTournament, PandaMatch } from '@/types';
import { useAdPopup, useSubscription } from '@/hooks';
import { resolveSections, type SectionId } from '@/components/tournament-detail/tournamentSections';
import type { TournamentSectionProps } from '@/components/tournament-detail/sections/shared';
import TournamentHeader from '@/components/tournament-detail/sections/TournamentHeader';
import LiveMatches from '@/components/tournament-detail/sections/LiveMatches';
import AllMatches from '@/components/tournament-detail/sections/AllMatches';
import BracketSection from '@/components/tournament-detail/sections/BracketSection';
import RostersSection from '@/components/tournament-detail/sections/RostersSection';
import RelatedNews from '@/components/tournament-detail/sections/RelatedNews';

// Backend tournament match lists can repeat entries; dedupe by stable key so
// every section (bracket, all matches) renders each match once.
function dedupeMatches(list: PandaMatch[]): PandaMatch[] {
  const seen = new Set<string>();
  return list.filter((m) => {
    const key = m.match2id || String(m.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function TournamentDetailScreen() {
  const { id, wiki } = useLocalSearchParams<{ id: string; wiki?: string }>();
  const wikiParam = typeof wiki === 'string' && wiki.length > 0 ? wiki : undefined;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tournament, setTournament] = useState<PandaTournament | null>(null);
  const [matches, setMatches] = useState<PandaMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isSubscribed } = useSubscription();
  const { showAd } = useAdPopup({ skipIfSubscribed: true, isSubscribed });

  const loadTournament = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await tournamentService.getTournamentById(Number(id), wikiParam);
      if (!data) {
        setError('Tournoi introuvable');
        return;
      }
      setTournament(data);
      setMatches(dedupeMatches(data.matches ?? []));

      // Enrich matches (base list often lacks opponents/scores) via detail fetch.
      if (data.matches && data.matches.length > 0) {
        setIsLoadingMatches(true);
        // Dedupe ids up front — the tournament match list can repeat entries,
        // which otherwise duplicates cells + trips React's unique-key check.
        const matchIds = [...new Set(data.matches.map((m) => m.match2id || String(m.id)))];
        try {
          const enriched = await matchService.getMatchesByIds(matchIds, wikiParam);
          if (enriched.length > 0) setMatches(dedupeMatches(enriched));
        } catch (matchError) {
          console.error('[Tournament Detail] Error loading match details:', matchError);
        } finally {
          setIsLoadingMatches(false);
        }
      }
    } catch {
      setError('Erreur lors du chargement du tournoi');
    } finally {
      setLoading(false);
    }
  }, [id, wikiParam]);

  useEffect(() => {
    loadTournament();
    // Show an ad when the user leaves the tournament screen.
    return () => { showAd(); };
  }, [loadTournament, showAd]);

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

  const sectionProps: TournamentSectionProps = { tournament, matches, isLoadingMatches };
  const sections = resolveSections(tournament.wiki ?? wikiParam ?? undefined);

  const renderSection = (sectionId: SectionId) => {
    switch (sectionId) {
      case 'header': return <TournamentHeader key={sectionId} {...sectionProps} />;
      case 'liveMatches': return <LiveMatches key={sectionId} {...sectionProps} />;
      case 'allMatches': return <AllMatches key={sectionId} {...sectionProps} />;
      case 'bracket': return <BracketSection key={sectionId} {...sectionProps} />;
      case 'rosters': return <RostersSection key={sectionId} {...sectionProps} />;
      case 'relatedNews': return <RelatedNews key={sectionId} {...sectionProps} />;
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
            {tournament.league?.name || 'Tournoi'}
          </Text>
          <Text variant="labelSmall" style={styles.tierNameHeader} numberOfLines={1}>
            {tournament.tier ? `TIER ${tournament.tier.toUpperCase()}` : 'PRO LEAGUE'}
          </Text>
        </View>
        <SubscribeButton
          type="tournament"
          id={Number(id)}
          meta={{
            tournament_name: tournament.name || '',
            game_acronym: tournament.videogame?.slug || '',
            begin_at: tournament.begin_at || undefined,
            end_at: tournament.end_at || undefined,
            match_ids: matches.map((m) => m.id),
          }}
          size={24}
          style={styles.iconButton}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
  tierNameHeader: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  body: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.xl,
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
    backgroundColor: COLORS.primaryTransparent,
    borderRadius: 12,
  },
  backLinkText: {
    color: COLORS.primary,
    fontWeight: '800',
  },
});
