'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Gamepad2,
  Trophy,
  Users,
  AlertCircle,
  Play,
  Calendar,
  Info,
  ExternalLink,
  Tv,
  ChevronRight,
  Swords,
  Shield,
  MapPin,
  DollarSign,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { LiveMatch, Advertisement, PandaPlayer } from '../../types';
import { matchService } from '../../services/matchService';
import { teamService } from '../../services/teamService';
import { advertisementService } from '../../services/advertisementService';
import AdColumn from '../../components/ads/AdColumn';
import { SportsEventSchema, BreadcrumbSchema } from '../../components/seo/StructuredData';
import { generateBreadcrumbs } from '../../lib/breadcrumbHelper';
import { proxyImageUrl } from '../../lib/imageProxy';
import { useIsDarkTheme, pickThemeLogo } from '../../hooks/useIsDarkTheme';

interface MatchDetailPageClientProps {
  matchId: string;
  wiki?: string;
  initialMatch?: LiveMatch | null;
}

// --- Helpers ---

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

const getRoleBadgeStyle = (role?: string | null): string => {
  if (!role) return '';
  const r = role.toLowerCase();
  if (r.includes('captain') || r.includes('igl')) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25';
  if (r.includes('coach')) return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
  if (r.includes('mid')) return 'text-blue-400 bg-blue-500/10 border-blue-500/25';
  if (r.includes('adc') || r.includes('bot')) return 'text-green-400 bg-green-500/10 border-green-500/25';
  if (r.includes('support') || r.includes('sup')) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25';
  if (r.includes('top')) return 'text-red-400 bg-red-500/10 border-red-500/25';
  if (r.includes('jungl') || r.includes('jgl')) return 'text-purple-400 bg-purple-500/10 border-purple-500/25';
  if (r.includes('awp') || r.includes('sniper')) return 'text-orange-400 bg-orange-500/10 border-orange-500/25';
  return 'text-text-secondary bg-[var(--color-bg-tertiary)]/30 border-[var(--color-border-primary)]/40';
};

