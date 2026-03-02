'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Gamepad2,
  Radio,
  Trophy,
  Users,
  AlertCircle,
  Play,
  Calendar,
  Info,
  ExternalLink,
} from 'lucide-react';
import { PandaMatch, LiveMatch, Advertisement, PandaPlayer } from '../../types';
import { matchService } from '../../services/matchService';
import { teamService } from '../../services/teamService';
import { advertisementService } from '../../services/advertisementService';
import AdColumn from '../../components/ads/AdColumn';
import Card from '../../components/ui/Card';
import { SportsEventSchema, BreadcrumbSchema } from '../../components/seo/StructuredData';
import { generateBreadcrumbs } from '../../lib/breadcrumbHelper';

interface MatchDetailPageClientProps {
  matchId: string;
}

// --- Helpers ---

const getTierClasses = (tier: string | null | undefined): string => {
  const t = tier?.toLowerCase();
  const map: Record<string, string> = {
    s: 'bg-[var(--color-tier-s)]/20 text-[var(--color-tier-s)] border border-[var(--color-tier-s)]/40',
    a: 'bg-[var(--color-tier-a)]/20 text-[var(--color-tier-a)] border border-[var(--color-tier-a)]/40',
    b: 'bg-[var(--color-tier-b)]/20 text-[var(--color-tier-b)] border border-[var(--color-tier-b)]/40',
    c: 'bg-[var(--color-tier-c)]/20 text-[var(--color-tier-c)] border border-[var(--color-tier-c)]/40',
    d: 'bg-[var(--color-tier-d)]/20 text-[var(--color-tier-d)] border border-[var(--color-tier-d)]/40',
  };
  return t ? map[t] || map['d'] : map['d'];
};

const getStatusClasses = (status: string | null | undefined): string => {
  const map: Record<string, string> = {
    running: 'bg-[var(--color-status-live)]/20 text-[var(--color-status-live)] border border-[var(--color-status-live)]/40',
    not_started: 'bg-[var(--color-status-upcoming)]/20 text-[var(--color-status-upcoming)] border border-[var(--color-status-upcoming)]/40',
    finished: 'bg-[var(--color-status-finished)]/20 text-[var(--color-status-finished)] border border-[var(--color-status-finished)]/40',
  };
  return map[status || 'not_started'] || map['not_started'];
};

const parseGameWinner = (winner: unknown): { id: number | null; type: string } | null => {
  if (!winner) return null;
  if (typeof winner === 'object' && winner !== null && 'id' in winner) {
    return winner as { id: number | null; type: string };
  }
  if (typeof winner === 'string') {
    try { return JSON.parse(winner); } catch { return null; }
  }
  return null;
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between px-5 py-3">
    <span className="text-text-muted text-sm">{label}</span>
    <span className="text-text-primary text-sm font-medium text-right max-w-[60%] truncate">{value}</span>
  </div>
);

