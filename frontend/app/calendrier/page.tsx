'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGame } from '../contexts/GameContext';
import Calendar from '../components/calendar/Calendar';
import TournamentCard from '../components/tournaments/TournamentCard';
import MatchCard from '../components/calendar/MatchCard';
import GameSelector from '../components/games/GameSelector';
import AdColumn from '../components/ads/AdColumn';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { PandaTournament, Advertisement, PandaMatch } from '../types';
import { tournamentService } from '../services/tournamentService';
import { advertisementService } from '../services/advertisementService';

type ViewMode = 'tournaments' | 'matches';

export default function CalendrierPage() {
  const { games, selectedGame, setSelectedGame, isLoadingGames, getSelectedGameData } = useGame();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('tournaments');
  const [tournaments, setTournaments] = useState<PandaTournament[]>([]);
  const [matches, setMatches] = useState<PandaMatch[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);

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

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // Mémoriser les données du jeu sélectionné
  const selectedGameData = useMemo(() => getSelectedGameData(), [getSelectedGameData]);

  // Charger les données pour la date sélectionnée
  const loadData = useCallback(async (date: Date, gameAcronym?: string, mode: ViewMode = 'tournaments') => {
    try {
      setIsLoadingData(true);

      // Formater la date au format YYYY-MM-DD en conservant le fuseau horaire local
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      if (mode === 'tournaments') {
        const fetchedTournaments = await tournamentService.getTournamentsByDate(
          dateString,
          gameAcronym
        );
        setTournaments(fetchedTournaments);
        setMatches([]); // Reset matches when switching to tournaments
      } else {
        const fetchedMatches = await tournamentService.getMatchesByDate(
          dateString,
          gameAcronym
        );
        setMatches(fetchedMatches);
        setTournaments([]); // Reset tournaments when switching to matches
      }
    } catch (error) {
      console.error(`Erreur lors du chargement des ${mode}:`, error);
      if (mode === 'tournaments') {
        setTournaments([]);
      } else {
        setMatches([]);
      }
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  // Charger les données quand la date, le jeu ou le mode change
  useEffect(() => {
    const gameAcronym = selectedGameData?.acronym;
    loadData(selectedDate, gameAcronym, viewMode);
  }, [selectedDate, selectedGameData?.acronym, viewMode, loadData]);

  // Gérer la sélection de date
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  // Gérer le clic sur un match
  const handleMatchClick = useCallback((match: PandaMatch) => {
    console.log('Match sélectionné:', match);
    // TODO: Navigation vers la page détail du match
  }, []);

  // Gérer le changement de mode d'affichage
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  const formatSelectedDate = useMemo(() => {
    return selectedDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [selectedDate]);

  const selectedGameName = useMemo(() => {
    return selectedGameData ? selectedGameData.name : 'TOUS LES JEUX';
  }, [selectedGameData]);

  const currentData = useMemo(() => {
    return viewMode === 'tournaments' ? tournaments : matches;
  }, [viewMode, tournaments, matches]);

  const currentDataLabel = useMemo(() => {
    return viewMode === 'tournaments' ? 'tournoi' : 'match';
  }, [viewMode]);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Sélecteur de jeux tout en haut - masqué sur mobile */}
      <div className="pt-20 hidden md:block">
        <GameSelector
          games={games}
          selectedGame={selectedGame}
          onSelectionChange={setSelectedGame}
          isLoading={isLoadingGames}
        />
      </div>

      <main className="container mx-auto px-4 py-8 pt-24 md:pt-0">
        <div className="flex gap-8">
          {/* Contenu principal */}
          <div className="flex-1 min-w-0">
            {/* En-tête principal */}
            <div className="mb-8">
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Calendrier */}
              <div className="lg:col-span-1">
                <Calendar
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  className="sticky top-24"
                />
              </div>

              {/* Tournois et matchs */}
              <div className="lg:col-span-2 space-y-6">
                {/* Header avec date sélectionnée */}
                <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden mb-6">
                  <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/40 px-6 py-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {/* Icône de calendrier */}
                        <div className="p-2 bg-gradient-to-br from-pink-500/20 to-pink-600/10 rounded-lg border border-pink-500/30">
                          <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">
                            {formatSelectedDate}
                          </h2>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-gray-400 text-sm">{selectedGameName}</span>
                            <span className="text-gray-600">•</span>
                            <span className="bg-gray-700/50 text-gray-300 px-2.5 py-1 rounded-full text-xs font-medium">
                              {currentData.length} {currentDataLabel}{currentData.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toggle séparé avec sticky */}
                <div className="sticky top-24 z-20 mb-6">
                  <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden shadow-xl">
                    <div className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-gradient-to-br from-pink-500/20 to-pink-600/10 rounded-lg border border-pink-500/30">
                            <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                          </div>
                          <span className="text-sm font-medium text-gray-300">Type d'affichage</span>
                        </div>

                        {/* Toggle responsive */}
                        <div className="flex bg-gray-800/60 backdrop-blur-sm rounded-xl p-1 border border-gray-600/30">
                          <button
                            onClick={() => handleViewModeChange('tournaments')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                              viewMode === 'tournaments'
                                ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg shadow-pink-500/25'
                                : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                            }`}
                          >
                            <span className="text-base">🏆</span>
                            <span className="hidden sm:inline">Tournois</span>
                          </button>
                          <button
                            onClick={() => handleViewModeChange('matches')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                              viewMode === 'matches'
                                ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg shadow-pink-500/25'
                                : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                            }`}
                          >
                            <span className="text-base">⚔️</span>
                            <span className="hidden sm:inline">Matchs</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contenu conditionnel */}
                {isLoadingData ? (
                  <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-12">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mb-4"></div>
                      <p className="text-gray-400 text-sm">Chargement des {currentDataLabel}s...</p>
                    </div>
                  </div>
                ) : currentData.length === 0 ? (
                  <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-12">
                    <div className="text-center">
                      <div className="relative mb-6">
                        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-700/30 to-gray-800/30 rounded-full flex items-center justify-center border border-gray-600/30">
                          <span className="text-4xl">
                            {viewMode === 'tournaments' ? '🏆' : '⚔️'}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3">
                        Aucun {currentDataLabel} ce jour
                      </h3>
                      <p className="text-gray-400 max-w-md mx-auto">
                        Aucun {currentDataLabel} prévu pour <span className="text-pink-400 font-medium">{formatSelectedDate}</span> en {selectedGameName}
                      </p>
                    </div>
                  </div>
                ) : viewMode === 'tournaments' ? (
                  // Affichage des tournois seulement
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {tournaments.map((tournament) => (
                      <TournamentCard
                        key={tournament.id}
                        tournament={tournament}
                        showGameBadge={!selectedGameData}
                      />
                    ))}
                  </div>
                ) : (
                  // Affichage des matchs uniquement
                  <div className="space-y-6">
                    {matches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        onClick={handleMatchClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Colonne publicitaire */}
          <AdColumn
            ads={ads}
            isSubscribed={isSubscribed}
            isLoading={isLoadingAds}
          />
        </div>
      </main>
    </div>
  );
}