export default function MatchDetailPageClient({ matchId, wiki, initialMatch }: MatchDetailPageClientProps) {
  const t = useTranslations('pages_detail.match_detail');
  const isDark = useIsDarkTheme();
  const [match, setMatch] = useState<LiveMatch | null>(initialMatch || null);
  const [loading, setLoading] = useState(!initialMatch);
  const [error, setError] = useState<string | null>(null);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);
  const [selectedStreamIdx, setSelectedStreamIdx] = useState(0);
  const [teamsData, setTeamsData] = useState<any[]>([]);

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

  useEffect(() => {
    const loadTeams = async (data: LiveMatch) => {
      if (data.opponents && data.opponents.length === 2) {
        const matchWiki = data.wiki || wiki;
        const opponents = data.opponents.filter(o => o.opponent);
        if (opponents.length === 0) return;

        try {
          const teamPromises = opponents.map(async (o) => {
            const template = o.opponent?.template;
            if (template && matchWiki) {
              try {
                return await teamService.getTeamByTemplate(template, matchWiki);
              } catch {
                // Fallback to ID-based if template fails
              }
            }
            try {
              return await teamService.getTeamById(o.opponent!.id);
            } catch {
              return null;
            }
          });

          const teams = (await Promise.all(teamPromises)).filter(Boolean);
          setTeamsData(teams);
        } catch (teamError) {
          console.error('Error loading team details:', teamError);
        }
      }
    };
    if (match) loadTeams(match);
  }, [match]);

  useEffect(() => {
    if (initialMatch) return;

    const loadMatch = async () => {
      try {
        setLoading(true);
        const data = await matchService.getMatchById(matchId, wiki);
        setMatch(data);
      } catch (err) {
        console.error('Error loading match:', err);
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement du match');
      } finally {
        setLoading(false);
      }
    };
    if (matchId) loadMatch();
  }, [matchId, initialMatch]);

  const memoizedAds = useMemo(() => ads, [ads]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-14 h-14 mx-auto mb-5">
            <div className="absolute inset-0 border border-border-primary rounded-xl" />
            <div className="absolute inset-0 border border-transparent border-t-accent rounded-xl animate-spin" />
            <Swords className="absolute inset-0 m-auto w-5 h-5 text-accent/50" />
          </div>
          <p className="text-text-muted text-xs uppercase tracking-[0.2em] font-semibold">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // --- Error ---
  if (error || !match) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-bg-secondary border border-border-primary rounded-xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-red-400 font-bold text-base mb-1.5">{t('error_title')}</p>
          <p className="text-text-muted text-xs">{error || t('not_found')}</p>
        </div>
      </div>
    );
  }

  // --- Data ---
  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;
  const homeScore = match.results?.find(r => r.team_id === homeTeam?.id)?.score;
  const awayScore = match.results?.find(r => r.team_id === awayTeam?.id)?.score;
  const isHomeWinner = homeScore !== undefined && awayScore !== undefined && homeScore > awayScore;
  const isAwayWinner = homeScore !== undefined && awayScore !== undefined && awayScore > homeScore;
  const isLive = match.status === 'running';
  const isFinished = match.status === 'finished';

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
  const matchUrl = `${siteUrl}/match/${matchId}`;

  const breadcrumbs = generateBreadcrumbs([
    { name: t('breadcrumb_home'), url: '/' },
    { name: t('breadcrumb_matchs'), url: '/match' },
    { name: `${homeTeam?.name || 'Match'} vs ${awayTeam?.name || 'Match'}`, url: matchUrl },
  ]);

  const statusKey = isLive ? 'status_running' : isFinished ? 'status_finished' : 'status_upcoming';

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

  const getTeamUrl = (team: typeof homeTeam) => {
    if (!team) return null;
    const p = new URLSearchParams();
    if (match.wiki) p.set('wiki', match.wiki);
    if (team.name) p.set('name', team.name);
    if (team.acronym) p.set('acronym', team.acronym);
    if (team.image_url) p.set('logo', team.image_url);
    const slug = team.template || team.slug || String(team.id);
    return `/equipe/${encodeURIComponent(slug)}?${p.toString()}`;
  };

  const getTwitchChannel = (url: string) => {
    const m = url.match(/twitch\.tv\/([^/?]+)/);
    return m ? m[1] : '';
  };
  const getYoutubeId = (url: string) => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([^&/?]+)/);
    return m ? m[1] : '';
  };

  // Team logo component
  const TeamLogo = ({ team, size = 'lg', highlight = false }: { team: typeof homeTeam; size?: 'sm' | 'md' | 'lg'; highlight?: boolean }) => {
    const sizeClasses = {
      sm: 'w-7 h-7',
      md: 'w-12 h-12',
      lg: 'w-18 h-18 md:w-24 md:h-24',
    };
    return (
      <div className={`relative ${sizeClasses[size]} flex-shrink-0 group/logo`}>
        {highlight && <div className="absolute -inset-2 bg-[var(--color-accent)]/10 rounded-2xl blur-xl" />}
        <div className={`relative ${sizeClasses[size]} rounded-xl bg-[var(--color-bg-primary)]/80 border ${
          highlight ? 'border-[var(--color-accent)]/30' : 'border-[var(--color-border-primary)]/40'
        } flex items-center justify-center overflow-hidden transition-all duration-300 group-hover/logo:border-[var(--color-accent)]/20`}>
          {pickThemeLogo(isDark, team?.image_url, team?.dark_image_url) ? (
            <img src={proxyImageUrl(pickThemeLogo(isDark, team?.image_url, team?.dark_image_url)!)} alt={team?.name || ''} className="w-3/4 h-3/4 object-contain" loading="lazy" />
          ) : (
            <Shield className="w-1/3 h-1/3 text-text-muted/60" />
          )}
        </div>
      </div>
    );
  };

  // Section header component
  const SectionHeader = ({ icon: Icon, title, extra }: { icon: any; title: string; extra?: React.ReactNode }) => (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-1 h-5 rounded-full bg-accent" />
      <Icon className="w-[18px] h-[18px] text-accent" />
      <h2 className="text-xs font-bold text-text-primary uppercase tracking-[0.15em]">{title}</h2>
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-primary">
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
      <h1 className="sr-only">
        {homeTeam?.name || 'Match'} vs {awayTeam?.name || 'Match'} - {match.videogame?.name} - {match.tournament?.name}
      </h1>

      {/* ================================================================ */}
      {/* HERO — SCOREBOARD                                                */}
      {/* ================================================================ */}
      <section className="relative w-full overflow-hidden pt-22 pb-8 md:pt-26 md:pb-10">
        {/* Background: arena split effect */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[var(--color-bg-secondary)]" />
          {/* Diagonal stripe pattern */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 40px, currentColor 40px, currentColor 41px)',
            }}
          />
          {/* Left team subtle tint */}
          <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[var(--color-accent)]/[0.02] to-transparent" />
          {/* Right team subtle tint */}
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[var(--color-bg-tertiary)]/[0.06] to-transparent" />
          {/* Center divider glow */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-[var(--color-accent)]/15 to-transparent hidden md:block" />
          {/* Top accent line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/25 to-transparent" />
        </div>

        <div className="relative container mx-auto px-4">
          {/* Context pills */}
          <div className="flex items-center justify-center gap-2 mb-7 flex-wrap">
            {/* Status */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.15em] border ${
              isLive
                ? 'bg-[var(--color-status-live)]/10 text-[var(--color-status-live)] border-[var(--color-status-live)]/25'
                : isFinished
                  ? 'bg-[var(--color-status-finished)]/10 text-[var(--color-status-finished)] border-[var(--color-status-finished)]/25'
                  : 'bg-[var(--color-status-upcoming)]/10 text-[var(--color-status-upcoming)] border-[var(--color-status-upcoming)]/25'
            }`}>
              {isLive && <span className="w-1.5 h-1.5 bg-[var(--color-status-live)] rounded-full animate-pulse" />}
              {t(statusKey)}
            </div>

            {/* Game */}
            {match.videogame?.name && (
              <span className="text-[10px] text-text-secondary font-semibold bg-[var(--color-bg-primary)]/60 px-2.5 py-1 rounded-md border border-[var(--color-border-primary)]/30">
                {match.videogame.name}
              </span>
            )}

            {/* Tier */}
            {match.tournament?.tier && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                match.tournament.tier.toLowerCase() === 's' ? 'bg-[var(--color-tier-s)]/10 text-[var(--color-tier-s)] border-[var(--color-tier-s)]/25' :
                match.tournament.tier.toLowerCase() === 'a' ? 'bg-[var(--color-tier-a)]/10 text-[var(--color-tier-a)] border-[var(--color-tier-a)]/25' :
                match.tournament.tier.toLowerCase() === 'b' ? 'bg-[var(--color-tier-b)]/10 text-[var(--color-tier-b)] border-[var(--color-tier-b)]/25' :
                'bg-[var(--color-status-finished)]/10 text-text-muted border-[var(--color-status-finished)]/25'
              }`}>
                {t('tier_label')} {match.tournament.tier.toUpperCase()}
              </span>
            )}

            {/* BO */}
            {match.number_of_games && (
              <span className="text-[10px] text-text-muted font-bold bg-[var(--color-bg-primary)]/40 px-2.5 py-1 rounded-md border border-[var(--color-border-primary)]/20">
                {t('bo_prefix')}{match.number_of_games}
              </span>
            )}

            {/* Section */}
            {match.section && (
              <span className="text-[10px] text-text-secondary font-medium bg-[var(--color-bg-primary)]/40 px-2.5 py-1 rounded-md border border-[var(--color-border-primary)]/20">
                {match.section}
              </span>
            )}

            {/* Rescheduled */}
            {match.rescheduled && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-status-upcoming)] bg-[var(--color-status-upcoming)]/8 px-2.5 py-1 rounded-md border border-[var(--color-status-upcoming)]/20">
                <RefreshCw className="w-2.5 h-2.5" />
                {t('rescheduled')}
              </span>
            )}
          </div>

          {/* === MAIN SCOREBOARD === */}
          <div className="flex items-center justify-center gap-4 md:gap-0 mb-6">

            {/* HOME TEAM */}
            {getTeamUrl(homeTeam) ? (
              <Link href={getTeamUrl(homeTeam)!} className="flex-1 flex flex-col md:flex-row items-center md:justify-end gap-3 md:gap-5 group/home">
                <div className="text-center md:text-right order-2 md:order-1 min-w-0">
                  <p className={`text-lg md:text-2xl lg:text-3xl font-black leading-tight truncate transition-colors group-hover/home:text-accent ${
                    isHomeWinner ? 'text-text-primary' : isFinished ? 'text-text-muted/50' : 'text-text-primary'
                  }`}>
                    {homeTeam?.name || '-'}
                  </p>
                  {homeTeam?.acronym && homeTeam.acronym.toUpperCase() !== homeTeam.name.toUpperCase() && (
                    <p className="text-[10px] text-accent/70 font-bold tracking-[0.2em] uppercase mt-0.5">{homeTeam.acronym}</p>
                  )}
                </div>
                <TeamLogo team={homeTeam} highlight={isHomeWinner} />
              </Link>
            ) : (
              <div className="flex-1 flex flex-col md:flex-row items-center md:justify-end gap-3 md:gap-5">
                <div className="text-center md:text-right order-2 md:order-1 min-w-0">
                  <p className={`text-lg md:text-2xl lg:text-3xl font-black leading-tight truncate transition-colors ${
                    isHomeWinner ? 'text-text-primary' : isFinished ? 'text-text-muted/50' : 'text-text-primary'
                  }`}>
                    {homeTeam?.name || '-'}
                  </p>
                  {homeTeam?.acronym && homeTeam.acronym.toUpperCase() !== homeTeam.name.toUpperCase() && (
                    <p className="text-[10px] text-accent/70 font-bold tracking-[0.2em] uppercase mt-0.5">{homeTeam.acronym}</p>
                  )}
                </div>
                <TeamLogo team={homeTeam} highlight={isHomeWinner} />
              </div>
            )}

            {/* SCORE CENTER */}
            <div className="flex flex-col items-center px-5 md:px-12 flex-shrink-0">
              {isFinished && homeScore !== undefined && awayScore !== undefined ? (
                <div className="flex items-baseline gap-3 md:gap-5">
                  <span className={`text-5xl md:text-7xl lg:text-8xl font-black tabular-nums tracking-tight ${isHomeWinner ? 'text-accent' : 'text-text-primary/30'}`}>
                    {homeScore}
                  </span>
                  <span className="text-xl md:text-2xl font-thin text-text-muted/30 select-none">:</span>
                  <span className={`text-5xl md:text-7xl lg:text-8xl font-black tabular-nums tracking-tight ${isAwayWinner ? 'text-accent' : 'text-text-primary/30'}`}>
                    {awayScore}
                  </span>
                </div>
              ) : isLive ? (
                <div className="flex flex-col items-center">
                  <div className="flex items-baseline gap-3 md:gap-5">
                    <span className="text-5xl md:text-7xl lg:text-8xl font-black tabular-nums tracking-tight text-accent">
                      {homeScore ?? 0}
                    </span>
                    <span className="text-xl md:text-2xl font-thin text-accent/30 select-none">:</span>
                    <span className="text-5xl md:text-7xl lg:text-8xl font-black tabular-nums tracking-tight text-accent">
                      {awayScore ?? 0}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-3xl md:text-4xl lg:text-5xl font-black text-text-muted/20 tracking-[-0.05em] select-none">VS</span>
                </div>
              )}

              {/* Winner label */}
              {isFinished && match.winner && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Trophy className="w-3 h-3 text-accent" />
                  <span className="text-[10px] font-bold text-accent uppercase tracking-[0.15em]">
                    {match.winner.name || match.winner.acronym} {t('wins')}
                  </span>
                </div>
              )}

              {/* Series progress dots */}
              {match.games && match.games.length > 1 && (
                <div className="flex items-center gap-1.5 mt-3">
                  {match.games.map((game, idx) => {
                    const w = parseGameWinner(game.winner);
                    const isGHomeWin = w?.id === homeTeam?.id;
                    const isGAwayWin = w?.id === awayTeam?.id;
                    const isGameLive = game.status === 'running';
                    return (
                      <div
                        key={idx}
                        title={`Game ${game.position}`}
                        className={`w-2 h-2 rounded-full transition-all ${
                          isGameLive
                            ? 'bg-[var(--color-status-live)] animate-pulse scale-125'
                            : isGHomeWin
                              ? 'bg-accent'
                              : isGAwayWin
                                ? 'bg-[var(--color-bg-tertiary)]'
                                : 'border border-[var(--color-border-primary)]/50'
                        }`}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* AWAY TEAM */}
            {getTeamUrl(awayTeam) ? (
              <Link href={getTeamUrl(awayTeam)!} className="flex-1 flex flex-col md:flex-row items-center md:justify-start gap-3 md:gap-5 group/away">
                <TeamLogo team={awayTeam} highlight={isAwayWinner} />
                <div className="text-center md:text-left min-w-0">
                  <p className={`text-lg md:text-2xl lg:text-3xl font-black leading-tight truncate transition-colors group-hover/away:text-accent ${
                    isAwayWinner ? 'text-text-primary' : isFinished ? 'text-text-muted/50' : 'text-text-primary'
                  }`}>
                    {awayTeam?.name || '-'}
                  </p>
                  {awayTeam?.acronym && awayTeam.acronym.toUpperCase() !== awayTeam.name.toUpperCase() && (
                    <p className="text-[10px] text-accent/70 font-bold tracking-[0.2em] uppercase mt-0.5">{awayTeam.acronym}</p>
                  )}
                </div>
              </Link>
            ) : (
              <div className="flex-1 flex flex-col md:flex-row items-center md:justify-start gap-3 md:gap-5">
                <TeamLogo team={awayTeam} highlight={isAwayWinner} />
                <div className="text-center md:text-left min-w-0">
                  <p className={`text-lg md:text-2xl lg:text-3xl font-black leading-tight truncate transition-colors ${
                    isAwayWinner ? 'text-text-primary' : isFinished ? 'text-text-muted/50' : 'text-text-primary'
                  }`}>
                    {awayTeam?.name || '-'}
                  </p>
                  {awayTeam?.acronym && awayTeam.acronym.toUpperCase() !== awayTeam.name.toUpperCase() && (
                    <p className="text-[10px] text-accent/70 font-bold tracking-[0.2em] uppercase mt-0.5">{awayTeam.acronym}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Context info bar */}
          <div className="flex items-center justify-center gap-3 flex-wrap text-[11px] text-text-muted">
            {match.tournament?.name && (
              <div className="flex items-center gap-1.5">
                {pickThemeLogo(isDark, (match.tournament as any)?.icon_url, (match.tournament as any)?.icon_dark_url) && (
                  <img src={proxyImageUrl(pickThemeLogo(isDark, (match.tournament as any)?.icon_url, (match.tournament as any)?.icon_dark_url)!)} alt="" className="w-3.5 h-3.5 object-contain opacity-60" />
                )}
                <span className="text-text-secondary font-medium">{match.tournament.name}</span>
              </div>
            )}
            {match.league && match.league.name !== match.tournament?.name && (
              <>
                <ChevronRight className="w-3 h-3 text-border-primary/60" />
                <div className="flex items-center gap-1.5">
                  {match.league.image_url && (
                    <img src={proxyImageUrl(match.league.image_url)} alt="" className="w-3.5 h-3.5 object-contain opacity-60 rounded-sm" />
                  )}
                  <span>{match.league.name}</span>
                </div>
              </>
            )}
            {match.tournament?.region && (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-text-muted/40" />
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-accent/50" />
                  <span>{match.tournament.region}</span>
                </div>
              </>
            )}
            {match.tournament?.prizepool && (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-text-muted/40" />
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-accent/50" />
                  <span className="text-text-secondary font-medium">{match.tournament.prizepool}</span>
                </div>
              </>
            )}
            {match.begin_at && (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-text-muted/40" />
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-accent/50" />
                  <span>{formatDate(match.begin_at)}</span>
                  <span className="text-text-muted/40">/</span>
                  <span>{formatTime(match.begin_at)}</span>
                </div>
              </>
            )}
            {match.rescheduled && match.original_scheduled_at && (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-text-muted/40" />
                <div className="flex items-center gap-1 text-[var(--color-status-upcoming)]">
                  <RefreshCw className="w-3 h-3" />
                  <span className="line-through opacity-50">{formatDate(match.original_scheduled_at)} {formatTime(match.original_scheduled_at)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--color-border-primary)]/40 to-transparent" />
      </section>

      {/* ================================================================ */}
      {/* MAIN CONTENT + AD COLUMN                                         */}
      {/* ================================================================ */}
      <main className="container mx-auto px-4 pb-16">
        <div className="flex gap-8">
          <div className="flex-1 min-w-0 space-y-10">

            {/* ============================================================ */}
            {/* GAME-BY-GAME RESULTS                                         */}
            {/* ============================================================ */}
            {match.games && match.games.length > 0 && (
              <section>
                <SectionHeader
                  icon={Gamepad2}
                  title={t('section_game_details')}
                  extra={match.number_of_games ? (
                    <span className="text-[10px] text-text-muted font-mono tracking-wide">
                      {match.games.filter(g => g.finished).length}/{match.number_of_games} {t('stat_games_played')}
                    </span>
                  ) : undefined}
                />

                <div className="rounded-xl border border-[var(--color-border-primary)]/30 overflow-hidden bg-[var(--color-bg-secondary)]/40">
                  {match.games.map((game, idx) => {
                    const winnerData = parseGameWinner(game.winner);
                    const gameWinnerTeam = winnerData?.id
                      ? match.opponents?.find(o => o.opponent?.id === winnerData.id)?.opponent
                      : null;
                    const isHomeWin = gameWinnerTeam?.id === homeTeam?.id;
                    const isAwayWin = gameWinnerTeam?.id === awayTeam?.id;
                    const isGameLive = game.status === 'running';
                    const isGameFinished = game.finished;
                    const isLast = idx === match.games!.length - 1;

                    return (
                      <div
                        key={game.id}
                        className={`flex items-center gap-3 px-4 md:px-5 py-3 transition-colors hover:bg-[var(--color-bg-hover)] ${
                          !isLast ? 'border-b border-[var(--color-border-primary)]/15' : ''
                        } ${isGameLive ? 'border-l-2 border-l-[var(--color-status-live)] bg-[var(--color-status-live)]/[0.03]' : 'border-l-2 border-l-transparent'}`}
                      >
                        {/* Game badge */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                          isGameLive
                            ? 'bg-[var(--color-status-live)]/12 text-[var(--color-status-live)] ring-1 ring-[var(--color-status-live)]/25'
                            : isGameFinished
                              ? 'bg-[var(--color-bg-primary)]/60 text-text-primary/70 ring-1 ring-[var(--color-border-primary)]/30'
                              : 'bg-[var(--color-bg-primary)]/30 text-text-muted/50 ring-1 ring-[var(--color-border-primary)]/15'
                        }`}>
                          {game.position}
                        </div>

                        {/* Home side */}
                        {getTeamUrl(homeTeam) ? (
                          <Link href={getTeamUrl(homeTeam)!} className={`flex items-center gap-2 flex-1 min-w-0 transition-opacity group/gh ${isGameFinished && !isHomeWin ? 'opacity-30' : ''}`}>
                            {pickThemeLogo(isDark, homeTeam?.image_url, homeTeam?.dark_image_url) && (
                              <img src={proxyImageUrl(pickThemeLogo(isDark, homeTeam?.image_url, homeTeam?.dark_image_url)!)} alt="" className="w-4.5 h-4.5 object-contain flex-shrink-0" loading="lazy" />
                            )}
                            <span className={`text-sm font-semibold truncate group-hover/gh:text-accent transition-colors ${isHomeWin ? 'text-accent' : 'text-text-primary'}`}>
                              {homeTeam?.acronym || homeTeam?.name || '-'}
                            </span>
                          </Link>
                        ) : (
                          <div className={`flex items-center gap-2 flex-1 min-w-0 transition-opacity ${isGameFinished && !isHomeWin ? 'opacity-30' : ''}`}>
                            {pickThemeLogo(isDark, homeTeam?.image_url, homeTeam?.dark_image_url) && (
                              <img src={proxyImageUrl(pickThemeLogo(isDark, homeTeam?.image_url, homeTeam?.dark_image_url)!)} alt="" className="w-4.5 h-4.5 object-contain flex-shrink-0" loading="lazy" />
                            )}
                            <span className={`text-sm font-semibold truncate ${isHomeWin ? 'text-accent' : 'text-text-primary'}`}>
                              {homeTeam?.acronym || homeTeam?.name || '-'}
                            </span>
                          </div>
                        )}

                        {/* Center indicator */}
                        <div className="flex-shrink-0 w-8 flex items-center justify-center">
                          {isGameLive ? (
                            <span className="w-2 h-2 bg-[var(--color-status-live)] rounded-full animate-pulse" />
                          ) : gameWinnerTeam ? (
                            <Trophy className="w-3.5 h-3.5 text-accent" />
                          ) : (
                            <span className="w-3 h-px bg-[var(--color-border-primary)]/40" />
                          )}
                        </div>

                        {/* Away side */}
                        {getTeamUrl(awayTeam) ? (
                          <Link href={getTeamUrl(awayTeam)!} className={`flex items-center gap-2 flex-1 min-w-0 justify-end transition-opacity group/ga ${isGameFinished && !isAwayWin ? 'opacity-30' : ''}`}>
                            <span className={`text-sm font-semibold truncate text-right group-hover/ga:text-accent transition-colors ${isAwayWin ? 'text-accent' : 'text-text-primary'}`}>
                              {awayTeam?.acronym || awayTeam?.name || '-'}
                            </span>
                            {pickThemeLogo(isDark, awayTeam?.image_url, awayTeam?.dark_image_url) && (
                              <img src={proxyImageUrl(pickThemeLogo(isDark, awayTeam?.image_url, awayTeam?.dark_image_url)!)} alt="" className="w-4.5 h-4.5 object-contain flex-shrink-0" loading="lazy" />
                            )}
                          </Link>
                        ) : (
                          <div className={`flex items-center gap-2 flex-1 min-w-0 justify-end transition-opacity ${isGameFinished && !isAwayWin ? 'opacity-30' : ''}`}>
                            <span className={`text-sm font-semibold truncate text-right ${isAwayWin ? 'text-accent' : 'text-text-primary'}`}>
                              {awayTeam?.acronym || awayTeam?.name || '-'}
                            </span>
                            {pickThemeLogo(isDark, awayTeam?.image_url, awayTeam?.dark_image_url) && (
                              <img src={proxyImageUrl(pickThemeLogo(isDark, awayTeam?.image_url, awayTeam?.dark_image_url)!)} alt="" className="w-4.5 h-4.5 object-contain flex-shrink-0" loading="lazy" />
                            )}
                          </div>
                        )}

                        {/* Duration / Status */}
                        <div className="flex-shrink-0 w-14 text-right">
                          {isGameLive ? (
                            <span className="text-[10px] font-bold text-[var(--color-status-live)] uppercase tracking-wider">{t('game_status_running')}</span>
                          ) : game.length ? (
                            <span className="text-[10px] text-text-muted font-mono">{formatDuration(game.length)}</span>
                          ) : isGameFinished ? (
                            <span className="text-[10px] text-text-muted">{t('game_status_finished')}</span>
                          ) : (
                            <span className="text-[10px] text-text-muted/30">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ============================================================ */}
            {/* STREAMING                                                    */}
            {/* ============================================================ */}
            {sortedStreams.length > 0 && (
              <section>
                <SectionHeader
                  icon={Tv}
                  title={t('section_streaming')}
                  extra={isLive ? (
                    <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-status-live)] font-bold uppercase tracking-[0.15em]">
                      <span className="w-1.5 h-1.5 bg-[var(--color-status-live)] rounded-full animate-pulse" />
                      {t('stream_live_now')}
                    </span>
                  ) : undefined}
                />

                {/* Embedded player */}
                {(isTwitch || isYoutube) && selectedStream && (
                  <div className="relative w-full rounded-xl overflow-hidden border border-[var(--color-border-primary)]/30 mb-4 group transition-all duration-300 hover:border-[var(--color-accent)]/15">
                    <div className="relative bg-black rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                      {isTwitch ? (
                        <iframe
                          src={`https://player.twitch.tv/?channel=${getTwitchChannel(selectedStream.raw_url)}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}`}
                          height="100%" width="100%" allowFullScreen
                          className="absolute inset-0 w-full h-full"
                          allow="autoplay"
                        />
                      ) : isYoutube ? (
                        <iframe
                          width="100%" height="100%"
                          src={`https://www.youtube.com/embed/${getYoutubeId(selectedStream.raw_url)}`}
                          title="YouTube video player"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full border-none"
                        />
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Stream selector */}
                <div className="flex flex-wrap gap-2">
                  {sortedStreams.map((stream, idx) => {
                    const platform = stream.raw_url?.includes('twitch') ? 'Twitch' :
                                     stream.raw_url?.includes('youtube') ? 'YouTube' :
                                     t('stream_fallback');
                    const isSelected = selectedStreamIdx === idx;

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedStreamIdx(idx)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all duration-200 border cursor-pointer ${
                          isSelected
                            ? 'bg-accent/10 border-accent/30 text-accent'
                            : 'bg-[var(--color-bg-secondary)]/50 border-[var(--color-border-primary)]/25 text-text-secondary hover:border-accent/15 hover:text-text-primary'
                        }`}
                      >
                        {isSelected && <Play className="w-3 h-3 fill-current" />}
                        <span>{stream.official ? t('stream_official') : stream.main ? t('stream_main') : ''} {platform}</span>
                        {stream.language && (
                          <span className="text-[9px] text-text-muted uppercase tracking-wider opacity-60 ml-0.5">{stream.language}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {(!isTwitch && !isYoutube) && selectedStream && (
                  <a
                    href={selectedStream.raw_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 mt-4 bg-accent text-white rounded-lg text-xs font-bold hover:bg-[var(--color-accent-hover)] transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('stream_link_text')} {selectedStream.raw_url.split('/')[2]}
                  </a>
                )}
              </section>
            )}

            {/* ============================================================ */}
            {/* TEAM ROSTERS                                                 */}
            {/* ============================================================ */}
            {match.opponents && match.opponents.length === 2 && teamsData.length > 0 && (
              <section>
                <SectionHeader icon={Users} title={t('section_teams_rosters')} />

                <div className="grid gap-5 lg:grid-cols-2">
                  {teamsData.map((teamDetail: any) => {
                    const allPlayers: PandaPlayer[] = teamDetail.players || [];
                    const activePlayers = allPlayers.filter(p => !p.role?.toLowerCase().includes('coach'));
                    const coaches = allPlayers.filter(p => p.role?.toLowerCase().includes('coach'));
                    const isWinnerTeam = match.winner_id === teamDetail.id;

                    return (
                      <div key={teamDetail.id} className={`rounded-xl border overflow-hidden transition-colors ${
                        isWinnerTeam
                          ? 'border-[var(--color-accent)]/25 bg-[var(--color-bg-secondary)]/50'
                          : 'border-[var(--color-border-primary)]/25 bg-[var(--color-bg-secondary)]/40'
                      }`}>
                        {/* Team header */}
                        <Link href={(() => { const p = new URLSearchParams(); if (teamDetail.wiki || match.wiki) p.set('wiki', teamDetail.wiki || match.wiki || ''); if (teamDetail.name) p.set('name', teamDetail.name); if (teamDetail.acronym) p.set('acronym', teamDetail.acronym); if (teamDetail.image_url) p.set('logo', teamDetail.image_url); const slug = teamDetail.template || teamDetail.slug || String(teamDetail.id); return `/equipe/${encodeURIComponent(slug)}?${p.toString()}`; })()} className="block px-4 py-3 flex items-center gap-3 border-b border-[var(--color-border-primary)]/15 hover:bg-[var(--color-bg-primary)]/20 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-[var(--color-bg-primary)]/80 border border-[var(--color-border-primary)]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {pickThemeLogo(isDark, teamDetail.image_url, teamDetail.dark_mode_image_url) ? (
                              <img src={proxyImageUrl(pickThemeLogo(isDark, teamDetail.image_url, teamDetail.dark_mode_image_url)!)} alt={teamDetail.name} className="w-6 h-6 object-contain" loading="lazy" />
                            ) : (
                              <Shield className="w-4 h-4 text-text-muted/50" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold text-text-primary truncate hover:text-[var(--color-accent)] transition-colors">{teamDetail.name}</h3>
                              {isWinnerTeam && <Trophy className="w-3 h-3 text-accent flex-shrink-0" />}
                              <ExternalLink className="w-3 h-3 text-text-muted/50 flex-shrink-0" />
                            </div>
                            <p className="text-[10px] text-text-muted">
                              {allPlayers.length} {allPlayers.length > 1 ? t('player_plural') : t('player_singular')}
                            </p>
                          </div>
                        </Link>

                        {/* Players */}
                        <div className="p-2.5">
                          {activePlayers.length > 0 ? (
                            <div className="space-y-0.5">
                              {activePlayers.map((player) => (
                                <div
                                  key={player.id}
                                  className="group/player flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
                                >
                                  {/* Circular avatar */}
                                  <div className="w-8 h-8 rounded-full bg-[var(--color-bg-primary)]/80 ring-1 ring-[var(--color-border-primary)]/30 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover/player:ring-accent/20 transition-all">
                                    {player.image_url ? (
                                      <img src={proxyImageUrl(player.image_url)} alt={player.name} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                      <span className="text-[10px] font-bold text-text-muted/60">
                                        {player.name.slice(0, 2).toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  {/* Name */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-text-primary truncate">{player.name}</p>
                                    {player.nationality && (
                                      <p className="text-[10px] text-text-muted/70 truncate">{player.nationality}</p>
                                    )}
                                  </div>
                                  {/* Role badge */}
                                  {player.role && (
                                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${getRoleBadgeStyle(player.role)}`}>
                                      {player.role}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-6">
                              <Shield className="w-5 h-5 text-border-primary/50 mx-auto mb-1.5" />
                              <p className="text-text-muted text-[10px]">{t('empty_no_players')}</p>
                            </div>
                          )}

                          {/* Coaches separator */}
                          {coaches.length > 0 && activePlayers.length > 0 && (
                            <div className="mx-3 my-2 h-px bg-[var(--color-border-primary)]/15" />
                          )}

                          {/* Coaches */}
                          {coaches.length > 0 && (
                            <div className="space-y-0.5">
                              {coaches.map((player) => (
                                <div
                                  key={player.id}
                                  className="group/player flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
                                >
                                  <div className="w-8 h-8 rounded-full bg-[var(--color-bg-primary)]/80 ring-1 ring-[var(--color-border-primary)]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {player.image_url ? (
                                      <img src={proxyImageUrl(player.image_url)} alt={player.name} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                      <span className="text-[10px] font-bold text-text-muted/60">
                                        {player.name.slice(0, 2).toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-text-primary truncate">{player.name}</p>
                                  </div>
                                  <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border text-amber-400 bg-amber-500/10 border-amber-500/25 flex-shrink-0">
                                    {player.role}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ============================================================ */}
            {/* MATCH DETAILS                                                */}
            {/* ============================================================ */}
            <section>
              <SectionHeader icon={Info} title={t('section_match_info')} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { label: t('info_match_id'), value: String(match.id) },
                  match.match2id ? { label: t('info_match2id'), value: match.match2id } : null,
                  match.slug ? { label: t('info_slug'), value: match.slug } : null,
                  match.match_type ? { label: t('info_match_type'), value: match.match_type } : null,
                  match.section ? { label: t('info_section'), value: match.section } : null,
                  match.tournament?.region ? { label: t('info_region'), value: match.tournament.region } : null,
                  match.tournament?.prizepool ? { label: t('info_prizepool'), value: match.tournament.prizepool } : null,
                  match.scheduled_at ? { label: t('info_scheduled_at'), value: `${formatDate(match.scheduled_at)} ${formatTime(match.scheduled_at)}` } : null,
                  match.rescheduled && match.original_scheduled_at ? { label: t('info_original_date'), value: `${formatDate(match.original_scheduled_at)} ${formatTime(match.original_scheduled_at)}` } : null,
                  match.end_at ? { label: t('info_end_at'), value: `${formatDate(match.end_at)} ${formatTime(match.end_at)}` } : null,
                  match.wiki ? { label: t('info_wiki'), value: match.wiki } : null,
                  match.live?.supported !== undefined ? { label: t('info_live_supported'), value: match.live.supported ? t('yes') : t('no') } : null,
                ].filter(Boolean).map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-[var(--color-bg-secondary)]/40 border border-[var(--color-border-primary)]/15 hover:border-[var(--color-border-primary)]/30 transition-colors"
                  >
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold flex-shrink-0">{row!.label}</span>
                    <span className="text-xs text-text-primary font-medium text-right truncate font-mono">{row!.value}</span>
                  </div>
                ))}
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
