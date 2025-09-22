'use client';

import { useState, useEffect } from 'react';
import GameSelector from './components/games/GameSelector';
import LiveMatchItem from './components/matches/LiveMatchItem';
import LiveMatchCard from './components/matches/LiveMatchCard';
import LiveMatchesCarousel from './components/matches/LiveMatchesCarousel';
import NewsSection from './components/news/NewsSection';
import AdColumn from './components/ads/AdColumn';
import { Game, Match, NewsItem, Advertisement, LiveMatch } from './types';
import { gameService } from './services/gameService';
import { liveMatchService } from './services/liveMatchService';


const mockMatches: Match[] = [];

const mockNews: NewsItem[] = [
  {
    id: 1,
    slug: 'valorant-champions-2024-grand-final',
    title: 'Valorant Champions 2024 : Une finale épique nous attend',
    subtitle: 'Les deux meilleures équipes mondiales s\'affrontent pour le titre suprême',
    description: 'Après des semaines de compétition acharnée, la finale du Valorant Champions 2024 promet d\'être un spectacle inoubliable.',
    author: 'Admin',
    created_at: new Date().toISOString(),
    readTime: 5,
    featuredImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
    category: 'Tournois',
    tags: ['Valorant', 'Champions', 'Esport'],
    views: 1250,
    status: 'publié'
  }
];

const mockAds: Advertisement[] = [
  {
    id: 1,
    title: 'Gaming Gear Pro',
    position: 1,
    type: 'banner',
    url: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=300&h=400',
    redirect_link: 'https://example.com',
    is_active: true,
    file_size: 150000,
    file_type: 'image/jpeg',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export default function HomePage() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [news, setNews] = useState<NewsItem[]>(mockNews);
  const [ads, setAds] = useState<Advertisement[]>(mockAds);
  const [isLoadingGames, setIsLoadingGames] = useState(true);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);

  // Charger les jeux depuis l'API
  useEffect(() => {
    const loadGames = async () => {
      try {
        setIsLoadingGames(true);
        const fetchedGames = await gameService.getGames();
        setGames(fetchedGames);
      } catch (error) {
        console.error('Erreur lors du chargement des jeux:', error);
      } finally {
        setIsLoadingGames(false);
      }
    };

    loadGames();
  }, []);

  // Charger les matchs en direct depuis l'API backend
  useEffect(() => {
    const loadLiveMatches = async () => {
      try {
        setIsLoadingMatches(true);
        const fetchedMatches = await liveMatchService.getLiveMatches();
        setLiveMatches(fetchedMatches);
      } catch (error) {
        console.error('Erreur lors du chargement des matchs en direct:', error);
      } finally {
        setIsLoadingMatches(false);
      }
    };

    loadLiveMatches();
  }, []);

  // Charger les données selon le jeu sélectionné
  useEffect(() => {
    if (selectedGame) {
      console.log('Chargement des données pour le jeu:', selectedGame);
      // Ici on appellerait les vraies APIs SportDevs et PandaScore
    }
  }, [selectedGame]);

  const handleGameSelectionChange = (gameId: string | null) => {
    setSelectedGame(gameId);
    // Filtrer les matchs selon le jeu sélectionné
    // setLiveMatches(filteredMatches);
  };

  const featuredNews = news.length > 0 ? news[0] : undefined;
  const newsList = news.slice(1);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header avec sélecteur de jeux */}
      <header className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-white">
                <span className="text-pink-500">Esport</span>News
              </h1>
              <nav className="hidden md:flex space-x-6">
                <a href="/" className="text-pink-400 hover:text-pink-300 transition-colors">
                  Accueil
                </a>
                <a href="/direct" className="text-gray-300 hover:text-white transition-colors">
                  Direct
                </a>
                <a href="/tournois" className="text-gray-300 hover:text-white transition-colors">
                  Tournois
                </a>
                <a href="/news" className="text-gray-300 hover:text-white transition-colors">
                  News
                </a>
                <a href="/calendrier" className="text-gray-300 hover:text-white transition-colors">
                  Calendrier
                </a>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsSubscribed(!isSubscribed)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isSubscribed
                    ? 'bg-pink-500 text-white'
                    : 'border border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-white'
                }`}
              >
                {isSubscribed ? '✓ Premium' : 'S\'abonner'}
              </button>
            </div>
          </div>
        </div>

      </header>

      {/* Banderole de sélection des jeux - Position fixe avec scroll detection */}
      {!isLoadingGames && (
        <GameSelector
          games={games}
          selectedGame={selectedGame}
          onSelectionChange={handleGameSelectionChange}
          className="fixed top-0 left-0 right-0 z-40"
        />
      )}

      {/* Contenu principal */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Contenu principal */}
          <div className="flex-1 min-w-0 space-y-8">
            {/* Section Matchs en Direct */}
            <section aria-labelledby="live-matches">
              <LiveMatchesCarousel
                matches={liveMatches}
                isLoading={isLoadingMatches}
              />
            </section>

            {/* Section News */}
            <NewsSection
              featuredNews={featuredNews}
              newsList={newsList}
            />
          </div>

          {/* Colonne publicitaire (desktop uniquement) */}
          <AdColumn
            ads={ads}
            isSubscribed={isSubscribed}
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
