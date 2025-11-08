'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useGame } from '../contexts/GameContext';
import { PandaTournament, Advertisement } from '../types';
import { tournamentService, TournamentFiltersType } from '../services/tournamentService';
import { advertisementService } from '../services/advertisementService';
import TournamentCard from '../components/tournaments/TournamentCard';
import TournamentFilters from '../components/tournaments/TournamentFilters';
import GameSelector from '../components/games/GameSelector';
import AdColumn from '../components/ads/AdColumn';

type TournamentStatus = 'running' | 'upcoming' | 'finished';

const TournamentsPage: React.FC = () => {
  const t = useTranslations();
  const { selectedGame, games, isLoadingGames: gamesLoading, setSelectedGame, getSelectedGameData } = useGame();
  const [tournaments, setTournaments] = useState<PandaTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<TournamentStatus>('running');
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [filters, setFilters] = useState<TournamentFiltersType>({
    tiers: []
  });

  // Mémoriser les données du jeu sélectionné
  const selectedGameData = useMemo(() => getSelectedGameData(), [getSelectedGameData]);

  // Mémoriser les données pour éviter les re-rendus inutiles
  const memoizedTournaments = useMemo(() => tournaments, [tournaments]);
  const memoizedAds = useMemo(() => ads, [ads]);
  const memoizedGames = useMemo(() => games, [games]);

  // Charger les tournois selon le statut, le jeu sélectionné et les filtres
  const loadTournaments = useCallback(async (
    status: TournamentStatus,
    gameAcronym?: string,
    currentFilters?: TournamentFiltersType
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Utiliser la nouvelle méthode avec filtres
      const activeFilters = currentFilters || filters;
      const hasFilters = activeFilters.tiers.length > 0;

      let tournamentsData: PandaTournament[];

      if (hasFilters) {
        // Utiliser la route filtrée
        tournamentsData = await tournamentService.getFilteredTournaments(
          status,
          gameAcronym,
          activeFilters
        );
      } else {
        // Utiliser les routes existantes
        if (gameAcronym) {
          switch (status) {
            case 'running':
              tournamentsData = await tournamentService.getRunningTournaments(gameAcronym);
              break;
            case 'upcoming':
              tournamentsData = await tournamentService.getUpcomingTournaments(gameAcronym);
              break;
            case 'finished':
              tournamentsData = await tournamentService.getFinishedTournaments(gameAcronym);
              break;
            default:
              tournamentsData = await tournamentService.getRunningTournaments(gameAcronym);
          }
        } else {
          switch (status) {
            case 'running':
              tournamentsData = await tournamentService.getAllRunningTournaments();
              break;
            case 'upcoming':
              tournamentsData = await tournamentService.getAllUpcomingTournaments();
              break;
            case 'finished':
              tournamentsData = await tournamentService.getAllFinishedTournaments();
              break;
            default:
              tournamentsData = await tournamentService.getAllRunningTournaments();
          }
        }
      }

      setTournaments(tournamentsData);
    } catch (err) {
      console.error('Error loading tournaments:', err);
      setError(t('pages_detail.tournaments.error_loading'));
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

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

  // Recharger quand le jeu, le statut ou les filtres changent
  useEffect(() => {
    const gameAcronym = selectedGameData?.acronym;
    loadTournaments(selectedStatus, gameAcronym, filters);
  }, [selectedStatus, selectedGameData?.acronym, filters, loadTournaments]);

  // Charger les publicités au démarrage
  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // Mémoriser les options de statut avec les counts
  const statusOptions = useMemo(() => [
    { value: 'running' as const, label: t('pages_detail.tournaments.status_running'), count: memoizedTournaments.length },
    { value: 'upcoming' as const, label: t('pages_detail.tournaments.status_upcoming'), count: 0 },
    { value: 'finished' as const, label: t('pages_detail.tournaments.status_finished'), count: 0 }
  ], [memoizedTournaments.length, t]);

  // Mémoriser la fonction getStatusLabel
  const getStatusLabel = useCallback((status: TournamentStatus) => {
    switch (status) {
      case 'running': return t('pages_detail.tournaments.status_label_running');
      case 'upcoming': return t('pages_detail.tournaments.status_label_upcoming');
      case 'finished': return t('pages_detail.tournaments.status_label_finished');
      default: return t('pages_detail.tournaments.status_label_running');
    }
  }, [t]);

  // Mémoriser les handlers
  const handleRefresh = useCallback(() => {
    loadTournaments(selectedStatus, selectedGameData?.acronym, filters);
  }, [loadTournaments, selectedStatus, selectedGameData?.acronym, filters]);

  const handleStatusChange = useCallback((newStatus: TournamentStatus) => {
    setSelectedStatus(newStatus);
  }, []);

  const handleFiltersChange = useCallback((newFilters: TournamentFiltersType) => {
    setFilters(newFilters);
  }, []);

  // Mémoriser les propriétés de rendu pour éviter les re-créations

  const emptyStateMessage = useMemo(() => {
    const statusLabel = getStatusLabel(selectedStatus);
    return selectedGameData
      ? `${t('pages_detail.tournaments.empty_message')} ${statusLabel} ${t('pages_detail.tournaments.empty_message_game')} ${selectedGameData.name}`
      : `${t('pages_detail.tournaments.empty_message')} ${statusLabel} ${t('pages_detail.tournaments.empty_message_all_games')}`;
  }, [getStatusLabel, selectedStatus, selectedGameData, t]);

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
              {/* Header avec menu de statut et bouton actualiser */}
              <div className="mb-6 pt-4">
                <div className="flex items-center justify-between">
                  {/* Menu de sélection du statut */}
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleStatusChange(option.value)}
                        className={`
                          px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center
                          ${selectedStatus === option.value
                            ? 'bg-accent text-text-inverse shadow-lg shadow-accent/25'
                            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary border border-border-primary'
                          }
                        `}
                      >
                        {option.label}
                        {selectedStatus === option.value && memoizedTournaments.length > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-white/20 text-xs rounded-full">
                            {memoizedTournaments.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

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

            {/* Filtres des tournois */}
            <TournamentFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              className="mb-8"
            />

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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tournamentsGrid}
              </div>
            ) : (
              <div className="bg-bg-secondary rounded-lg border border-border-primary p-12 text-center">
                <div className="text-text-secondary mb-4">
                  <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">
                  {t('pages_detail.tournaments.no_tournaments')} {getStatusLabel(selectedStatus)}
                </h3>
                <p className="text-text-secondary mb-4">
                  {emptyStateMessage}
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
    </div>
  );
};

export default TournamentsPage;