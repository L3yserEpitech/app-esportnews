'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { LiveMatch, Advertisement } from '../types';
import { liveMatchService } from '../services/liveMatchService';
import { advertisementService } from '../services/advertisementService';
import { useGame } from '../contexts/GameContext';
import GameSelector from '../components/games/GameSelector';
import LiveMatchCard from '../components/matches/LiveMatchCard';
import AdColumn from '../components/ads/AdColumn';

export default function LivePage() {
  const t = useTranslations();
  const { games, selectedGame, setSelectedGame, isLoadingGames } = useGame();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [filterByGame, setFilterByGame] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'tournament' | 'time' | 'league'>('tournament');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Charger les matchs en direct
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
    // Actualiser toutes les 30 secondes
    const interval = setInterval(loadLiveMatches, 30000);
    return () => clearInterval(interval);
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

  // Filtrer les matchs par jeu
  const filteredMatches = useMemo(() => {
    let filtered = liveMatches;

    if (filterByGame !== 'all') {
      filtered = filtered.filter(match => match.class_name.toLowerCase() === filterByGame.toLowerCase());
    }

    return filtered;
  }, [liveMatches, filterByGame]);

  // Trier les matchs
  const sortedMatches = useMemo(() => {
    const sorted = [...filteredMatches];

    switch (sortBy) {
      case 'tournament':
        return sorted.sort((a, b) => {
          // Prioriser les matchs en cours
          if (a.status_type === 'live' && b.status_type !== 'live') return -1;
          if (b.status_type === 'live' && a.status_type !== 'live') return 1;

          // Si aucun jeu sélectionné, trier d'abord par jeu
          if (filterByGame === 'all') {
            const gameComparison = a.class_name.localeCompare(b.class_name);
            if (gameComparison !== 0) return gameComparison;
          }

          // Puis trier par importance du tournoi
          if (a.tournament_importance !== b.tournament_importance) {
            return b.tournament_importance - a.tournament_importance;
          }

          return a.tournament_name.localeCompare(b.tournament_name);
        });

      case 'time':
        return sorted.sort((a, b) => {
          // Prioriser les matchs en cours
          if (a.status_type === 'live' && b.status_type !== 'live') return -1;
          if (b.status_type === 'live' && a.status_type !== 'live') return 1;

          // Si aucun jeu sélectionné, trier d'abord par jeu
          if (filterByGame === 'all') {
            const gameComparison = a.class_name.localeCompare(b.class_name);
            if (gameComparison !== 0) return gameComparison;
          }

          return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        });

      case 'league':
        return sorted.sort((a, b) => {
          // Prioriser les matchs en cours
          if (a.status_type === 'live' && b.status_type !== 'live') return -1;
          if (b.status_type === 'live' && a.status_type !== 'live') return 1;

          // Si aucun jeu sélectionné, trier d'abord par jeu
          if (filterByGame === 'all') {
            const gameComparison = a.class_name.localeCompare(b.class_name);
            if (gameComparison !== 0) return gameComparison;
          }

          return a.league_name.localeCompare(b.league_name);
        });

      default:
        return sorted;
    }
  }, [filteredMatches, sortBy, filterByGame]);

  // Grouper les matchs par statut et par jeu si nécessaire
  const groupedMatches = useMemo(() => {
    const live = sortedMatches.filter(match => match.status_type === 'live');
    const upcoming = sortedMatches.filter(match => match.status_type === 'scheduled');
    const finished = sortedMatches.filter(match => match.status_type === 'finished');

    // Si "Tous les jeux" est sélectionné, grouper aussi par jeu
    const groupByGame = (matches: typeof sortedMatches) => {
      if (filterByGame === 'all') {
        return matches.reduce((acc, match) => {
          const gameName = match.class_name;
          if (!acc[gameName]) {
            acc[gameName] = [];
          }
          acc[gameName].push(match);
          return acc;
        }, {} as Record<string, typeof matches>);
      }
      return null;
    };

    return {
      live,
      upcoming,
      finished,
      liveByGame: groupByGame(live),
      upcomingByGame: groupByGame(upcoming),
      finishedByGame: groupByGame(finished)
    };
  }, [sortedMatches, filterByGame]);

  const getGameOptions = useMemo(() => {
    const gameSet = new Set(['all']);
    liveMatches.forEach(match => {
      if (match.class_name) {
        gameSet.add(match.class_name.toLowerCase());
      }
    });
    return Array.from(gameSet);
  }, [liveMatches]);

  // Mémorisation des données pour éviter les re-rendus inutiles
  const memoizedAds = useMemo(() => ads, [ads]);

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Contenu principal */}
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="flex gap-8">
          {/* Contenu principal */}
          <div className="flex-1 min-w-0">

            {/* Filtres et Contrôles */}
            <div className="mb-6 mt-2 sticky top-24 z-30">
              <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                {/* Desktop Version - Inchangée */}
                <div className="hidden lg:flex gap-4 items-center justify-between p-4">
                  {/* Filtres Desktop */}
                  <div className="flex gap-4 flex-1">
                    {/* Filtre par jeu */}
                    <div className="relative">
                      <select
                        value={filterByGame}
                        onChange={(e) => setFilterByGame(e.target.value)}
                        className="min-w-[150px] bg-gray-800/80 backdrop-blur-sm border border-gray-600/50 rounded-lg px-3 py-2 text-white text-xs font-medium
                                 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all duration-200
                                 hover:border-gray-500 cursor-pointer appearance-none"
                      >
                        <option value="all">{t('pages_detail.live.tous_les_jeux')}</option>
                        {getGameOptions.filter(game => game !== 'all').map(game => (
                          <option key={game} value={game} className="bg-gray-800">
                            {game.charAt(0).toUpperCase() + game.slice(1)}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Tri */}
                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'tournament' | 'time' | 'league')}
                        className="min-w-[120px] bg-gray-800/80 backdrop-blur-sm border border-gray-600/50 rounded-lg px-3 py-2 text-white text-xs font-medium
                                 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all duration-200
                                 hover:border-gray-500 cursor-pointer appearance-none"
                      >
                        <option value="tournament" className="bg-gray-800">{t('pages_detail.live.tournoi')}</option>
                        <option value="time" className="bg-gray-800">{t('pages_detail.live.heure')}</option>
                        <option value="league" className="bg-gray-800">{t('pages_detail.live.ligue')}</option>
                      </select>
                      <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Statistiques Desktop */}
                  <div className="flex items-center gap-3">
                    {/* Indicateur de statut live */}
                    {groupedMatches.live.length > 0 && (
                      <div className="flex items-center gap-1.5 bg-red-500/10 backdrop-blur-sm rounded-full px-2.5 py-1.5 border border-red-500/20">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></div>
                        <span className="text-[10px] text-red-400 font-medium">
                          {groupedMatches.live.length} live
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Version - Accordion */}
                <div className="lg:hidden">
                  {/* Header mobile - Toujours visible */}
                  <button
                    onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      <span className="text-white text-sm font-medium">{t('pages_detail.live.filter_label')}</span>
                      {/* Indicateurs actifs */}
                      <div className="flex items-center gap-1">
                        {filterByGame !== 'all' && (
                          <div className="bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full text-[10px] font-medium">
                            {filterByGame}
                          </div>
                        )}
                        {groupedMatches.live.length > 0 && (
                          <div className="flex items-center gap-1 bg-red-500/10 rounded-full px-1.5 py-0.5">
                            <div className="w-1 h-1 bg-red-400 rounded-full animate-pulse"></div>
                            <span className="text-[10px] text-red-400 font-medium">
                              {groupedMatches.live.length}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{sortedMatches.length} matchs</span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transform transition-transform duration-200 ${isFiltersExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Contenu des filtres - Expandable */}
                  <div className={`overflow-hidden transition-all duration-300 ease-out ${isFiltersExpanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-4 pb-4 border-t border-gray-700/50">
                      <div className="flex flex-col gap-3 pt-3">
                        {/* Filtre par jeu mobile */}
                        <div className="relative">
                          <label className="block text-xs text-gray-400 mb-2 font-medium">{t('pages_detail.live.game_label')}</label>
                          <select
                            value={filterByGame}
                            onChange={(e) => setFilterByGame(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-sm
                                     focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all
                                     appearance-none"
                          >
                            <option value="all">{t('pages_detail.live.tous_les_jeux')}</option>
                            {getGameOptions.filter(game => game !== 'all').map(game => (
                              <option key={game} value={game} className="bg-gray-800">
                                {game.charAt(0).toUpperCase() + game.slice(1)}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-9 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Tri mobile */}
                        <div className="relative">
                          <label className="block text-xs text-gray-400 mb-2 font-medium">{t('pages_detail.live.sort_label')}</label>
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'tournament' | 'time' | 'league')}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-sm
                                     focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all
                                     appearance-none"
                          >
                            <option value="tournament" className="bg-gray-800">{t('pages_detail.live.tournoi')}</option>
                            <option value="time" className="bg-gray-800">{t('pages_detail.live.heure')}</option>
                            <option value="league" className="bg-gray-800">{t('pages_detail.live.ligue')}</option>
                          </select>
                          <div className="absolute right-3 top-9 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {isLoadingMatches && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mb-4"></div>
                <p className="text-gray-400">{t('pages_detail.live.chargement_matchs')}</p>
              </div>
            )}

            {/* No Matches State */}
            {!isLoadingMatches && sortedMatches.length === 0 && (
              <div className="text-center py-12 bg-gray-900 rounded-xl">
                <div className="text-6xl mb-4">🎮</div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  {t('pages_detail.live.aucun_match_trouve')}
                </h2>
                <p className="text-gray-400 max-w-md mx-auto">
                  {t('pages_detail.live.aucun_match_moment')}
                </p>
              </div>
            )}

            {/* Matchs en Direct */}
            {!isLoadingMatches && groupedMatches.live.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <h2 className="text-2xl font-bold text-white">{t('pages_detail.live.en_direct')}</h2>
                    <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-medium">
                      {groupedMatches.live.length}
                    </span>
                  </div>
                </div>

                {/* Si "Tous les jeux" est sélectionné, afficher par sections de jeux */}
                {filterByGame === 'all' && groupedMatches.liveByGame ? (
                  <div className="space-y-8">
                    {Object.entries(groupedMatches.liveByGame).map(([gameName, matches]) => (
                      <div key={gameName} className="space-y-4">
                        {/* Titre du jeu */}
                        <div className="relative">
                          <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/40 rounded-xl border border-gray-700/50 overflow-hidden">
                            <div className="px-6 py-4 flex items-center gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                <h3 className="text-lg font-bold text-white capitalize">
                                  {gameName} {t('pages_detail.live.game_matches')}
                                </h3>
                                <span className="bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full text-xs font-medium">
                                  {matches.length}
                                </span>
                              </div>
                              <div className="flex-1 h-px bg-gradient-to-r from-gray-600/50 to-transparent"></div>
                            </div>
                          </div>
                        </div>

                        {/* Matchs du jeu */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {matches.map((match) => (
                            <LiveMatchCard key={match.id} match={match} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Affichage normal quand un jeu spécifique est sélectionné */
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {groupedMatches.live.map((match) => (
                      <LiveMatchCard key={match.id} match={match} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Matchs à Venir */}
            {!isLoadingMatches && groupedMatches.upcoming.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <h2 className="text-2xl font-bold text-white">{t('pages_detail.live.a_venir')}</h2>
                    <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-medium">
                      {groupedMatches.upcoming.length}
                    </span>
                  </div>
                </div>

                {/* Si "Tous les jeux" est sélectionné, afficher par sections de jeux */}
                {filterByGame === 'all' && groupedMatches.upcomingByGame ? (
                  <div className="space-y-8">
                    {Object.entries(groupedMatches.upcomingByGame).map(([gameName, matches]) => (
                      <div key={gameName} className="space-y-4">
                        {/* Titre du jeu */}
                        <div className="relative">
                          <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/40 rounded-xl border border-gray-700/50 overflow-hidden">
                            <div className="px-6 py-4 flex items-center gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <h3 className="text-lg font-bold text-white capitalize">
                                  {gameName} {t('pages_detail.live.game_matches')}
                                </h3>
                                <span className="bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full text-xs font-medium">
                                  {matches.length}
                                </span>
                              </div>
                              <div className="flex-1 h-px bg-gradient-to-r from-gray-600/50 to-transparent"></div>
                            </div>
                          </div>
                        </div>

                        {/* Matchs du jeu */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {matches.map((match) => (
                            <LiveMatchCard key={match.id} match={match} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Affichage normal quand un jeu spécifique est sélectionné */
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {groupedMatches.upcoming.map((match) => (
                      <LiveMatchCard key={match.id} match={match} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Matchs Terminés */}
            {!isLoadingMatches && groupedMatches.finished.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                    <h2 className="text-2xl font-bold text-white">{t('pages_detail.live.termines')}</h2>
                    <span className="bg-gray-500/20 text-gray-400 px-3 py-1 rounded-full text-sm font-medium">
                      {groupedMatches.finished.length}
                    </span>
                  </div>
                </div>

                {/* Si "Tous les jeux" est sélectionné, afficher par sections de jeux */}
                {filterByGame === 'all' && groupedMatches.finishedByGame ? (
                  <div className="space-y-8">
                    {Object.entries(groupedMatches.finishedByGame).map(([gameName, matches]) => {
                      const limitedMatches = matches.slice(0, 12);
                      const remainingCount = matches.length - 12;

                      return (
                        <div key={gameName} className="space-y-4">
                          {/* Titre du jeu */}
                          <div className="relative">
                            <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/40 rounded-xl border border-gray-700/50 overflow-hidden">
                              <div className="px-6 py-4 flex items-center gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                  <h3 className="text-lg font-bold text-white capitalize">
                                    {gameName} {t('pages_detail.live.game_matches')}
                                  </h3>
                                  <span className="bg-gray-500/20 text-gray-400 px-2.5 py-1 rounded-full text-xs font-medium">
                                    {matches.length}
                                  </span>
                                </div>
                                <div className="flex-1 h-px bg-gradient-to-r from-gray-600/50 to-transparent"></div>
                              </div>
                            </div>
                          </div>

                          {/* Matchs du jeu */}
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {limitedMatches.map((match) => (
                              <LiveMatchCard key={match.id} match={match} />
                            ))}
                          </div>

                          {/* Indicateur de matchs restants */}
                          {remainingCount > 0 && (
                            <div className="text-center">
                              <p className="text-gray-400 text-sm">
                                {remainingCount} {t('pages_detail.live.other_finished')}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Affichage normal quand un jeu spécifique est sélectionné */
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {groupedMatches.finished.slice(0, 12).map((match) => (
                        <LiveMatchCard key={match.id} match={match} />
                      ))}
                    </div>

                    {groupedMatches.finished.length > 12 && (
                      <div className="text-center mt-8">
                        <p className="text-gray-400">
                          {groupedMatches.finished.length - 12} {t('pages_detail.live.other_finished')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

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