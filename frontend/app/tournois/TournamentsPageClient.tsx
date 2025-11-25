'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { PandaTournament, Advertisement } from '../types';
import { advertisementService } from '../services/advertisementService';
import TournamentCard from '../components/tournaments/TournamentCard';
import GameSelector from '../components/games/GameSelector';
import AdColumn from '../components/ads/AdColumn';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

const TournamentsPage: React.FC = () => {
  const t = useTranslations();
  const { selectedGame, games, isLoadingGames: gamesLoading, setSelectedGame, getSelectedGameData } = useGame();
  const [tournaments, setTournaments] = useState<PandaTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortBy, setSortBy] = useState<'tier' | '-tier' | 'begin_at' | '-begin_at'>('tier');
  const [status, setStatus] = useState<'running' | 'upcoming' | 'finished'>('running');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const TOURNAMENTS_PER_PAGE = 12;

  // Mémoriser les données du jeu sélectionné
  const selectedGameData = useMemo(() => getSelectedGameData(), [getSelectedGameData]);

  // Mémoriser les données pour éviter les re-rendus inutiles
  const memoizedTournaments = useMemo(() => tournaments, [tournaments]);
  const memoizedAds = useMemo(() => ads, [ads]);
  const memoizedGames = useMemo(() => games, [games]);

  // Charger les tournois avec pagination via l'API
  const loadTournaments = useCallback(async (page: number = 0) => {
    setLoading(true);
    setError(null);

    try {
      const offset = page * TOURNAMENTS_PER_PAGE;
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

      // Déterminer l'endpoint en fonction du statut
      let endpoint = '/api/tournaments';
      if (status === 'upcoming') {
        endpoint = '/api/tournaments/upcoming';
      } else if (status === 'finished') {
        endpoint = '/api/tournaments/finished';
      }

      // Construire l'URL avec les paramètres
      const params = new URLSearchParams();
      params.append('limit', TOURNAMENTS_PER_PAGE.toString());
      params.append('offset', offset.toString());
      params.append('sort', sortBy);

      const url = `${baseUrl}${endpoint}?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tournaments');
      }

      const tournamentsData = await response.json();
      console.log('[TournamentsPageClient] 📊 Tournois récupérés:', tournamentsData);
      setTournaments(Array.isArray(tournamentsData) ? tournamentsData : []);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error loading tournaments:', err);
      setError(t('pages_detail.tournaments.error_loading'));
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [t, TOURNAMENTS_PER_PAGE, sortBy, status]);

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

  // Recharger au démarrage (page 0)
  useEffect(() => {
    setCurrentPage(0);
    loadTournaments(0);
  }, [loadTournaments]);

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

  // Filtrer les tournois selon la recherche
  const filteredTournaments = useMemo(() => {
    if (!searchQuery.trim()) {
      return memoizedTournaments;
    }

    const query = searchQuery.toLowerCase().trim();
    return memoizedTournaments.filter((tournament) => {
      const nameMatch = tournament.name?.toLowerCase().includes(query);
      const slugMatch = tournament.slug?.toLowerCase().includes(query);
      const tierMatch = tournament.tier?.toLowerCase().includes(query);
      const regionMatch = tournament.region?.toLowerCase().includes(query);
      const leagueMatch = tournament.league?.name?.toLowerCase().includes(query);
      const gameMatch = tournament.videogame?.name?.toLowerCase().includes(query);
      const statusMatch = tournament.status?.toLowerCase().includes(query);

      return nameMatch || slugMatch || tierMatch || regionMatch || leagueMatch || gameMatch || statusMatch;
    });
  }, [memoizedTournaments, searchQuery]);


  // Mémoriser les handlers
  const handleRefresh = useCallback(() => {
    setCurrentPage(0);
    loadTournaments(0);
  }, [loadTournaments]);

  const handlePreviousPage = useCallback(() => {
    if (currentPage > 0) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      loadTournaments(newPage);
    }
  }, [currentPage, loadTournaments]);

  const handleNextPage = useCallback(() => {
    const newPage = currentPage + 1;
    setCurrentPage(newPage);
    loadTournaments(newPage);
  }, [currentPage, loadTournaments]);

  // Mémoriser les propriétés de rendu pour éviter les re-créations

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

  // Mémoriser la grille des tournois
  const tournamentsGrid = useMemo(() =>
    memoizedTournaments.map((tournament) => (
      <TournamentCard
        key={tournament.id}
        tournament={tournament}
        showGameBadge={!selectedGameData}
      />
    )), [memoizedTournaments, selectedGameData]);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Sélecteur de jeux tout en haut - masqué sur mobile */}
      <div className="pt-20 hidden md:block">
        <GameSelector
          games={memoizedGames}
          selectedGame={selectedGame}
          onSelectionChange={setSelectedGame}
          isLoading={gamesLoading}
        />
      </div>

      {/* Contenu principal */}
      <div className="pb-8 pt-20 md:pt-0">
        <div className="container mx-auto px-4">
          <div className="flex gap-8">
            {/* Contenu principal */}
            <div className="flex-1 max-w-none">
              {/* Barre de recherche */}
              <div className="mb-6 pt-4">
                <button
                  onClick={() => setIsSearchModalOpen(true)}
                  className="w-full max-w-sm flex items-center justify-center gap-3 px-4 py-3 bg-bg-secondary/50 border border-border-primary/50 rounded-xl text-left text-text-secondary hover:border-border-primary hover:bg-bg-secondary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
                  <span className="text-sm">{t('pages_detail.tournaments.search.placeholder')}</span>
                  <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-text-muted bg-bg-tertiary border border-border-primary/50 rounded">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </button>
              </div>

              {/* Header avec bouton actualiser et pagination */}
              <div className="mb-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-2xl font-bold text-text-primary">Tous les tournois</h2>
                      <span className="text-text-secondary text-sm">
                        Page {currentPage + 1} • {memoizedTournaments.length} tournois
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Sort dropdown */}
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'tier' | '-tier' | 'begin_at' | '-begin_at')}
                        className="px-3 py-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg border border-border-primary transition-colors cursor-pointer text-sm"
                        title="Trier les tournois"
                      >
                        <option value="tier">Tier (S → D)</option>
                        <option value="-tier">Tier (D → S)</option>
                        <option value="begin_at">Date (anciens → récents)</option>
                        <option value="-begin_at">Date (récents → anciens)</option>
                      </select>

                      {/* Bouton actualiser - icon seulement */}
                      <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="p-2 bg-accent hover:bg-accent/80 disabled:bg-border-muted text-text-inverse rounded-lg transition-colors"
                        title={loading ? t('pages_detail.tournaments.loading_button') : t('pages_detail.tournaments.refresh_button')}
                      >
                        <svg
                          className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Filtres de statut */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setStatus('running');
                        setCurrentPage(0);
                      }}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        status === 'running'
                          ? 'bg-accent text-text-inverse'
                          : 'bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-primary'
                      }`}
                    >
                      {t('pages_detail.tournaments.status_running')}
                    </button>
                    <button
                      onClick={() => {
                        setStatus('upcoming');
                        setCurrentPage(0);
                      }}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        status === 'upcoming'
                          ? 'bg-accent text-text-inverse'
                          : 'bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-primary'
                      }`}
                    >
                      {t('pages_detail.tournaments.status_upcoming')}
                    </button>
                    <button
                      onClick={() => {
                        setStatus('finished');
                        setCurrentPage(0);
                      }}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        status === 'finished'
                          ? 'bg-accent text-text-inverse'
                          : 'bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-primary'
                      }`}
                    >
                      {t('pages_detail.tournaments.status_finished')}
                    </button>
                  </div>
                </div>
              </div>

            {/* Contenu des tournois */}
            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                  <p className="text-red-600">{error}</p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loadingSkeletons}
              </div>
            ) : memoizedTournaments.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tournamentsGrid}
                </div>

                {/* Pagination */}
                <div className="mt-12 flex items-center justify-center gap-4">
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 0 || loading}
                    className="px-6 py-2 bg-bg-secondary hover:bg-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-lg font-medium transition-colors border border-border-primary"
                  >
                    ← Précédent
                  </button>

                  <span className="text-text-secondary font-medium">
                    Page {currentPage + 1}
                  </span>

                  <button
                    onClick={handleNextPage}
                    disabled={memoizedTournaments.length < TOURNAMENTS_PER_PAGE || loading}
                    className="px-6 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed text-text-inverse rounded-lg font-medium transition-colors"
                  >
                    Suivant →
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-bg-secondary rounded-lg border border-border-primary p-12 text-center">
                <div className="text-text-secondary mb-4">
                  <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">
                  {t('pages_detail.tournaments.no_tournaments')}
                </h3>
                <p className="text-text-secondary mb-4">
                  Aucun tournoi trouvé pour cette page.
                </p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-accent hover:bg-accent/80 text-text-inverse rounded-lg font-medium transition-colors"
                >
                  {t('pages_detail.tournaments.refresh_button')}
                </button>
              </div>
            )}
          </div>

            {/* Colonne publicitaire (desktop uniquement) */}
            <AdColumn className="mt-8"
              ads={memoizedAds}
              isSubscribed={isSubscribed}
              isLoading={isLoadingAds}
            />
          </div>
        </div>
      </div>

      {/* Modale de recherche plein écran */}
      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] max-h-[90vh] p-0 gap-0 bg-bg-primary border-border-primary/50 flex flex-col [&>button]:hidden">
          {/* Header de la modale avec barre de recherche */}
          <div className="p-6 border-b border-border-primary/50">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('pages_detail.tournaments.search.input_placeholder')}
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
                {filteredTournaments.length} {filteredTournaments.length === 1 ? t('pages_detail.tournaments.search.result_singular') : t('pages_detail.tournaments.search.result_plural')}
              </p>
            )}
          </div>

          {/* Contenu scrollable avec résultats */}
          <div className="flex-1 overflow-y-auto p-6">
            {!searchQuery ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
                  <p className="text-text-secondary text-lg mb-2">{t('pages_detail.tournaments.search.start_typing')}</p>
                  <p className="text-text-muted text-sm">{t('pages_detail.tournaments.search.search_by')}</p>
                </div>
              </div>
            ) : filteredTournaments.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
                  <p className="text-text-secondary text-lg mb-2">{t('pages_detail.tournaments.search.no_results')}</p>
                  <p className="text-text-muted text-sm">{t('pages_detail.tournaments.search.try_other_keywords')}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTournaments.map((tournament) => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    showGameBadge={!selectedGameData}
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

export default TournamentsPage;