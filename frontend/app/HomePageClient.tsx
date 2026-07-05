'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import GameSelector from './components/games/GameSelector';
import LiveMatchesCarousel from './components/matches/LiveMatchesCarousel';
import NewsSection from './components/news/NewsSection';
import AdColumn from './components/ads/AdColumn';
import RunningTournaments from './components/tournaments/RunningTournaments';
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



export default function HomePageClient() {
  const t = useTranslations();
  const { games, selectedGame, setSelectedGame, isLoadingGames } = useGame();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [bestMatches, setBestMatches] = useState<LiveMatch[]>([]);
  const [featuredNews, setFeaturedNews] = useState<NewsItem | null>(null);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

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

  // Recharger les matchs quand selectedGame change
  useEffect(() => {
    if (!isLoadingGames && games.length > 0) {
      loadBestMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGame]); // Se déclencher UNIQUEMENT quand selectedGame change

  // Charger les matchs quand les jeux sont chargés pour la première fois
  useEffect(() => {
    if (!isLoadingGames && games.length > 0) {
      loadBestMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingGames]); // Se déclencher quand isLoadingGames passe de true à false

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

  // Charger tous les articles depuis l'API
  const loadAllNews = useCallback(async () => {
    try {
      setIsLoadingNews(true);
      const allArticles = await articleService.getAllArticles();

      if (allArticles.length > 0) {
        // Article en vedette : le plus récent
        setFeaturedNews(allArticles[0]);
        // Les 6 articles suivants (ordre décroissant par date)
        setNewsList(allArticles.slice(1, 7));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des articles:', error);
    } finally {
      setIsLoadingNews(false);
    }
  }, []);

  useEffect(() => {
    loadAllNews();
  }, [loadAllNews]);

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
            />

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
