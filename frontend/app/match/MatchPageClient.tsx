'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { LiveMatch, Advertisement } from '../types';
import { matchService } from '../services/matchService';
import { advertisementService } from '../services/advertisementService';
import LiveMatchCard from '../components/matches/LiveMatchCard';
import GameSelector from '../components/games/GameSelector';
import AdColumn from '../components/ads/AdColumn';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

// Utility functions for date manipulation
const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDayName = (date: Date, locale: string): string => {
  const dayNames: { [key: string]: string[] } = {
    fr: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
    en: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  };
  const lang = locale.startsWith('fr') ? 'fr' : 'en';
  return dayNames[lang][date.getDay()];
};

const getMonthName = (date: Date, locale: string): string => {
  return date.toLocaleDateString(locale, { month: 'short' });
};

const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

// Generate array of 11 dates centered on current date
const generateDateRange = (centerDate: Date, offset: number = 0): Date[] => {
  const dates: Date[] = [];
  const adjustedCenter = new Date(centerDate);
  adjustedCenter.setDate(adjustedCenter.getDate() + offset * 11);

  for (let i = -5; i <= 5; i++) {
    const date = new Date(adjustedCenter);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
};

const MatchPage: React.FC = () => {
  const t = useTranslations();
  const { selectedGame, games, isLoadingGames, setSelectedGame, getSelectedGameData } = useGame();
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRangeOffset, setDateRangeOffset] = useState(0);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Mémoriser les données du jeu sélectionné
  const selectedGameData = useMemo(() => getSelectedGameData(), [getSelectedGameData]);

  // Mémoriser les données pour éviter les re-rendus inutiles
  const memoizedMatches = useMemo(() => matches, [matches]);
  const memoizedAds = useMemo(() => ads, [ads]);
  const memoizedGames = useMemo(() => games, [games]);

  // Générer la plage de dates
  const dateRange = useMemo(() => generateDateRange(new Date(), dateRangeOffset), [dateRangeOffset]);

  // Charger les matchs
  const loadMatches = useCallback(async () => {
    if (isLoadingGames || games.length === 0) {
      console.log('[MatchPage] Games not loaded yet, skipping...');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const gameAcronym = selectedGameData?.acronym;
      const dateStr = formatDateToYYYYMMDD(selectedDate);
      console.log('[MatchPage] Loading matches:', {
        date: dateStr,
        selectedGame,
        gameAcronym,
        gamesCount: games.length,
      });

      const fetchedMatches = await matchService.getMatchesByDate(dateStr, gameAcronym);
      console.log('[MatchPage] Fetched matches:', fetchedMatches.length);

      // Filter matches to only show those with both teams defined AND exclude banned games
      const validMatches = Array.isArray(fetchedMatches)
        ? fetchedMatches.filter(match => {
            // Check if match has at least 2 opponents with defined opponent data
            const hasValidTeams = match.opponents &&
                   match.opponents.length >= 2 &&
                   match.opponents[0]?.opponent?.name &&
                   match.opponents[1]?.opponent?.name;

            // Exclude banned games (Mobile Legends: Bang Bang, StarCraft 2)
            const gameName = match.videogame?.name?.toLowerCase() || '';
            const isBannedGame = gameName.includes('mobile legends') || gameName.includes('starcraft');

            return hasValidTeams && !isBannedGame;
          })
        : [];

      console.log('[MatchPage] Valid matches (with both teams, excluding banned games):', validMatches.length);
      setMatches(validMatches);
    } catch (err) {
      console.error('Error loading matches:', err);
      setError(t('pages_detail.match.error_loading'));
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedGame, selectedGameData, games, isLoadingGames, t]);

  // Charger les publicités
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

  // Charger les matchs au montage du composant et quand les dépendances changent
  useEffect(() => {
    if (!isLoadingGames && games.length > 0) {
      console.log('[MatchPage] Loading matches - selectedGame:', selectedGame, 'selectedDate:', selectedDate);
      loadMatches();
    }
  }, [loadMatches, isLoadingGames, games.length]);

  // Charger les publicités au démarrage
  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // Raccourci clavier pour ouvrir la modale de recherche (⌘K ou Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
      // Fermer avec Escape
      if (e.key === 'Escape' && isSearchModalOpen) {
        setIsSearchModalOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen]);

  // Filtrer les matchs selon la recherche
  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) {
      return memoizedMatches;
    }

    const query = searchQuery.toLowerCase().trim();
    return memoizedMatches.filter((match) => {
      const nameMatch = match.name?.toLowerCase().includes(query);
      const slugMatch = match.slug?.toLowerCase().includes(query);
      const statusMatch = match.status?.toLowerCase().includes(query);
      const tournamentMatch = match.tournament?.name?.toLowerCase().includes(query);
      const leagueMatch = match.league?.name?.toLowerCase().includes(query);
      const gameMatch = match.videogame?.name?.toLowerCase().includes(query);
      const opponentsMatch = match.opponents?.some(
        (opp) => opp.opponent?.name?.toLowerCase().includes(query) ||
          opp.opponent?.acronym?.toLowerCase().includes(query)
      );

      return nameMatch || slugMatch || statusMatch || tournamentMatch || leagueMatch || gameMatch || opponentsMatch;
    });
  }, [memoizedMatches, searchQuery]);

  // Mémoriser les handlers
  const handleRefresh = useCallback(() => {
    loadMatches();
  }, [loadMatches]);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handlePrevRange = useCallback(() => {
    setDateRangeOffset((prev) => prev - 1);
  }, []);

  const handleNextRange = useCallback(() => {
    setDateRangeOffset((prev) => prev + 1);
  }, []);

  // Mémoriser les skeletons pour éviter la re-création
  const loadingSkeletons = useMemo(() =>
    [...Array(9)].map((_, index) => (
      <div key={`skeleton-${index}`} className="bg-bg-secondary rounded-xl border border-border-primary overflow-hidden animate-pulse">
        <div className="h-48 bg-bg-tertiary" />
        <div className="p-4">
          <div className="h-4 bg-bg-tertiary rounded mb-2" />
          <div className="h-3 bg-bg-tertiary rounded mb-2 w-3/4" />
          <div className="h-3 bg-bg-tertiary rounded mb-3 w-1/2" />
          <div className="flex justify-between">
            <div className="h-3 bg-bg-tertiary rounded w-1/4" />
            <div className="h-3 bg-bg-tertiary rounded w-1/4" />
          </div>
        </div>
      </div>
    )), []);

  // Regrouper les matchs par jeu si aucun jeu n'est sélectionné
  const matchesByGame = useMemo(() => {
    if (selectedGame) return null;

    const grouped = new Map<string, LiveMatch[]>();

    memoizedMatches.forEach((match) => {
      const gameName = match.videogame?.name || 'Autres';
      const gameSlug = match.videogame?.slug || 'others';
      const key = `${gameSlug}::${gameName}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(match);
    });

    return grouped;
  }, [memoizedMatches, selectedGame]);

  // Mémoriser la grille des matchs
  const matchesGrid = useMemo(() => {
    if (!selectedGame && matchesByGame) {
      // Mode groupé par jeu
      return Array.from(matchesByGame.entries()).map(([key, matches]) => {
        const [slug, gameName] = key.split('::');
        const game = games.find(g => g.acronym === slug);

        return (
          <div key={key} className="mb-8">
            {/* Banderole du jeu */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border-primary">
              <h2 className="text-xl font-bold text-text-primary">
                {gameName}
              </h2>
              <span className="ml-auto text-sm text-text-muted">
                {matches.length} {matches.length > 1 ? 'matchs' : 'match'}
              </span>
            </div>

            {/* Grille des matchs pour ce jeu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matches.map((match) => (
                <LiveMatchCard key={match.id} match={match} showGames={true} />
              ))}
            </div>
          </div>
        );
      });
    }

    // Mode normal (jeu sélectionné)
    return memoizedMatches.map((match) => (
      <LiveMatchCard key={match.id} match={match} showGames={true} />
    ));
  }, [memoizedMatches, selectedGame, matchesByGame, games]);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Game Selector - Desktop seulement */}
      <div className="pt-20 hidden md:block">
        <GameSelector
          games={memoizedGames}
          selectedGame={selectedGame}
          onSelectionChange={setSelectedGame}
          isLoading={isLoadingGames}
        />
      </div>

      {/* Layout principal avec sidebar publicitaire (desktop) */}
      <div className="pb-8 pt-20 md:pt-0">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex gap-6">
            {/* Contenu principal */}
            <div className="flex-1 max-w-none">
          {/* Titre de la page avec barre de recherche */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">
                {selectedGame
                  ? `${selectedGameData?.name || ''} - ${t('pages_detail.match.title')}`
                  : t('pages_detail.match.title')}
              </h1>
              <p className="text-text-secondary text-sm">
                {loading
                  ? t('pages_detail.match.loading')
                  : t('pages_detail.match.count', { count: memoizedMatches.length })}
              </p>
            </div>

            {/* Barre de recherche */}
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full sm:w-auto sm:max-w-sm flex items-center justify-center gap-3 px-4 py-3 bg-bg-secondary/50 border border-border-primary/50 rounded-xl text-left text-text-secondary hover:border-border-primary hover:bg-bg-secondary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50 flex-shrink-0"
            >
              <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
              <span className="text-sm">{t('pages_detail.match.search')}</span>
              <kbd className="ml-auto hidden lg:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-text-muted bg-bg-tertiary border border-border-primary/50 rounded">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>

          {/* Calendrier de dates (responsive) */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              {/* Flèche précédent */}
              <button
                onClick={handlePrevRange}
                className="flex-shrink-0 p-2 rounded-lg bg-bg-secondary hover:bg-bg-tertiary border border-border-primary transition-colors"
                aria-label={t('pages_detail.match.prev_dates')}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Grille de dates - responsive */}
              <div className="flex-1 grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-11 gap-2">
                {dateRange.map((date, index) => {
                  const isSelected =
                    date.getDate() === selectedDate.getDate() &&
                    date.getMonth() === selectedDate.getMonth() &&
                    date.getFullYear() === selectedDate.getFullYear();
                  const isTodayDate = isToday(date);

                  // Masquer les dates selon la taille d'écran
                  // Mobile (< sm) : 5 dates (index 0-4)
                  // Tablet (sm < md) : 7 dates (index 0-6)
                  // Medium (md < lg) : 9 dates (index 0-8)
                  // Large (lg+) : 11 dates (index 0-10)
                  const hiddenClasses = [
                    index >= 5 && 'hidden sm:flex',
                    index >= 7 && 'sm:hidden md:flex',
                    index >= 9 && 'md:hidden lg:flex'
                  ].filter(Boolean).join(' ');

                  return (
                    <button
                      key={index}
                      onClick={() => handleDateSelect(date)}
                      className={`
                        flex flex-col items-center justify-center p-2 rounded-lg border transition-all
                        ${hiddenClasses}
                        ${isSelected
                          ? 'bg-[#F22E62] text-white border-[#F22E62]'
                          : isTodayDate
                            ? 'bg-bg-tertiary text-text-primary border-[#F22E62]'
                            : 'bg-bg-secondary text-text-muted border-border-primary hover:bg-bg-tertiary'
                        }
                      `}
                    >
                      <span className="text-xs uppercase mb-1">
                        {getDayName(date, 'fr')}
                      </span>
                      <span className="text-lg font-bold">
                        {date.getDate()}
                      </span>
                      <span className="text-xs capitalize">
                        {getMonthName(date, 'fr')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Flèche suivant */}
              <button
                onClick={handleNextRange}
                className="flex-shrink-0 p-2 rounded-lg bg-bg-secondary hover:bg-bg-tertiary border border-border-primary transition-colors"
                aria-label={t('pages_detail.match.next_dates')}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Bouton Refresh */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary rounded-lg border border-border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm">{t('pages_detail.match.refresh')}</span>
            </button>
          </div>

          {/* Message d'erreur */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
              {error}
            </div>
          )}

          {/* Grille des matchs */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingSkeletons}
            </div>
          ) : memoizedMatches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted text-lg">
                {t('pages_detail.match.no_matches')}
              </p>
            </div>
          ) : selectedGame ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matchesGrid}
            </div>
          ) : (
            <div className="space-y-8">
              {matchesGrid}
            </div>
          )}
            </div>

            {/* Colonne de publicités - Desktop uniquement */}
            {!isSubscribed && (
              <div className="hidden xl:block">
                <div className="sticky top-24">
                  <AdColumn ads={memoizedAds} isLoading={isLoadingAds} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modale de recherche */}
      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent overlayVariant="default" className="w-[98vw] max-w-[1920px] h-[90vh] max-h-[90vh] p-0 gap-0 bg-background border-border-primary/50 flex flex-col [&>button]:hidden">
          <DialogTitle className="sr-only">{t('pages_detail.match.search_title')}</DialogTitle>

          {/* Header de la modale avec barre de recherche */}
          <div className="p-6 border-b border-border-primary/50 bg-background">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('pages_detail.match.search_placeholder')}
                  className="w-full pl-12 pr-4 py-3 bg-bg-secondary/50 border border-border-primary/50 rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setIsSearchModalOpen(false);
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {searchQuery && (
              <p className="mt-3 text-sm text-text-muted">
                {t('pages_detail.match.count', { count: filteredMatches.length })}
              </p>
            )}
          </div>

          {/* Contenu scrollable avec résultats */}
          <div className="flex-1 overflow-y-auto p-6 bg-background">
            {!searchQuery ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
                  <p className="text-text-secondary text-lg mb-2">{t('pages_detail.match.search_start')}</p>
                  <p className="text-text-muted text-sm">{t('pages_detail.match.search_placeholder')}</p>
                </div>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
                  <p className="text-text-secondary text-lg mb-2">{t('pages_detail.match.search_no_results')}</p>
                  <p className="text-text-muted text-sm">Essayez avec d'autres mots-clés</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {filteredMatches.map((match) => (
                  <LiveMatchCard
                    key={match.id}
                    match={match}
                    showGames={true}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchPage;
