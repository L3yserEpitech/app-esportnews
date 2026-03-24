'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/app/contexts/ToastContext';
import LiquipediaBadge from '@/app/components/common/LiquipediaBadge';
import {
  Gamepad2,
  Calendar,
  Users,
  Trophy,
  Newspaper,
  Zap,
  Globe,
} from 'lucide-react';
import { PandaTournament, PandaMatch, NewsItem } from '@/app/types';
import { tournamentService } from '@/app/services/tournamentService';
import { matchService } from '@/app/services/matchService';
import { advertisementService } from '@/app/services/advertisementService';
import { articleService } from '@/app/services/articleService';
import { Advertisement } from '@/app/types';
import AdColumn from '@/app/components/ads/AdColumn';
import TeamsRosters from '@/app/components/tournaments/TeamsRosters';
import TournamentMatchCard from '@/app/components/tournaments/TournamentMatchCard';
import TournamentBracket from '@/app/components/tournaments/TournamentBracket';
import ArticleCard from '@/app/components/article/ArticleCard';
import Card from '@/app/components/ui/Card';
import { TournamentSchema, BreadcrumbSchema } from '@/app/components/seo/StructuredData';
import { generateBreadcrumbs } from '@/app/lib/breadcrumbHelper';
import { proxyImageUrl } from '@/app/lib/imageProxy';

interface TournamentDetailPageClientProps {
  tournamentId: string;
}

/** Group matches by date string (YYYY-MM-DD) preserving order */
function groupMatchesByDate(matches: PandaMatch[]): { dateKey: string; label: string; matches: PandaMatch[] }[] {
  const groups = new Map<string, PandaMatch[]>();
  const order: string[] = [];

  for (const m of matches) {
    const raw = m.begin_at || m.scheduled_at || '';
    let dateKey = 'unknown';
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000) {
        dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
      order.push(dateKey);
    }
    groups.get(dateKey)!.push(m);
  }

  return order.map(dateKey => {
    let label: string;
    if (dateKey === 'unknown') {
      label = 'Date inconnue';
    } else {
      const [y, mo, d] = dateKey.split('-').map(Number);
      const date = new Date(y, mo - 1, d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.getTime() === today.getTime()) {
        label = "Aujourd'hui";
      } else if (date.getTime() === yesterday.getTime()) {
        label = 'Hier';
      } else if (date.getTime() === tomorrow.getTime()) {
        label = 'Demain';
      } else {
        label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        // Capitalize first letter
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
    }
    return { dateKey, label, matches: groups.get(dateKey)! };
  });
}

