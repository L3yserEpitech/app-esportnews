'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useGame } from '../../contexts/GameContext';
import { tournamentService } from '../../services/tournamentService';
import { PandaTournament } from '../../types';
import TournamentCard from './TournamentCard';

const RunningTournaments: React.FC = () => {
  const { selectedGame, getSelectedGameData } = useGame();
  const [tournaments, setTournaments] = useState<PandaTournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedGameData = getSelectedGameData();

  // Mémorisation pour éviter les recalculs - 3 tournois par colonne x 2 colonnes = 6 max
  const displayedTournaments = useMemo(() => tournaments.slice(0, 6), [tournaments]);
  const hasMoreTournaments = useMemo(() => tournaments.length > 6, [tournaments.length]);
  const memoizedTournaments = useMemo(() => tournaments, [tournaments]);

  // Fonction pour charger les tournois (d'un jeu spécifique)
  const loadTournaments = useCallback(async (gameAcronym: string) => {
    if (!gameAcronym) return;

    setLoading(true);
    setError(null);

    try {
      const tournamentsData = await tournamentService.getRunningTournaments(gameAcronym);
      setTournaments(tournamentsData);
    } catch (err) {
      console.error('Error loading tournaments:', err);
      setError('Erreur lors du chargement des tournois');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fonction pour charger tous les tournois (tous jeux confondus)
  const loadAllTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const tournamentsData = await tournamentService.getAllRunningTournaments();
      setTournaments(tournamentsData);
    } catch (err) {
      console.error('Error loading all tournaments:', err);
      setError('Erreur lors du chargement des tournois');
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les tournois quand le jeu sélectionné change
  useEffect(() => {
    if (selectedGameData?.acronym) {
      loadTournaments(selectedGameData.acronym);
    } else {
      loadAllTournaments();
    }
  }, [selectedGameData?.acronym, loadTournaments, loadAllTournaments]);


  return (
    <section>
      {/* Header responsive */}
      <div className="mb-6">
        {/* Desktop layout */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center">
            <h2 className="text-2xl font-bold text-white mr-4">
              Tournois en cours
            </h2>
            {selectedGameData ? (
              <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
                <img
                  src={selectedGameData.selected_image?.url}
                  alt={selectedGameData.name}
                  className="w-6 h-6 mr-2"
                />
                <span className="text-pink-400 font-medium text-sm">
                  {selectedGameData.name}
                </span>
              </div>
            ) : (
              <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
                <span className="text-blue-400 font-medium text-sm">
                  Tous les jeux
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => selectedGameData?.acronym ? loadTournaments(selectedGameData.acronym) : loadAllTournaments()}
            disabled={loading}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center"
          >
            <svg
              className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Chargement...' : 'Actualiser'}
          </button>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            Tournois en cours
          </h2>

          <div className="flex items-center space-x-2">
            {/* Game info */}
            {selectedGameData ? (
              <div className="flex items-center bg-gray-800 rounded-lg px-2 py-1 border border-gray-700 text-sm">
                <img
                  src={selectedGameData.selected_image?.url}
                  alt={selectedGameData.name}
                  className="w-4 h-4 mr-1"
                />
                <span className="text-pink-400 font-medium">
                  ({selectedGameData.name})
                </span>
              </div>
            ) : (
              <div className="flex items-center bg-gray-800 rounded-lg px-2 py-1 border border-gray-700 text-sm">
                <span className="text-blue-400 font-medium">
                  (Tous les jeux)
                </span>
              </div>
            )}

            {/* Refresh button - Icon only */}
            <button
              onClick={() => selectedGameData?.acronym ? loadTournaments(selectedGameData.acronym) : loadAllTournaments()}
              disabled={loading}
              className="p-2 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center"
              aria-label={loading ? 'Chargement...' : 'Actualiser'}
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
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        // Skeleton loading
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden animate-pulse">
              <div className="h-48 bg-gray-700" />
              <div className="p-4">
                <div className="h-4 bg-gray-700 rounded mb-2" />
                <div className="h-3 bg-gray-700 rounded mb-2 w-3/4" />
                <div className="h-3 bg-gray-700 rounded mb-3 w-1/2" />
                <div className="flex justify-between">
                  <div className="h-3 bg-gray-700 rounded w-1/4" />
                  <div className="h-3 bg-gray-700 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : memoizedTournaments.length > 0 ? (
        <div>
          {/* Grille des tournois */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedTournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                showGameBadge={!selectedGameData} // Afficher le badge du jeu seulement quand tous les jeux sont affichés
              />
            ))}
          </div>

          {/* Bouton "Voir tout" - Redirige vers /tournament */}
          {memoizedTournaments.length > 0 && (
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => window.location.href = '/tournament'}
                className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors text-sm font-medium"
              >
                <span>Afficher tous</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

        </div>
      ) : (
        // État vide
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-300 text-lg mb-2">
            Aucun tournoi en cours
          </p>
          <p className="text-gray-400">
            {selectedGameData
              ? `Il n'y a actuellement aucun tournoi en cours pour ${selectedGameData.name}`
              : "Il n'y a actuellement aucun tournoi en cours pour tous les jeux"
            }
          </p>
        </div>
      )}
    </section>
  );
};

export default RunningTournaments;