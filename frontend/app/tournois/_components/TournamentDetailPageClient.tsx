'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/app/contexts/ToastContext';
import { PandaTournament, PandaMatch, NewsItem, Advertisement } from '@/app/types';
import { tournamentService } from '@/app/services/tournamentService';
import { matchService } from '@/app/services/matchService';
import { advertisementService } from '@/app/services/advertisementService';
import { articleService } from '@/app/services/articleService';
import AdColumn from '@/app/components/ads/AdColumn';
import { TournamentSchema, BreadcrumbSchema } from '@/app/components/seo/StructuredData';
import { generateBreadcrumbs } from '@/app/lib/breadcrumbHelper';
import { prewarmFromData } from '@/app/lib/imageProxy';
import { tournamentHref } from '@/app/lib/gameLinks';
import { resolveSections, type SectionId } from './tournamentSections';
import { groupMatchesByDate, type TournamentSectionProps } from './sections/shared';
import TournamentHeader from './sections/TournamentHeader';
import LiveMatches from './sections/LiveMatches';
import BracketSection from './sections/BracketSection';
import AllMatches from './sections/AllMatches';
import RostersSection from './sections/RostersSection';
import RelatedNews from './sections/RelatedNews';

interface TournamentDetailPageClientProps {
  tournamentId: string;
  wiki?: string | null;
  initialTournament?: PandaTournament | null;
}

const SECTION_COMPONENTS: Record<SectionId, React.ComponentType<TournamentSectionProps>> = {
  header: TournamentHeader,
  liveMatches: LiveMatches,
  bracket: BracketSection,
  allMatches: AllMatches,
  rosters: RostersSection,
  relatedNews: RelatedNews,
};

export default function TournamentDetailPageClient({ tournamentId, wiki, initialTournament }: TournamentDetailPageClientProps) {
  const t = useTranslations('pages_detail.tournament_detail');
  const tToast = useTranslations('toast');
  const router = useRouter();
  const { showToast } = useToast();
  const hasRedirected = useRef(false);
  const [tournament, setTournament] = useState<PandaTournament | null>(initialTournament || null);

  useEffect(() => {
    prewarmFromData(tournament);
  }, [tournament]);
  const [loading, setLoading] = useState(!initialTournament);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);
  const [relatedArticles, setRelatedArticles] = useState<NewsItem[]>([]);

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
    // Enrichit un tournoi déjà chargé : détails de matchs manquants + articles liés.
    const hydrate = async (data: PandaTournament) => {
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
    };

    const load = async () => {
      try {
        setLoading(true);
        const data = initialTournament ?? await tournamentService.getTournamentById(tournamentId, wiki);
        setTournament(data);
        await hydrate(data);
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
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const memoizedAds = useMemo(() => ads, [ads]);

  const { liveMatches, matchesByDate, totalMatches } = useMemo(() => {
    const matches = tournament?.matches || [];
    const live: PandaMatch[] = matches.filter(m => m.status === 'running');

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

  if (loading || !tournament) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[var(--color-text-secondary)]">{t('loading')}</p>
        </div>
      </div>
    );
  }

  const resolvedWiki = wiki || tournament.wiki;
  const sections = resolveSections(resolvedWiki);
  const sectionProps: TournamentSectionProps = {
    tournament,
    wiki: resolvedWiki,
    liveMatches,
    matchesByDate,
    totalMatches,
    relatedArticles,
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
  const tournamentUrl = `${siteUrl}${tournamentHref({ id: tournament.id, wiki: resolvedWiki })}`;
  const breadcrumbs = generateBreadcrumbs([
    { name: 'Tournois', url: '/tournois' },
    { name: tournament.name, url: tournamentUrl },
  ]);

  const [headerId, ...bodySections] = sections;

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

      {headerId === 'header' && <TournamentHeader {...sectionProps} />}

      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          <div className="flex-1 min-w-0 space-y-10">
            {bodySections.map((id) => {
              const Section = SECTION_COMPONENTS[id];
              return <Section key={id} {...sectionProps} />;
            })}
          </div>

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
