'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import GameSelector from './components/games/GameSelector';
import LiveMatchesCarousel from './components/matches/LiveMatchesCarousel';
import NewsSection from './components/news/NewsSection';
import AdColumn from './components/ads/AdColumn';
import RunningTournaments from './components/tournaments/RunningTournaments';
import { Match, NewsItem, Advertisement, LiveMatch } from './types';
import { liveMatchService } from './services/liveMatchService';
import { advertisementService } from './services/advertisementService';
import { articleService } from './services/articleService';
import { useGame } from './contexts/GameContext';
import { WebSiteSchema, OrganizationSchema } from './components/seo/StructuredData';


const mockMatches: Match[] = [];



export default function HomePage() {
  const { games, selectedGame, setSelectedGame, isLoadingGames } = useGame();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [featuredNews, setFeaturedNews] = useState<NewsItem | null>(null);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

  // Charger les matchs en direct depuis l'API backend
  const loadLiveMatches = useCallback(async () => {
    // Ne pas charger si les jeux ne sont pas encore chargés
    if (isLoadingGames || games.length === 0) {
      console.log('[HomePage] Games not loaded yet, skipping...');
      return;
    }

    try {
      setIsLoadingMatches(true);
      // Récupérer l'acronym du jeu sélectionné si disponible
      const selectedGameData = selectedGame 
        ? games.find(g => {
            const gameIdStr = String(g.id);
            const selectedGameStr = String(selectedGame);
            return gameIdStr === selectedGameStr;
          })
        : null;
      const gameAcronym = selectedGameData?.acronym;
      console.log('[HomePage] Loading live matches:', { 
        selectedGame, 
        selectedGameData: selectedGameData?.name,
        gameAcronym,
        gamesCount: games.length
      });
      // Utiliser directement l'acronym sans mapping
      const fetchedMatches = await liveMatchService.getLiveMatches(gameAcronym);
      console.log('[HomePage] Fetched matches:', fetchedMatches.length);

      // Filter out banned games (Mobile Legends: Bang Bang, StarCraft 2)
      const validMatches = Array.isArray(fetchedMatches)
        ? fetchedMatches.filter(match => {
            const gameName = match.videogame?.name?.toLowerCase() || '';
            const isBannedGame = gameName.includes('mobile legends') || gameName.includes('starcraft');
            return !isBannedGame;
          })
        : [];

      console.log('[HomePage] Valid matches (excluding banned games):', validMatches.length);
      setLiveMatches(validMatches);
    } catch (error) {
      console.error('[HomePage] Erreur lors du chargement des matchs en direct:', error);
    } finally {
      setIsLoadingMatches(false);
    }
  }, [selectedGame, games, isLoadingGames]);

  // Recharger les matchs quand selectedGame change
  useEffect(() => {
    if (!isLoadingGames && games.length > 0) {
      console.log('[HomePage] selectedGame changed, triggering loadLiveMatches - selectedGame:', selectedGame, 'gamesCount:', games.length);
      loadLiveMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGame]); // Se déclencher UNIQUEMENT quand selectedGame change
  
  // Charger les matchs quand les jeux sont chargés pour la première fois
  useEffect(() => {
    if (!isLoadingGames && games.length > 0) {
      console.log('[HomePage] Games loaded for the first time, loading all matches');
      loadLiveMatches();
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
  const loadGameData = useCallback((gameId: string) => {
    // Ici on appellerait les vraies APIs SportDevs et PandaScore
  }, []);

  useEffect(() => {
    if (selectedGame) {
      loadGameData(selectedGame);
    }
  }, [selectedGame, loadGameData]);

  // Mémorisation des données pour éviter les re-rendus inutiles
  const memoizedLiveMatches = useMemo(() => liveMatches, [liveMatches]);
  const memoizedAds = useMemo(() => ads, [ads]);
  const memoizedFeaturedNews = useMemo(() => featuredNews, [featuredNews]);
  const memoizedNewsList = useMemo(() => newsList, [newsList]);


  return (
    <div className="min-h-screen bg-primary-900 text-text-primary transition-colors duration-200">
      {/* Structured Data pour SEO */}
      <WebSiteSchema />
      <OrganizationSchema />

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
            {/* Section Matchs en Direct */}
            <section aria-labelledby="live-matches">
              <LiveMatchesCarousel
                matches={memoizedLiveMatches}
                isLoading={isLoadingMatches}
              />
            </section>

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
