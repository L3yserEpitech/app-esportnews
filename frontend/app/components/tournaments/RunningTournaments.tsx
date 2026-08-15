'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useGame } from '../../contexts/GameContext';
import { tournamentService } from '../../services/tournamentService';
import { PandaTournament } from '../../types';
import TournamentCard from './TournamentCard';
import ContentLoader from '../ui/ContentLoader';
import { Trophy } from 'lucide-react';

const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TIER_ORDER: Record<string, number> = { s: 0, a: 1, b: 2, c: 3, d: 4 };

const sortByTier = (list: PandaTournament[]): PandaTournament[] =>
  [...list].sort((a, b) => {
    const ta = TIER_ORDER[a.tier?.toLowerCase() || ''] ?? 9;
    const tb = TIER_ORDER[b.tier?.toLowerCase() || ''] ?? 9;
    if (ta !== tb) return ta - tb;
    return new Date(a.begin_at || 0).getTime() - new Date(b.begin_at || 0).getTime();
  });

const RunningTournaments: React.FC = () => {
  const t = useTranslations();
  const { selectedGame, getSelectedGameData } = useGame();
  const [tournaments, setTournaments] = useState<PandaTournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedGameData = getSelectedGameData();

  // Mémorisation pour éviter les recalculs - 6 max, 1 par ligne
  const displayedTournaments = useMemo(() => tournaments.slice(0, 6), [tournaments]);
  const hasMoreTournaments = useMemo(() => tournaments.length > 6, [tournaments.length]);
  const memoizedTournaments = useMemo(() => tournaments, [tournaments]);

  // Tournois actifs à la date du jour (by-date, on-demand) — même source que
  // la page /tournois en mode calendrier, donc cache Redis partagé.
  const loadTournaments = useCallback(async (gameAcronym?: string) => {
    setLoading(true);
    setError(null);

    try {
      const today = formatDateToYYYYMMDD(new Date());
      const tournamentsData = await tournamentService.getTournamentsByDate(today, gameAcronym);
      setTournaments(sortByTier(Array.isArray(tournamentsData) ? tournamentsData : []));
    } catch (err) {
      console.error('Error loading tournaments:', err);
      setError('Erreur lors du chargement des tournois');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllTournaments = useCallback(() => loadTournaments(undefined), [loadTournaments]);

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
            <h2 className="text-2xl font-bold text-text-primary mr-4">
              {t('pages.home.tournaments.title')}
            </h2>
            {selectedGameData ? (
              <div className="flex items-center bg-bg-secondary rounded-lg px-3 py-2 border border-border-secondary">
                <img
                  src={selectedGameData.selected_image}
                  alt={selectedGameData.name}
                  className="w-6 h-6 mr-2"
                />
                <span className="text-accent font-medium text-sm">
                  {selectedGameData.name}
                </span>
              </div>
            ) : (
              <div className="flex items-center bg-bg-secondary rounded-lg px-3 py-2 border border-border-secondary">
                <span className="text-accent font-medium text-sm">
                  {t('pages.home.tournaments.all_games')}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => selectedGameData?.acronym ? loadTournaments(selectedGameData.acronym) : loadAllTournaments()}
            disabled={loading}
            className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-bg-tertiary text-text-inverse rounded-lg font-medium text-sm transition-colors flex items-center"
          >
            <svg
              className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? t('pages.home.tournaments.loading_button') : t('pages.home.tournaments.refresh_button')}
          </button>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">
            {t('pages.home.tournaments.title')}
          </h2>

          <div className="flex items-center space-x-2">
            {/* Game info */}
            {selectedGameData ? (
              <div className="flex items-center bg-bg-secondary rounded-lg px-2 py-1 border border-border-secondary text-sm">
                <img
                  src={selectedGameData.selected_image}
                  alt={selectedGameData.name}
                  className="w-4 h-4 mr-1"
                />
                <span className="text-accent font-medium">
                  ({selectedGameData.name})
                </span>
              </div>
            ) : (
              <div className="flex items-center bg-bg-secondary rounded-lg px-2 py-1 border border-border-secondary text-sm">
                <span className="text-accent font-medium">
                  {t('pages.home.tournaments.all_games_mobile')}
                </span>
              </div>
            )}

            {/* Refresh button - Icon only */}
            <button
              onClick={() => selectedGameData?.acronym ? loadTournaments(selectedGameData.acronym) : loadAllTournaments()}
              disabled={loading}
              className="p-2 bg-accent hover:bg-accent-hover disabled:bg-bg-tertiary text-text-inverse rounded-lg transition-colors flex items-center justify-center"
              aria-label={loading ? t('pages.home.tournaments.refresh_aria_label') : t('pages.home.tournaments.refresh_aria_label_idle')}
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
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <ContentLoader label={t('pages_detail.calendar.loading_tournaments')} icon={Trophy} />
      ) : memoizedTournaments.length > 0 ? (
        <div>
          {/* Cards horizontales — toujours 1 par ligne */}
          <div className="grid grid-cols-1 gap-3">
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
              <Link
                href="/tournois"
                className="flex items-center cursor-pointer px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary border border-border-secondary text-text-secondary hover:text-text-primary rounded-lg transition-colors text-sm font-medium"
              >
                <span>{t('pages.home.tournaments.view_all_button')}</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}

        </div>
      ) : (
        // État vide
        <div className="bg-bg-secondary rounded-lg border border-border-secondary p-8 text-center">
          <div className="text-text-muted mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-text-secondary text-lg mb-2">
            {t('pages.home.tournaments.no_tournaments')}
          </p>
          <p className="text-text-muted">
            {selectedGameData
              ? `${t('pages.home.tournaments.no_tournaments_game')} ${selectedGameData.name}`
              : t('pages.home.tournaments.no_tournaments_all_games')
            }
          </p>
        </div>
      )}
    </section>
  );
};

export default RunningTournaments;