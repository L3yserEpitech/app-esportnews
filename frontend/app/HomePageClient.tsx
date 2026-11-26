'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import GameSelector from './components/games/GameSelector';
import LiveMatchesCarousel from './components/matches/LiveMatchesCarousel';
import NewsSection from './components/news/NewsSection';
import AdColumn from './components/ads/AdColumn';
import RunningTournaments from './components/tournaments/RunningTournaments';
import AdSpot from './components/ads/AdSpot';
import { useTranslations } from 'next-intl';
import { Star, Swords } from 'lucide-react';
import ContentLoader from './components/ui/ContentLoader';
import { Match, NewsItem, Advertisement, LiveMatch } from './types';
import { matchService } from './services/matchService';
import { advertisementService } from './services/advertisementService';
import { articleService } from './services/articleService';
import { useGame } from './contexts/GameContext';

const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Meilleurs matchs du jour : parmi les matchs de la date courante, on garde
// ceux du meilleur tier disponible (même logique que la page /match).
function pickBestMatchesOfDay(matches: LiveMatch[]): LiveMatch[] {
  const tierOrder = ['s', 'a', 'b', 'c', 'd'];
  let bestTier: string | null = null;
  for (const tier of tierOrder) {
    if (matches.some(m => m.tournament?.tier?.toLowerCase() === tier)) {
      bestTier = tier;
      break;
    }
  }
  if (!bestTier) return [];

  const statusRank = (s?: string | null) => (s === 'running' ? 0 : s === 'finished' ? 2 : 1);
  return matches
    .filter(m => m.tournament?.tier?.toLowerCase() === bestTier)
    .sort((a, b) => {
      const rank = statusRank(a.status) - statusRank(b.status);
      if (rank !== 0) return rank;
      return new Date(a.begin_at || 0).getTime() - new Date(b.begin_at || 0).getTime();
    });
}



interface HomePageClientProps {
  // Articles lus côté serveur (sans filtre de jeu) : présents dans le HTML initial.
  initialArticles?: NewsItem[];
}

