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
    try {
      setIsLoadingMatches(true);
      const fetchedMatches = await liveMatchService.getLiveMatches();
      setLiveMatches(fetchedMatches);
    } catch (error) {
      console.error('Erreur lors du chargement des matchs en direct:', error);
    } finally {
      setIsLoadingMatches(false);
    }
  }, []);

  useEffect(() => {
    loadLiveMatches();
  }, [loadLiveMatches]);

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

      const actualiteArticles = allArticles.filter(
        article => article.category === 'Actus'
      );

      // Le premier article est l'article en vedette
      if (actualiteArticles.length > 0) {
        setFeaturedNews(actualiteArticles[0]);
        // Maximum 3 articles pour la deuxième colonne
        setNewsList(actualiteArticles.slice(1, 4));
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