export default function TournamentDetailPageClient({ tournamentId }: TournamentDetailPageClientProps) {
  const t = useTranslations('pages_detail.tournament_detail');
  const tToast = useTranslations('toast');
  const router = useRouter();
  const { showToast } = useToast();
  const hasRedirected = useRef(false);
  const [tournament, setTournament] = useState<PandaTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);
  const [relatedArticles, setRelatedArticles] = useState<NewsItem[]>([]);
  const [bannerError, setBannerError] = useState(false);

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

  // Load tournament
  useEffect(() => {
    const loadTournament = async () => {
      try {
        setLoading(true);
        const data = await tournamentService.getTournamentById(tournamentId);
        setTournament(data);

        const allMatchesLackOpponents = data.matches?.every(m => !m.opponents || m.opponents.length === 0);
        if (data.matches && data.matches.length > 0 && allMatchesLackOpponents) {
          const matchIds = data.matches.map((m) => m.id);
          try {
            const enrichedMatches = await matchService.getMatchesByIds(matchIds);
            if (enrichedMatches.length > 0) {
              setTournament((prev) => prev ? { ...prev, matches: enrichedMatches } : prev);
            }
          } catch (matchError) {
            console.error('[Tournament Detail] Error loading match details:', matchError);
          }
        }

        // Load related articles
        try {
          const tournamentTags = [data.name, data.league?.name].filter(Boolean);
          const articles = await articleService.getAllArticles();
          const related = articles
            .filter(a => {
              const articleTags = a.tags || [];
              return tournamentTags.some(tag =>
                articleTags.some(aTag => aTag?.toLowerCase().includes(tag?.toLowerCase() || ''))
              );
            })
            .slice(0, 3);
          setRelatedArticles(related);
        } catch (articleError) {
          console.error('[Tournament Detail] Error loading related articles:', articleError);
        }
      } catch (err) {
        console.error('[Tournament Detail] Error loading tournament:', err);
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          showToast({
            message: tToast('tournament_not_available'),
            linkUrl: 'https://liquipedia.net',
            linkLabel: tToast('view_on_liquipedia'),
            duration: 10000,
          });
          router.back();
        }
      } finally {
        setLoading(false);
      }
    };

    if (tournamentId) {
      loadTournament();
    }
  }, [tournamentId]);

  const memoizedAds = useMemo(() => ads, [ads]);

  // Separate live matches + group ALL matches by date (live included in today)
  const { liveMatches, matchesByDate, totalMatches } = useMemo(() => {
    const matches = tournament?.matches || [];
    const live: PandaMatch[] = [];

    matches.forEach(m => {
      if (m.status === 'running') {
        live.push(m);
      }
    });

    // Sort all matches by date descending (most recent first)
    const sorted = [...matches].sort((a, b) => {
      const dateA = a.begin_at || a.scheduled_at || '';
      const dateB = b.begin_at || b.scheduled_at || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return {
      liveMatches: live,
      matchesByDate: groupMatchesByDate(sorted),
      totalMatches: matches.length,
    };
  }, [tournament?.matches]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      's': 'bg-[var(--color-tier-s)] text-gray-950',
      'a': 'bg-[var(--color-tier-a)] text-white',
      'b': 'bg-[var(--color-tier-b)] text-white',
      'c': 'bg-[var(--color-tier-c)] text-white',
      'd': 'bg-[var(--color-tier-d)] text-white',
    };
    return colors[tier.toLowerCase()] || colors['d'];
  };

  const getTournamentStatus = () => {
    if (!tournament || !tournament.begin_at) return null;
    const now = new Date();
    const begin = new Date(tournament.begin_at);
    const end = new Date(tournament.end_at || tournament.begin_at);
    if (now < begin) return { label: t('status_upcoming'), color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
    if (now > end) return { label: t('status_finished'), color: 'bg-[var(--color-text-muted)]/20 text-[var(--color-text-muted)] border-[var(--color-text-muted)]/30' };
    return { label: t('status_running'), color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  };

  const bannerUrl = tournament?.banner_dark_url || tournament?.banner_url;
  const hasBanner = bannerUrl && !bannerError;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[var(--color-text-secondary)]">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[var(--color-text-secondary)]">{t('loading')}</p>
        </div>
      </div>
    );
  }

  const status = getTournamentStatus();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
  const tournamentUrl = `${siteUrl}/tournois/${tournament.id}`;
  const breadcrumbs = generateBreadcrumbs([
    { name: 'Tournois', url: '/tournois' },
    { name: tournament.name, url: tournamentUrl },
  ]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <TournamentSchema
        name={tournament.name}
        description={`Tournoi ${tournament.name} - ${tournament.league?.name || 'Esport'}`}
        startDate={tournament.begin_at || undefined}
        endDate={tournament.end_at || undefined}
        url={tournamentUrl}
        location={tournament.region || undefined}
        prizeMoney={tournament.prizepool || undefined}
        teams={tournament.teams?.length}
      />
      <BreadcrumbSchema items={breadcrumbs} />

      {/* ── Header ── */}
      <div className="container mx-auto px-4 pt-35">
        <div className="flex items-start gap-4">
          {/* Icon */}
          {(tournament.icon_dark_url || tournament.icon_url) && (
            <div className="hidden sm:flex w-14 h-14 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] items-center justify-center overflow-hidden flex-shrink-0">
              <img
                src={proxyImageUrl(tournament.icon_dark_url || tournament.icon_url || '')}
                alt=""
                className="w-10 h-10 object-contain"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {tournament.tier && (
                <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider ${getTierColor(tournament.tier)}`}>
                  {tournament.tier.toUpperCase()}
                </span>
              )}
              {status && (
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${status.color}`}>
                  {status.label}
                </span>
              )}
              {tournament.videogame?.slug && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-hover)] uppercase">
                  {tournament.videogame.slug}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] leading-tight">
              {tournament.name}
            </h1>
          </div>

          {/* Banner — small contained image on the right */}
          {hasBanner && (
            <div className="hidden md:block flex-shrink-0 w-64 lg:w-80 overflow-hidden border border-[var(--color-border-primary)]/50">
              <img
                src={proxyImageUrl(bannerUrl)}
                alt=""
                className="w-full h-auto object-contain"
                onError={() => setBannerError(true)}
              />
            </div>
          )}
        </div>

        {/* Meta line */}
        <div className="flex items-center gap-4 flex-wrap mt-3 text-sm text-[var(--color-text-secondary)] pb-6 border-b border-[var(--color-border-primary)]/50">
          {tournament.league?.name && (
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                {tournament.league.name}
              </span>
            )}
            {tournament.begin_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                {formatDate(tournament.begin_at)}
                {tournament.end_at && ` — ${formatDate(tournament.end_at)}`}
              </span>
            )}
            {tournament.region && (
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span className="capitalize">{tournament.region}</span>
              </span>
            )}
            {tournament.prizepool && (
              <span className="font-bold text-[var(--color-accent)]">{tournament.prizepool}</span>
            )}
            <LiquipediaBadge />
          </div>
        </div>

      {/* ── Main Content ── */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          <div className="flex-1 min-w-0 space-y-10">

            {/* ── Live Matches ── */}
            {liveMatches.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-status-live)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-status-live)]" />
                  </span>
                  <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('live_matches_title')}</h2>
                  <span className="text-xs font-semibold text-[var(--color-status-live)] bg-[var(--color-status-live)]/10 px-2 py-0.5 rounded">
                    {liveMatches.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {liveMatches.map(match => (
                    <TournamentMatchCard key={match.id} match={match} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Bracket Tree (desktop only) ── */}
            <div className="hidden md:block">
              <TournamentBracket matches={tournament.matches || []} />
            </div>

            {/* ── All Matches (grouped by date) ── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2.5">
                <Gamepad2 className="w-5 h-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('all_matches')}</h2>
                <span className="text-xs text-[var(--color-text-muted)] font-medium">
                  {totalMatches} {totalMatches > 1 ? t('matches_total_plural') : t('matches_total_singular')}
                </span>
              </div>

              {matchesByDate.length > 0 ? (
                <div className="space-y-6">
                  {matchesByDate.map(group => (
                    <div key={group.dateKey}>
                      {/* Date header */}
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                          {group.label}
                        </span>
                        <div className="flex-1 h-px bg-[var(--color-border-primary)]/40" />
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {group.matches.length} match{group.matches.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {group.matches.map(match => (
                          <TournamentMatchCard key={match.id} match={match} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : totalMatches === 0 ? (
                <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-10 text-center">
                  <Gamepad2 className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-3" />
                  <p className="text-[var(--color-text-secondary)] font-medium">{t('no_matches')}</p>
                  <p className="text-[var(--color-text-muted)] text-sm mt-1">{t('no_matches_subtitle')}</p>
                </div>
              ) : null}
            </section>

            {/* ── Teams & Rosters ── */}
            <section>
              <TeamsRosters tournament={tournament} />
            </section>

            {/* ── Related Articles ── */}
            {relatedArticles.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <Newspaper className="w-5 h-5 text-[var(--color-accent)]" />
                  <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('related_news')}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {relatedArticles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* Ad column */}
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