export default function HomePageClient({ initialArticles }: HomePageClientProps) {
  const t = useTranslations();
  const { games, selectedGame, setSelectedGame, isLoadingGames, isSelectionRestored, getSelectedGameData } = useGame();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [bestMatches, setBestMatches] = useState<LiveMatch[]>([]);
  const [featuredNews, setFeaturedNews] = useState<NewsItem | null>(initialArticles?.[0] ?? null);
  const [newsList, setNewsList] = useState<NewsItem[]>(initialArticles?.slice(1, 7) ?? []);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isLoadingNews, setIsLoadingNews] = useState(!initialArticles?.length);
  // Les articles du serveur valent tant que l'on reste sans filtre de jeu.
  const leftInitialRef = useRef(false);

  // Charger les meilleurs matchs du jour (top tier de la date courante)
  const loadBestMatches = useCallback(async () => {
    // Ne pas charger si les jeux ne sont pas encore chargés
    if (isLoadingGames || games.length === 0) {
      return;
    }

    try {
      setIsLoadingMatches(true);
      const selectedGameData = selectedGame
        ? games.find(g => String(g.id) === String(selectedGame))
        : null;
      const gameAcronym = selectedGameData?.acronym;

      const today = formatDateToYYYYMMDD(new Date());
      const fetchedMatches = await matchService.getMatchesByDate(today, gameAcronym);

      const validMatches = (Array.isArray(fetchedMatches) ? fetchedMatches : []).filter(match => {
        const hasValidTeams = match.opponents &&
          match.opponents.length >= 2 &&
          match.opponents[0]?.opponent?.name &&
          match.opponents[1]?.opponent?.name;
        return hasValidTeams;
      }) as LiveMatch[];

      setBestMatches(pickBestMatchesOfDay(validMatches));
    } catch (error) {
      console.error('[HomePage] Erreur lors du chargement des meilleurs matchs:', error);
    } finally {
      setIsLoadingMatches(false);
    }
  }, [selectedGame, games, isLoadingGames]);

  // Charger les matchs quand les jeux finissent de charger ou quand selectedGame change
  // (games volontairement hors des deps pour éviter un refetch à chaque nouvelle référence)
  useEffect(() => {
    if (!isLoadingGames && games.length > 0) {
      loadBestMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGame, isLoadingGames]);

  // Charger les publicités depuis l'API
  const loadAds = useCallback(async () => {
    try {
      setIsLoadingAds(true);
      const fetchedAds = await advertisementService.getActiveAdvertisements();
      setAds(fetchedAds);
    } catch (error) {
      console.error('Erreur lors du chargement des publicités:', error);
    } finally {
      setIsLoadingAds(false);
    }
  }, []);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // Same rule as /news: only an id present in `games` filters, and a saved
  // selection waits for that list. Without one, /api/games delays nothing.
  const activeGameData = getSelectedGameData();
  const activeGameId = activeGameData ? String(activeGameData.id) : undefined;
  const isWaitingForSelection = !isSelectionRestored || (selectedGame !== null && isLoadingGames);

  // 7 most recent articles of the selection: 1 featured + 6 in the grid.
  useEffect(() => {
    if (isWaitingForSelection) return;
    if (!activeGameId && initialArticles?.length && !leftInitialRef.current) return;
    leftInitialRef.current = true;

    let stale = false;
    setIsLoadingNews(true);
    articleService
      .getAllArticles({ limit: 7, gameId: activeGameId })
      .then((articles) => {
        if (stale) return;
        setFeaturedNews(articles[0] ?? null);
        setNewsList(articles.slice(1, 7));
      })
      .finally(() => {
        if (!stale) setIsLoadingNews(false);
      });

    return () => {
      stale = true;
    };
  }, [isWaitingForSelection, activeGameId, initialArticles]);

  // Charger les données selon le jeu sélectionné
  const loadGameData = useCallback((_gameId: string) => {
    // Placeholder — per-game data is fetched by child components on demand.
  }, []);

  useEffect(() => {
    if (selectedGame) {
      loadGameData(selectedGame);
    }
  }, [selectedGame, loadGameData]);

  // Mémorisation des données pour éviter les re-rendus inutiles
  const memoizedBestMatches = useMemo(() => bestMatches, [bestMatches]);
  const memoizedAds = useMemo(() => ads, [ads]);
  const memoizedFeaturedNews = useMemo(() => featuredNews, [featuredNews]);
  const memoizedNewsList = useMemo(() => newsList, [newsList]);


  return (
    <div className="min-h-screen bg-primary-900 text-text-primary transition-colors duration-200">
      {/* Banderole de sélection des jeux - Desktop uniquement */}
      <GameSelector
        games={games}
        selectedGame={selectedGame}
        onSelectionChange={setSelectedGame}
        isLoading={isLoadingGames}
        className="hidden md:block fixed top-20 left-0 right-0 z-40"
      />

      {/* Contenu principal - Ajusté pour la navbar fixe et le GameSelector */}
      <main className="container mx-auto px-4 py-8 pt-24 md:pt-27">
        <div className="flex gap-8">
          {/* Contenu principal */}
          <div className="flex-1 min-w-0 space-y-8">
            {/* The H1 carries the page's keywords for search engines; what visitors
                see is the section title below, shown only when there are matches. */}
            <h1 className="sr-only">{t('pages.home.h1')}</h1>
            {(isLoadingMatches || memoizedBestMatches.length > 0) && (
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
                {t('pages.home.live_title')}
              </h2>
            )}

            {/* Section Meilleurs matchs du jour */}
            {(isLoadingMatches || memoizedBestMatches.length > 0) && (
              <section aria-labelledby="best-matches">
                <div className="flex items-center gap-3 mb-3">
                  <Star className="w-3.5 h-3.5 text-[var(--color-tier-s)]" />
                  <span id="best-matches" className="text-sm font-semibold text-[var(--color-text-secondary)]">
                    {t('pages.home.best_matches.title')}
                  </span>
                  <div className="flex-1 h-px bg-[var(--color-border-primary)]/40" />
                  {!isLoadingMatches && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {memoizedBestMatches.length} match{memoizedBestMatches.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {isLoadingMatches ? (
                  <ContentLoader label={t('pages_detail.match.loading')} icon={Swords} compact />
                ) : (
                  <LiveMatchesCarousel
                    matches={memoizedBestMatches}
                    isLoading={isLoadingMatches}
                  />
                )}
              </section>
            )}

            {/* Section News */}
            <NewsSection
              featuredNews={memoizedFeaturedNews}
              newsList={memoizedNewsList}
              isLoading={isLoadingNews}
              gameName={activeGameData?.full_name}
              onShowAllGames={() => setSelectedGame(null)}
            />

            <AdSpot id="mobile-1" />

            {/* Section Tournois en cours */}
            <RunningTournaments />
          </div>

          {/* Colonne publicitaire (desktop uniquement) */}
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
