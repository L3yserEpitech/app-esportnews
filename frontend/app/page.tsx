'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import GameSelector from './components/games/GameSelector';
import LiveMatchItem from './components/matches/LiveMatchItem';
import LiveMatchCard from './components/matches/LiveMatchCard';
import LiveMatchesCarousel from './components/matches/LiveMatchesCarousel';
import NewsSection from './components/news/NewsSection';
import AdColumn from './components/ads/AdColumn';
import RunningTournaments from './components/tournaments/RunningTournaments';
import { Match, NewsItem, Advertisement, LiveMatch } from './types';
import { liveMatchService } from './services/liveMatchService';
import { advertisementService } from './services/advertisementService';
import { articleService } from './services/articleService';
import { useGame } from './contexts/GameContext';


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

      // Le premier article est l'article en vedette
      if (allArticles.length > 0) {
        setFeaturedNews(allArticles[0]);
        // Maximum 3 articles pour la deuxième colonne
        setNewsList(allArticles.slice(1, 4));
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
    console.log('Chargement des données pour le jeu:', gameId);
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
    <div className="min-h-screen bg-gray-950">
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

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                <span className="text-pink-500">Esport</span>News
              </h3>
              <p className="text-gray-400 text-sm">
                Votre source d'actualités esport et de suivi des matchs en direct.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-white mb-3">Navigation</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/direct" className="hover:text-white transition-colors">Matchs en Direct</a></li>
                <li><a href="/tournois" className="hover:text-white transition-colors">Tournois</a></li>
                <li><a href="/news" className="hover:text-white transition-colors">Actualités</a></li>
                <li><a href="/calendrier" className="hover:text-white transition-colors">Calendrier</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-3">Jeux</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/valorant" className="hover:text-white transition-colors">Valorant</a></li>
                <li><a href="/cs2" className="hover:text-white transition-colors">CS2</a></li>
                <li><a href="/lol" className="hover:text-white transition-colors">League of Legends</a></li>
                <li><a href="/dota" className="hover:text-white transition-colors">Dota 2</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-white mb-3">Légal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/mentions-legales" className="hover:text-white transition-colors">Mentions légales</a></li>
                <li><a href="/politique-confidentialite" className="hover:text-white transition-colors">Politique de confidentialité</a></li>
                <li><a href="/cookies" className="hover:text-white transition-colors">Cookies</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
            &copy; 2024 EsportNews. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
