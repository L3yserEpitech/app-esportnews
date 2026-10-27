'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Swords } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { LiveMatch, Advertisement } from '../../types';
import { matchService } from '../../services/matchService';
import { teamService } from '../../services/teamService';
import { advertisementService } from '../../services/advertisementService';
import AdColumn from '../../components/ads/AdColumn';
import ContentLoader from '../../components/ui/ContentLoader';
import { prewarmFromData } from '../../lib/imageProxy';
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme';
import { gameByWiki } from '../../lib/gameRegistry';
import { resolveSections, type SectionId } from './matchSections';
import { loadOpponentTeams } from './opponentTeams';
import type { MatchSectionProps } from './sections/shared';
import MatchHeader from './sections/MatchHeader';
import GameResults from './sections/GameResults';
import StreamPlayer from './sections/StreamPlayer';
import DraftPanel from './sections/DraftPanel';
import PlayerStatsTable from './sections/PlayerStatsTable';
import RostersPanel from './sections/RostersPanel';
import ExternalStatsLinks from './sections/ExternalStatsLinks';

const POLL_MS = 45000;

interface MatchDetailPageClientProps {
  matchId: string;
  wiki?: string;
  initialMatch?: LiveMatch | null;
}

export default function MatchDetailPageClient({ matchId, wiki, initialMatch }: MatchDetailPageClientProps) {
  const t = useTranslations('pages_detail.match_detail');
  const tToast = useTranslations('toast');
  const isDark = useIsDarkTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const hasRedirected = useRef(false);
  const [match, setMatch] = useState<LiveMatch | null>(initialMatch || null);
  const [loading, setLoading] = useState(!initialMatch);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);
  const [teamsData, setTeamsData] = useState<any[]>([]);

  useEffect(() => { prewarmFromData([match, teamsData]); }, [match, teamsData]);

  useEffect(() => {
    (async () => {
      try {
        setIsLoadingAds(true);
        setAds(await advertisementService.getActiveAdvertisements());
      } catch (e) {
        console.error('Erreur lors du chargement des publicités:', e);
      } finally {
        setIsLoadingAds(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!match) return;
    let cancelled = false;
    loadOpponentTeams(match.opponents, match.wiki || wiki, (template, w, name) => teamService.getTeamByTemplate(template, w, name))
      .then((teams) => { if (!cancelled) setTeamsData(teams); });
    return () => { cancelled = true; };
  }, [match, wiki]);

  useEffect(() => {
    if (initialMatch) return;
    const loadMatch = async () => {
      try {
        setLoading(true);
        setMatch(await matchService.getMatchById(matchId, wiki));
      } catch (err) {
        console.error('Error loading match:', err);
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          showToast({
            message: tToast('match_not_available'),
            linkUrl: `https://liquipedia.net/${wiki || 'valorant'}/Main_Page`,
            linkLabel: tToast('view_on_liquipedia'),
            duration: 10000,
          });
          router.back();
        }
      } finally {
        setLoading(false);
      }
    };
    if (matchId) loadMatch();
  }, [matchId, initialMatch]);

  // Live polling: refetch every 45s while the match is running.
  useEffect(() => {
    if (match?.status !== 'running') return;
    const id = setInterval(async () => {
      try {
        const fresh = await matchService.getMatchById(matchId, wiki);
        if (fresh) setMatch(fresh);
      } catch {}
    }, POLL_MS);
    return () => clearInterval(id);
  }, [match?.status, matchId, wiki]);

  const memoizedAds = useMemo(() => ads, [ads]);

  if (loading || !match) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <main className="container mx-auto px-4 pt-24 md:pt-27 pb-16">
          <div className="flex gap-8">
            <div className="flex-1 min-w-0">
              <ContentLoader label={t('loading')} icon={Swords} />
            </div>
            <AdColumn ads={memoizedAds} isSubscribed={isSubscribed} isLoading={isLoadingAds} />
          </div>
        </main>
      </div>
    );
  }

  const game = gameByWiki(match.wiki || wiki || '');
  const isLive = match.status === 'running';
  const sectionProps: MatchSectionProps = { match, game, isLive, isDark };
  const sections = resolveSections(match.wiki || wiki || undefined, isLive);

  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;

  const renderSection = (id: SectionId) => {
    switch (id) {
      case 'header': return <MatchHeader key={id} {...sectionProps} />;
      case 'gameResults': return <GameResults key={id} {...sectionProps} />;
      case 'draft': return <DraftPanel key={id} {...sectionProps} />;
      case 'playerStats': return <PlayerStatsTable key={id} {...sectionProps} />;
      case 'externalLinks': return <ExternalStatsLinks key={id} {...sectionProps} />;
      case 'stream': return <StreamPlayer key={id} {...sectionProps} />;
      case 'rosters': return <RostersPanel key={id} {...sectionProps} teamsData={teamsData} />;
      default: return null;
    }
  };

  const headerIds = sections.filter(s => s === 'header');
  const bodyIds = sections.filter(s => s !== 'header');

  return (
    <div className="min-h-screen bg-bg-primary">
      <h1 className="sr-only">{homeTeam?.name || 'Match'} vs {awayTeam?.name || 'Match'} - {match.videogame?.name} - {match.tournament?.name}</h1>

      {headerIds.map(renderSection)}

      <main className="container mx-auto px-4 pt-8 md:pt-10 pb-16">
        <div className="flex gap-8">
          <div className="flex-1 min-w-0 space-y-10">{bodyIds.map(renderSection)}</div>
          <AdColumn ads={memoizedAds} isSubscribed={isSubscribed} isLoading={isLoadingAds} />
        </div>
      </main>
    </div>
  );
}