export default function MatchDetailPageClient({ matchId }: MatchDetailPageClientProps) {
  const t = useTranslations('pages_detail.match_detail');
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);
  const [selectedStreamIdx, setSelectedStreamIdx] = useState(0);
  const [teamsData, setTeamsData] = useState<any[]>([]);

  // Load ads
  useEffect(() => {
    const loadAds = async () => {
      try {
        setIsLoadingAds(true);
        const fetchedAds = await advertisementService.getActiveAdvertisements();
        setAds(fetchedAds);
      } catch (error) {
        console.error('Erreur lors du chargement des publicités:', error);
      } finally {
        setIsLoadingAds(false);
      }
    };
    loadAds();
  }, []);

  // Load match
  useEffect(() => {
    const loadMatch = async () => {
      try {
        setLoading(true);
        const data = await matchService.getMatchById(matchId);
        setMatch(data);

        if (data.opponents && data.opponents.length === 2) {
          try {
            const teamIds = data.opponents
              .filter(o => o.opponent)
              .map(o => o.opponent!.id);
            const teams = await teamService.getTeamsByIds(teamIds);
            setTeamsData(teams);
          } catch (teamError) {
            console.error('Error loading team details:', teamError);
          }
        }
      } catch (err) {
        console.error('Error loading match:', err);
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement du match');
      } finally {
        setLoading(false);
      }
    };
    if (matchId) loadMatch();
  }, [matchId]);

  const memoizedAds = useMemo(() => ads, [ads]);

  // Format utilities
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remaining = minutes % 60;
      return `${hours}h${remaining > 0 ? `${remaining}m` : ''}`;
    }
    return `${minutes}m`;
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-text-accent border-t-text-accent/30 rounded-full animate-spin mb-4" />
          <p className="text-text-secondary">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error || !match) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Card variant="outlined" className="p-8 max-w-md">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <p className="text-red-400 font-medium mb-2">{t('error_title')}</p>
              <p className="text-text-secondary text-sm">
                {error || t('not_found')}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // --- Data extraction ---
  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;
  const homeScore = match.results?.find(r => r.team_id === homeTeam?.id)?.score;
  const awayScore = match.results?.find(r => r.team_id === awayTeam?.id)?.score;
  const isHomeWinnerOverall = homeScore !== undefined && awayScore !== undefined && homeScore > awayScore;
  const isAwayWinnerOverall = homeScore !== undefined && awayScore !== undefined && awayScore > homeScore;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
  const matchUrl = `${siteUrl}/match/${matchId}`;

  const breadcrumbs = generateBreadcrumbs([
    { name: t('breadcrumb_home'), url: '/' },
    { name: t('breadcrumb_matchs'), url: '/match' },
    { name: `${homeTeam?.name || 'Match'} vs ${awayTeam?.name || 'Match'}`, url: matchUrl },
  ]);

  const statusKey = match.status === 'running' ? 'status_running' : match.status === 'finished' ? 'status_finished' : 'status_upcoming';

  // Streams sorted
  const sortedStreams = [...(match.streams_list || [])].sort((a, b) => {
    if (a.official && !b.official) return -1;
    if (!a.official && b.official) return 1;
    if (a.main && !b.main) return -1;
    if (!a.main && b.main) return 1;
    return 0;
  });

  const selectedStream = sortedStreams[selectedStreamIdx];
  const isTwitch = selectedStream?.raw_url?.includes('twitch');
  const isYoutube = selectedStream?.raw_url?.includes('youtube');

  const getTwitchChannel = (url: string) => {
    const m = url.match(/twitch\.tv\/([^/?]+)/);
    return m ? m[1] : '';
  };
  const getYoutubeId = (url: string) => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([^&/?]+)/);
    return m ? m[1] : '';
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* SEO Structured Data */}
      <SportsEventSchema
        name={`${homeTeam?.name || 'Match'} vs ${awayTeam?.name || 'Match'}`}
        description={`${match.videogame?.name || 'Esport'} - ${match.league?.name || ''}`}
        startDate={match.begin_at || new Date().toISOString()}
        endDate={match.end_at || undefined}
        url={matchUrl}
        location={match.tournament?.region || undefined}
        image={homeTeam?.image_url || undefined}
        teams={[
          ...(homeTeam ? [{ name: homeTeam.name, logo: homeTeam.image_url || undefined }] : []),
          ...(awayTeam ? [{ name: awayTeam.name, logo: awayTeam.image_url || undefined }] : []),
        ]}
      />
      <BreadcrumbSchema items={breadcrumbs} />

      {/* Hidden H1 for SEO */}
      <h1 className="sr-only">
        {homeTeam?.name || 'Match'} vs {awayTeam?.name || 'Match'} - {match.videogame?.name} - {match.tournament?.name}
      </h1>

      {/* ============================================ */}
      {/* HERO SECTION - Full bleed                    */}
      {/* ============================================ */}
      <section className="relative w-full overflow-hidden pt-20 pb-8 md:pb-12">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#091626] via-bg-primary to-bg-primary" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-[#F22E62]/8 rounded-full blur-[120px]" />
          <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-[#182859]/20 rounded-full blur-[120px]" />
        </div>

        <div className="relative container mx-auto px-4">
          {/* Row 1: Status badges */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-8 pt-4">
            {/* Match status */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusClasses(match.status)}`}>
              {match.status === 'running' && <span className="w-2 h-2 bg-current rounded-full animate-pulse" />}
              {t(statusKey)}
            </span>
            {/* Tournament tier */}
            {match.tournament?.tier && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${getTierClasses(match.tournament.tier)}`}>
                {t('tier_label')} {match.tournament.tier.toUpperCase()}
              </span>
            )}
            {/* Game */}
            {match.videogame?.name && (
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-bg-tertiary/50 text-text-secondary border border-border-primary">
                {match.videogame.name}
              </span>
            )}
            {/* Rescheduled */}
            {match.rescheduled && (
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30">
                {t('badge_rescheduled')}
              </span>
            )}
          </div>

          {/* Row 2: Team vs Team Matchup */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 mb-8">
            {/* Home team */}
            <div className="flex flex-col md:flex-row items-center gap-3 md:gap-5 flex-1 justify-center md:justify-end">
              <div className="text-center md:text-right order-2 md:order-1">
                <p className="text-xl md:text-3xl font-black text-text-primary leading-tight">
                  {homeTeam?.name || '-'}
                </p>
                {homeTeam?.acronym && homeTeam.acronym !== homeTeam.name && (
                  <p className="text-sm text-text-accent font-semibold">{homeTeam.acronym}</p>
                )}
                {homeTeam?.location && (
                  <p className="text-xs text-text-muted mt-1">{homeTeam.location}</p>
                )}
              </div>
              <div className={`w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-bg-secondary border flex items-center justify-center overflow-hidden order-1 md:order-2 transition-colors ${isHomeWinnerOverall ? 'border-text-accent/50 shadow-lg shadow-text-accent/10' : 'border-border-primary'}`}>
                {homeTeam?.image_url ? (
                  <img src={homeTeam.image_url} alt={homeTeam.name} className="w-full h-full object-contain p-2" loading="lazy" />
                ) : (
                  <Trophy className="w-10 h-10 text-text-muted" />
                )}
              </div>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-2 px-4 md:px-8 flex-shrink-0">
              {match.status === 'finished' && homeScore !== undefined && awayScore !== undefined ? (
                <>
                  <div className="text-5xl md:text-7xl font-black tracking-tight">
                    <span className={isHomeWinnerOverall ? 'text-text-accent' : 'text-text-primary'}>
                      {homeScore}
                    </span>
                    <span className="text-text-muted mx-2 md:mx-4">:</span>
                    <span className={isAwayWinnerOverall ? 'text-text-accent' : 'text-text-primary'}>
                      {awayScore}
                    </span>
                  </div>
                  {match.winner && (
                    <p className="text-xs text-text-accent font-semibold flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      {match.winner.name || match.winner.acronym} {t('wins')}
                    </p>
                  )}
                </>
              ) : match.status === 'running' ? (
                <>
                  <div className="text-5xl md:text-7xl font-black tracking-tight">
                    <span className="text-text-accent">{homeScore ?? 0}</span>
                    <span className="text-text-muted mx-2 md:mx-4">:</span>
                    <span className="text-text-accent">{awayScore ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--color-status-live)]">
                    <span className="w-2.5 h-2.5 bg-[var(--color-status-live)] rounded-full animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider">{t('status_running')}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl md:text-6xl font-black text-text-muted">VS</div>
                  <p className="text-xs text-[var(--color-status-upcoming)] font-semibold">{t('status_upcoming')}</p>
                </>
              )}
              {match.number_of_games && (
                <span className="text-xs text-text-muted bg-bg-tertiary/50 px-3 py-1 rounded-full mt-1">
                  {t('bo_prefix')}{match.number_of_games}
                </span>
              )}
            </div>

            {/* Away team */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-3 md:gap-5 flex-1 justify-center md:justify-end">
              <div className="text-center md:text-left order-2 md:order-1">
                <p className="text-xl md:text-3xl font-black text-text-primary leading-tight">
                  {awayTeam?.name || '-'}
                </p>
                {awayTeam?.acronym && awayTeam.acronym !== awayTeam.name && (
                  <p className="text-sm text-text-accent font-semibold">{awayTeam.acronym}</p>
                )}
                {awayTeam?.location && (
                  <p className="text-xs text-text-muted mt-1">{awayTeam.location}</p>
                )}
              </div>
              <div className={`w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-bg-secondary border flex items-center justify-center overflow-hidden order-1 md:order-2 transition-colors ${isAwayWinnerOverall ? 'border-text-accent/50 shadow-lg shadow-text-accent/10' : 'border-border-primary'}`}>
                {awayTeam?.image_url ? (
                  <img src={awayTeam.image_url} alt={awayTeam.name} className="w-full h-full object-contain p-2" loading="lazy" />
                ) : (
                  <Trophy className="w-10 h-10 text-text-muted" />
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Context pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-xs">
            {/* Tournament */}
            {match.tournament?.name && (
              <div className="flex items-center gap-2 bg-bg-secondary/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border-primary">
                {(match.tournament as any)?.icon_url && (
                  <img src={(match.tournament as any).icon_url} alt="" className="w-4 h-4 object-contain" />
                )}
                <span className="text-text-muted">{t('info_tournament')}:</span>
                <span className="text-text-primary font-medium">{match.tournament.name}</span>
              </div>
            )}
            {/* League */}
            {match.league && (
              <div className="flex items-center gap-2 bg-bg-secondary/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border-primary">
                {match.league.image_url && (
                  <img src={match.league.image_url} alt="" className="w-4 h-4 object-contain" />
                )}
                <span className="text-text-muted">{t('info_league')}:</span>
                <span className="text-text-primary font-medium">{match.league.name}</span>
              </div>
            )}
            {/* Region */}
            {match.tournament?.region && (
              <div className="flex items-center gap-2 bg-bg-secondary/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border-primary">
                <span className="text-text-muted">{t('info_region')}:</span>
                <span className="text-text-primary font-medium">{match.tournament.region}</span>
              </div>
            )}
            {/* Date / Time */}
            {match.begin_at && (
              <div className="flex items-center gap-2 bg-bg-secondary/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border-primary">
                <Calendar className="w-3.5 h-3.5 text-text-accent" />
                <span className="text-text-primary font-medium">{formatDate(match.begin_at)}</span>
                <span className="text-text-muted">-</span>
                <span className="text-text-primary font-medium">{formatTime(match.begin_at)}</span>
              </div>
            )}
            {/* Serie */}
            {match.serie?.full_name && (
              <div className="flex items-center gap-2 bg-bg-secondary/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border-primary">
                <span className="text-text-muted">{t('info_series')}:</span>
                <span className="text-text-primary font-medium line-clamp-1">{match.serie.full_name}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* MAIN CONTENT + AD COLUMN                     */}
      {/* ============================================ */}
      <main className="container mx-auto px-4 pb-12">
        <div className="flex gap-8">
          <div className="flex-1 min-w-0 space-y-10">

            {/* ======================================= */}
            {/* STATS STRIP                             */}
            {/* ======================================= */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Format */}
              {match.number_of_games && (
                <div className="bg-bg-secondary rounded-xl p-4 border border-border-primary text-center">
                  <p className="text-text-muted text-xs uppercase tracking-wider mb-1">{t('stat_format')}</p>
                  <p className="text-2xl font-black text-text-accent">BO{match.number_of_games}</p>
                </div>
              )}
              {/* Games Played */}
              {match.games && match.games.length > 0 && (
                <div className="bg-bg-secondary rounded-xl p-4 border border-border-primary text-center">
                  <p className="text-text-muted text-xs uppercase tracking-wider mb-1">{t('stat_games_played')}</p>
                  <p className="text-2xl font-black text-text-primary">
                    {match.games.filter(g => g.finished).length}
                    <span className="text-text-muted text-sm font-normal"> / {match.number_of_games}</span>
                  </p>
                </div>
              )}
              {/* Winner */}
              {match.winner && (
                <div className="bg-bg-secondary rounded-xl p-4 border border-border-primary text-center">
                  <p className="text-text-muted text-xs uppercase tracking-wider mb-1">{t('stat_winner')}</p>
                  <p className="text-lg font-black text-text-accent truncate">{match.winner.acronym || match.winner.name}</p>
                </div>
              )}
              {/* Total Duration */}
              {match.games && match.games.some(g => g.length) && (
                <div className="bg-bg-secondary rounded-xl p-4 border border-border-primary text-center">
                  <p className="text-text-muted text-xs uppercase tracking-wider mb-1">{t('stat_total_duration')}</p>
                  <p className="text-2xl font-black text-text-primary">
                    {formatDuration(match.games.reduce((acc, g) => acc + (g.length || 0), 0))}
                  </p>
                </div>
              )}
            </section>

            {/* ======================================= */}
            {/* GAME / MAP BREAKDOWN                    */}
            {/* ======================================= */}
            {match.games && match.games.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-text-accent to-text-accent rounded-lg flex items-center justify-center shadow-lg shadow-text-accent/20">
                    <Gamepad2 className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-text-primary">{t('section_game_details')}</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {match.games.map((game) => {
                    const winnerData = parseGameWinner(game.winner);
                    const gameWinnerTeam = winnerData?.id
                      ? match.opponents?.find(o => o.opponent?.id === winnerData.id)?.opponent
                      : null;
                    const isHomeWin = gameWinnerTeam?.id === homeTeam?.id;
                    const isAwayWin = gameWinnerTeam?.id === awayTeam?.id;

                    return (
                      <div key={game.id} className="bg-bg-secondary rounded-xl border border-border-primary overflow-hidden">
                        {/* Game header */}
                        <div className={`px-4 py-2.5 flex items-center justify-between ${
                          game.finished ? 'bg-green-500/5' :
                          game.status === 'running' ? 'bg-[var(--color-status-live)]/5' :
                          'bg-bg-tertiary/20'
                        }`}>
                          <span className="text-sm font-bold text-text-primary">
                            {t('game_label')} {game.position}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            game.finished ? 'bg-green-500/15 text-green-400' :
                            game.status === 'running' ? 'bg-[var(--color-status-live)]/15 text-[var(--color-status-live)]' :
                            'bg-text-muted/15 text-text-muted'
                          }`}>
                            {t(game.finished ? 'game_status_finished' : game.status === 'running' ? 'game_status_running' : 'game_status_upcoming')}
                          </span>
                        </div>

                        {/* Game body: mini matchup */}
                        <div className="p-4 flex items-center justify-between gap-3">
                          {/* Home */}
                          <div className={`flex items-center gap-2 flex-1 min-w-0 ${isHomeWin ? 'opacity-100' : game.finished ? 'opacity-40' : 'opacity-80'}`}>
                            {homeTeam?.image_url && (
                              <img src={homeTeam.image_url} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                            )}
                            <span className={`text-sm font-semibold truncate ${isHomeWin ? 'text-text-accent' : 'text-text-primary'}`}>
                              {homeTeam?.acronym || homeTeam?.name}
                            </span>
                          </div>

                          {/* Winner indicator */}
                          {gameWinnerTeam ? (
                            <Trophy className="w-4 h-4 text-text-accent flex-shrink-0" />
                          ) : (
                            <span className="text-text-muted text-sm flex-shrink-0">-</span>
                          )}

                          {/* Away */}
                          <div className={`flex items-center gap-2 flex-1 justify-end min-w-0 ${isAwayWin ? 'opacity-100' : game.finished ? 'opacity-40' : 'opacity-80'}`}>
                            <span className={`text-sm font-semibold truncate text-right ${isAwayWin ? 'text-text-accent' : 'text-text-primary'}`}>
                              {awayTeam?.acronym || awayTeam?.name}
                            </span>
                            {awayTeam?.image_url && (
                              <img src={awayTeam.image_url} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* Game footer */}
                        <div className="px-4 py-2 border-t border-border-primary/50 flex items-center justify-between text-xs text-text-muted">
                          <span>{game.begin_at ? formatTime(game.begin_at) : '-'}</span>
                          {game.length ? <span>{formatDuration(game.length)}</span> : null}
                          {game.forfeit && (
                            <span className="text-orange-400 font-semibold">{t('game_forfeit')}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ======================================= */}
            {/* STREAMING                               */}
            {/* ======================================= */}
            {sortedStreams.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-text-accent to-text-accent rounded-lg flex items-center justify-center shadow-lg shadow-text-accent/20">
                    <Radio className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-text-primary">{t('section_streaming')}</h2>
                  {match.status === 'running' && (
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-status-live)] font-semibold">
                      <span className="w-2 h-2 bg-[var(--color-status-live)] rounded-full animate-pulse" />
                      {t('stream_live_now')}
                    </span>
                  )}
                </div>

                {/* Embedded player */}
                {(isTwitch || isYoutube) && selectedStream && (
                  <div className="relative w-full bg-black rounded-2xl overflow-hidden border border-border-primary shadow-2xl shadow-black/50 mb-4">
                    <div className="relative" style={{ paddingBottom: '56.25%' }}>
                      {isTwitch ? (
                        <iframe
                          src={`https://player.twitch.tv/?channel=${getTwitchChannel(selectedStream.raw_url)}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}`}
                          height="100%"
                          width="100%"
                          allowFullScreen
                          className="absolute top-0 left-0 w-full h-full"
                          allow="autoplay"
                        />
                      ) : isYoutube ? (
                        <iframe
                          width="100%"
                          height="100%"
                          src={`https://www.youtube.com/embed/${getYoutubeId(selectedStream.raw_url)}`}
                          title="YouTube video player"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          className="absolute top-0 left-0 w-full h-full border-none"
                        />
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Stream selector pills */}
                <div className="flex flex-wrap gap-2">
                  {sortedStreams.map((stream, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedStreamIdx(idx)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-accent ${
                        selectedStreamIdx === idx
                          ? 'bg-text-accent/15 border-text-accent/50 text-text-accent'
                          : 'bg-bg-secondary border-border-primary text-text-secondary hover:border-text-accent/30 hover:text-text-primary'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        stream.official ? 'bg-text-accent' :
                        stream.main ? 'bg-[var(--color-status-live)]' :
                        'bg-text-muted'
                      } ${(stream.official || stream.main) ? 'animate-pulse' : ''}`} />
                      <span>
                        {stream.official ? t('stream_official') + ' ' : ''}
                        {stream.main && !stream.official ? t('stream_main') + ' ' : ''}
                        {stream.language?.toUpperCase() || ''}
                      </span>
                      <span className="text-text-muted text-xs">
                        {stream.raw_url?.includes('twitch') ? 'Twitch' :
                         stream.raw_url?.includes('youtube') ? 'YouTube' :
                         t('stream_fallback')}
                      </span>
                      {selectedStreamIdx === idx && (
                        <Play className="w-3 h-3 text-text-accent fill-text-accent" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Fallback external link */}
                {(!isTwitch && !isYoutube) && selectedStream && (
                  <a
                    href={selectedStream.raw_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 mt-4 bg-gradient-to-r from-text-accent to-text-accent/80 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
                  >
                    <ExternalLink className="w-5 h-5" />
                    {t('stream_link_text')} {selectedStream.raw_url.split('/')[2]}
                  </a>
                )}
              </section>
            )}

            {/* ======================================= */}
            {/* TEAM ROSTERS                            */}
            {/* ======================================= */}
            {match.opponents && match.opponents.length === 2 && teamsData.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-text-accent to-text-accent rounded-lg flex items-center justify-center shadow-lg shadow-text-accent/20">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-text-primary">{t('section_teams_rosters')}</h2>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {teamsData.map((teamDetail: any) => {
                    const players: PandaPlayer[] = teamDetail.players || [];

                    return (
                      <div key={teamDetail.id} className="bg-bg-secondary rounded-2xl border border-border-primary overflow-hidden">
                        {/* Team header */}
                        <div className="p-4 border-b border-border-primary/50 bg-bg-tertiary/15 flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl bg-bg-primary border border-border-primary flex items-center justify-center overflow-hidden flex-shrink-0">
                            {teamDetail.image_url ? (
                              <img src={teamDetail.image_url} alt={teamDetail.name} className="w-full h-full object-contain p-1.5" loading="lazy" />
                            ) : (
                              <Trophy className="w-7 h-7 text-text-muted" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-text-primary truncate">{teamDetail.name}</h3>
                            <div className="flex items-center gap-2 text-xs text-text-secondary flex-wrap">
                              {teamDetail.acronym && (
                                <span className="text-text-accent font-semibold">{teamDetail.acronym}</span>
                              )}
                              {teamDetail.location && (
                                <>
                                  <span className="text-text-muted">-</span>
                                  <span>{teamDetail.location}</span>
                                </>
                              )}
                              <span className="text-text-muted">-</span>
                              <span>{players.length} {players.length > 1 ? t('player_plural') : t('player_singular')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Players */}
                        <div className="p-4">
                          {players.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {players.map((player) => (
                                <div
                                  key={player.id}
                                  className={`group/p relative rounded-xl overflow-hidden border transition-colors ${
                                    player.active !== false
                                      ? 'border-border-primary hover:border-text-accent/30'
                                      : 'border-border-primary/50 opacity-60'
                                  }`}
                                >
                                  {/* Avatar */}
                                  <div className="aspect-square bg-bg-primary flex items-center justify-center overflow-hidden relative">
                                    {player.image_url ? (
                                      <img
                                        src={player.image_url}
                                        alt={player.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="text-2xl font-bold text-text-muted">
                                        {player.name.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    {/* Hover overlay */}
                                    {player.role && (
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover/p:opacity-100 transition-opacity flex items-end justify-center pb-3">
                                        <span className="text-xs font-bold text-text-accent">{player.role}</span>
                                      </div>
                                    )}
                                  </div>
                                  {/* Info */}
                                  <div className="p-2 text-center bg-bg-secondary">
                                    <p className="text-xs font-bold text-text-primary truncate">{player.name}</p>
                                    {player.nationality && (
                                      <p className="text-xs text-text-muted truncate">{player.nationality}</p>
                                    )}
                                    {player.role && (
                                      <span className="inline-block mt-1 text-xs text-text-accent bg-text-accent/10 px-2 py-0.5 rounded-full">
                                        {player.role}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-6">
                              <Trophy className="w-8 h-8 text-text-muted mx-auto mb-2" />
                              <p className="text-text-secondary text-sm">{t('empty_no_players')}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ======================================= */}
            {/* MATCH INFO FOOTER                       */}
            {/* ======================================= */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-text-accent to-text-accent rounded-lg flex items-center justify-center shadow-lg shadow-text-accent/20">
                  <Info className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary">{t('section_match_info')}</h2>
              </div>

              <div className="bg-bg-secondary rounded-2xl border border-border-primary divide-y divide-border-primary/50 overflow-hidden">
                <InfoRow label={t('info_match_id')} value={String(match.id)} />
                {(match as any).match2id && (
                  <InfoRow label={t('info_match2id')} value={(match as any).match2id} />
                )}
                {match.slug && (
                  <InfoRow label={t('info_slug')} value={match.slug} />
                )}
                {match.match_type && (
                  <InfoRow label={t('info_match_type')} value={match.match_type} />
                )}
                {match.scheduled_at && (
                  <InfoRow label={t('info_scheduled_at')} value={`${formatDate(match.scheduled_at)} ${formatTime(match.scheduled_at)}`} />
                )}
                {match.end_at && (
                  <InfoRow label={t('info_end_at')} value={`${formatDate(match.end_at)} ${formatTime(match.end_at)}`} />
                )}
                {(match as any).wiki && (
                  <InfoRow label={t('info_wiki')} value={(match as any).wiki} />
                )}
                {match.live?.supported !== undefined && (
                  <InfoRow label={t('info_live_supported')} value={match.live.supported ? t('yes') : t('no')} />
                )}
                {match.live?.opens_at && (
                  <InfoRow label={t('info_live_opens_at')} value={match.live.opens_at} />
                )}
              </div>
            </section>

          </div>

          {/* Ad Column */}
          <AdColumn
            ads={memoizedAds}
            isSubscribed={isSubscribed}
            isLoading={isLoadingAds}
          />
        </div>
      </main>
    </div>
  );
}
