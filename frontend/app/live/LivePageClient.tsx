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
  const [sortBy, setSortBy] = useState<'tournament' | 'time' | 'league'>('tournament');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Charger les matchs en direct
  const loadLiveMatches = useCallback(async () => {
    // Ne pas charger si les jeux ne sont pas encore chargés
    if (isLoadingGames || games.length === 0) {
      console.log('[LivePage] Games not loaded yet, skipping...');
      return;
    }

    try {
      setIsLoadingMatches(true);
      // Récupérer l'acronym du jeu sélectionné si disponible
      const selectedGameData = selectedGame 
        ? games.find(g => {
            // Comparer en string pour éviter les problèmes de type
            const gameIdStr = String(g.id);
            const selectedGameStr = String(selectedGame);
            return gameIdStr === selectedGameStr;
          })
        : null;
      const gameAcronym = selectedGameData?.acronym;
      console.log('[LivePage] Loading live matches:', { 
        selectedGame, 
        selectedGameData: selectedGameData?.name,
        gameAcronym,
        gamesCount: games.length
      });
      // Utiliser directement l'acronym sans mapping
      const fetchedMatches = await liveMatchService.getLiveMatches(gameAcronym);
      console.log('[LivePage] Fetched matches:', fetchedMatches.length);
      setLiveMatches(fetchedMatches);
    } catch (error) {
      console.error('[LivePage] Erreur lors du chargement des matchs en direct:', error);
    } finally {
      setIsLoadingMatches(false);
    }
  }, [selectedGame, games, isLoadingGames]);

  // Recharger les matchs quand selectedGame change
  useEffect(() => {
    if (!isLoadingGames && games.length > 0) {
      console.log('[LivePage] selectedGame changed, triggering loadLiveMatches - selectedGame:', selectedGame, 'gamesCount:', games.length);
      loadLiveMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGame]); // Se déclencher UNIQUEMENT quand selectedGame change
  
  // Charger les matchs quand les jeux sont chargés pour la première fois
  useEffect(() => {
    if (!isLoadingGames && games.length > 0 && selectedGame === null) {
      console.log('[LivePage] Games loaded for the first time, loading all matches');
      loadLiveMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingGames]); // Se déclencher quand isLoadingGames passe de true à false

  // Actualiser toutes les 30 secondes (avec le bon selectedGame)
  useEffect(() => {
    if (isLoadingGames || games.length === 0) return;
    
    // Charger immédiatement au montage
    loadLiveMatches();
    
    const interval = setInterval(() => {
      loadLiveMatches();
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedGame, games, isLoadingGames, loadLiveMatches]);

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

  // Filtrer les matchs par jeu (déjà fait côté API, mais on garde pour compatibilité avec le filtre local)
  const filteredMatches = useMemo(() => {
    return liveMatches; // Le filtrage est déjà fait côté API via gameAcronym
  }, [liveMatches]);

  // Trier les matchs
  const sortedMatches = useMemo(() => {
    const sorted = [...filteredMatches];

    switch (sortBy) {
      case 'tournament':
        return sorted.sort((a, b) => {
          // Prioriser les matchs en cours (running/live)
          const aIsLive = a.status?.toLowerCase() === 'running' || a.status?.toLowerCase() === 'live';
          const bIsLive = b.status?.toLowerCase() === 'running' || b.status?.toLowerCase() === 'live';
          if (aIsLive && !bIsLive) return -1;
          if (!aIsLive && bIsLive) return 1;

          // Si aucun jeu sélectionné, trier d'abord par jeu
          if (!selectedGame) {
            const aGame = a.videogame?.name || '';
            const bGame = b.videogame?.name || '';
            const gameComparison = aGame.localeCompare(bGame);
            if (gameComparison !== 0) return gameComparison;
          }

          // Puis trier par nom de tournoi
          const aTournament = a.tournament?.name || '';
          const bTournament = b.tournament?.name || '';
          return aTournament.localeCompare(bTournament);
        });

      case 'time':
        return sorted.sort((a, b) => {
          // Prioriser les matchs en cours
          const aIsLive = a.status?.toLowerCase() === 'running' || a.status?.toLowerCase() === 'live';
          const bIsLive = b.status?.toLowerCase() === 'running' || b.status?.toLowerCase() === 'live';
          if (aIsLive && !bIsLive) return -1;
          if (!aIsLive && bIsLive) return 1;

          // Si aucun jeu sélectionné, trier d'abord par jeu
          if (!selectedGame) {
            const aGame = a.videogame?.name || '';
            const bGame = b.videogame?.name || '';
            const gameComparison = aGame.localeCompare(bGame);
            if (gameComparison !== 0) return gameComparison;
          }

          const aTime = a.begin_at || a.scheduled_at || '';
          const bTime = b.begin_at || b.scheduled_at || '';
          return new Date(aTime).getTime() - new Date(bTime).getTime();
        });

      case 'league':
        return sorted.sort((a, b) => {
          // Prioriser les matchs en cours
          const aIsLive = a.status?.toLowerCase() === 'running' || a.status?.toLowerCase() === 'live';
          const bIsLive = b.status?.toLowerCase() === 'running' || b.status?.toLowerCase() === 'live';
          if (aIsLive && !bIsLive) return -1;
          if (!aIsLive && bIsLive) return 1;

          // Si aucun jeu sélectionné, trier d'abord par jeu
          if (!selectedGame) {
            const aGame = a.videogame?.name || '';
            const bGame = b.videogame?.name || '';
            const gameComparison = aGame.localeCompare(bGame);
            if (gameComparison !== 0) return gameComparison;
          }

          const aLeague = a.league?.name || '';
          const bLeague = b.league?.name || '';
          return aLeague.localeCompare(bLeague);
        });

      default:
        return sorted;
    }
  }, [filteredMatches, sortBy, selectedGame]);

  // Grouper les matchs par statut et par jeu si nécessaire
  const groupedMatches = useMemo(() => {
    const live = sortedMatches.filter(match => {
      const status = match.status?.toLowerCase();
      return status === 'running' || status === 'live';
    });
    const upcoming = sortedMatches.filter(match => {
      const status = match.status?.toLowerCase();
      return status === 'not_started' || status === 'not_played' || (!status && match.scheduled_at);
    });
    const finished = sortedMatches.filter(match => {
      const status = match.status?.toLowerCase();
      return status === 'finished' || status === 'canceled';
    });

    // Si aucun jeu n'est sélectionné, grouper aussi par jeu
    const groupByGame = (matches: typeof sortedMatches) => {
      if (!selectedGame) {
        return matches.reduce((acc, match) => {
          const gameName = match.videogame?.name || 'Autre';
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
  }, [sortedMatches, selectedGame]);

  // Mémorisation des données pour éviter les re-rendus inutiles
  const memoizedAds = useMemo(() => ads, [ads]);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Banderole de sélection des jeux - Desktop uniquement */}
      <GameSelector
        games={games}
        selectedGame={selectedGame}
        onSelectionChange={setSelectedGame}
        isLoading={isLoadingGames}
        className="hidden md:block fixed top-20 left-0 right-0 z-40"
      />

      {/* Contenu principal */}
      <main className="container mx-auto px-4 py-8 pt-24 md:pt-27">
        <div className="flex gap-8">
          {/* Contenu principal */}
          <div className="flex-1 min-w-0">

            {/* Filtres et Contrôles */}
            <div className="mb-6 mt-2 sticky top-24 z-30">
              <div className="bg-bg-secondary rounded-xl border border-border-primary overflow-hidden">
                {/* Desktop Version - Inchangée */}
                <div className="hidden lg:flex gap-4 items-center justify-between p-4">
                  {/* Filtres Desktop */}
                  <div className="flex gap-4 flex-1">
                    {/* Tri */}
                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'tournament' | 'time' | 'league')}
                        className="min-w-[120px] bg-bg-secondary/80 backdrop-blur-sm border border-border-primary/50 rounded-lg px-3 py-2 text-text-primary text-xs font-medium
                                 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all duration-200
                                 hover:border-border-muted cursor-pointer appearance-none"
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
                      <div className="flex items-center gap-1.5 bg-status-live/10 backdrop-blur-sm rounded-full px-2.5 py-1.5 border border-status-live/20">
                        <div className="w-1.5 h-1.5 bg-status-live rounded-full animate-pulse"></div>
                        <span className="text-[10px] text-status-live font-medium">
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
                    className="w-full flex items-center justify-between p-4 hover:bg-bg-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      <span className="text-text-primary text-sm font-medium">{t('pages_detail.live.filter_label')}</span>
                      {/* Indicateurs actifs */}
                      <div className="flex items-center gap-1">
                        {selectedGame && (
                          <div className="bg-accent/20 text-accent px-2 py-0.5 rounded-full text-[10px] font-medium">
                            {games.find(g => g.id.toString() === selectedGame)?.name || 'Jeu'}
                          </div>
                        )}
                        {groupedMatches.live.length > 0 && (
                          <div className="flex items-center gap-1 bg-status-live/10 rounded-full px-1.5 py-0.5">
                            <div className="w-1 h-1 bg-status-live rounded-full animate-pulse"></div>
                            <span className="text-[10px] text-status-live font-medium">
                              {groupedMatches.live.length}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary">{sortedMatches.length} matchs</span>
                      <svg
                        className={`w-4 h-4 text-text-secondary transform transition-transform duration-200 ${isFiltersExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Contenu des filtres - Expandable */}
                  <div className={`overflow-hidden transition-all duration-300 ease-out ${isFiltersExpanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-4 pb-4 border-t border-border-primary/50">
                      <div className="flex flex-col gap-3 pt-3">
                        {/* Tri mobile */}
                        <div className="relative">
                          <label className="block text-xs text-text-secondary mb-2 font-medium">{t('pages_detail.live.sort_label')}</label>
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'tournament' | 'time' | 'league')}
                            className="w-full bg-bg-secondary border border-border-primary rounded-lg px-4 py-3 text-text-primary text-sm
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
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent mb-4"></div>
                <p className="text-text-secondary">{t('pages_detail.live.chargement_matchs')}</p>
              </div>
            )}

            {/* No Matches State */}
            {!isLoadingMatches && sortedMatches.length === 0 && (
              <div className="text-center py-12 bg-bg-secondary rounded-xl">
                <div className="text-6xl mb-4">🎮</div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">
                  {t('pages_detail.live.aucun_match_trouve')}
                </h2>
                <p className="text-text-secondary max-w-md mx-auto">
                  {t('pages_detail.live.aucun_match_moment')}
                </p>
              </div>
            )}

            {/* Matchs en Direct */}
            {!isLoadingMatches && groupedMatches.live.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-status-live rounded-full animate-pulse"></div>
                    <h2 className="text-2xl font-bold text-text-primary">{t('pages_detail.live.en_direct')}</h2>
                    <span className="bg-status-live/20 text-status-live px-3 py-1 rounded-full text-sm font-medium">
                      {groupedMatches.live.length}
                    </span>
                  </div>
                </div>

                {/* Si aucun jeu n'est sélectionné, afficher par sections de jeux */}
                {!selectedGame && groupedMatches.liveByGame ? (
                  <div className="space-y-8">
                    {Object.entries(groupedMatches.liveByGame).map(([gameName, matches]) => (
                      <div key={gameName} className="space-y-4">
                        {/* Titre du jeu */}
                        <div className="relative">
                          <div className="bg-gradient-to-r from-bg-tertiary/80 to-bg-secondary/40 rounded-xl border border-border-primary/50 overflow-hidden">
                            <div className="px-6 py-4 flex items-center gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-status-live rounded-full animate-pulse"></div>
                                <h3 className="text-lg font-bold text-text-primary capitalize">
                                  {gameName} {t('pages_detail.live.game_matches')}
                                </h3>
                                <span className="bg-status-live/20 text-status-live px-2.5 py-1 rounded-full text-xs font-medium">
                                  {matches.length}
                                </span>
                              </div>
                              <div className="flex-1 h-px bg-gradient-to-r from-border-muted/50 to-transparent"></div>
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
                    <div className="w-3 h-3 bg-status-upcoming rounded-full"></div>
                    <h2 className="text-2xl font-bold text-text-primary">{t('pages_detail.live.a_venir')}</h2>
                    <span className="bg-status-upcoming/20 text-status-upcoming px-3 py-1 rounded-full text-sm font-medium">
                      {groupedMatches.upcoming.length}
                    </span>
                  </div>
                </div>

                {/* Si "Tous les jeux" est sélectionné, afficher par sections de jeux */}
                {!selectedGame && groupedMatches.upcomingByGame ? (
                  <div className="space-y-8">
                    {Object.entries(groupedMatches.upcomingByGame).map(([gameName, matches]) => (
                      <div key={gameName} className="space-y-4">
                        {/* Titre du jeu */}
                        <div className="relative">
                          <div className="bg-gradient-to-r from-bg-tertiary/80 to-bg-secondary/40 rounded-xl border border-border-primary/50 overflow-hidden">
                            <div className="px-6 py-4 flex items-center gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-status-upcoming rounded-full"></div>
                                <h3 className="text-lg font-bold text-text-primary capitalize">
                                  {gameName} {t('pages_detail.live.game_matches')}
                                </h3>
                                <span className="bg-status-upcoming/20 text-status-upcoming px-2.5 py-1 rounded-full text-xs font-medium">
                                  {matches.length}
                                </span>
                              </div>
                              <div className="flex-1 h-px bg-gradient-to-r from-border-muted/50 to-transparent"></div>
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
                    <div className="w-3 h-3 bg-status-finished rounded-full"></div>
                    <h2 className="text-2xl font-bold text-text-primary">{t('pages_detail.live.termines')}</h2>
                    <span className="bg-status-finished/20 text-status-finished px-3 py-1 rounded-full text-sm font-medium">
                      {groupedMatches.finished.length}
                    </span>
                  </div>
                </div>

                {/* Si "Tous les jeux" est sélectionné, afficher par sections de jeux */}
                {!selectedGame && groupedMatches.finishedByGame ? (
                  <div className="space-y-8">
                    {Object.entries(groupedMatches.finishedByGame).map(([gameName, matches]) => {
                      const limitedMatches = matches.slice(0, 12);
                      const remainingCount = matches.length - 12;

                      return (
                        <div key={gameName} className="space-y-4">
                          {/* Titre du jeu */}
                          <div className="relative">
                            <div className="bg-gradient-to-r from-bg-tertiary/80 to-bg-secondary/40 rounded-xl border border-border-primary/50 overflow-hidden">
                              <div className="px-6 py-4 flex items-center gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-status-finished rounded-full"></div>
                                  <h3 className="text-lg font-bold text-text-primary capitalize">
                                    {gameName} {t('pages_detail.live.game_matches')}
                                  </h3>
                                  <span className="bg-status-finished/20 text-status-finished px-2.5 py-1 rounded-full text-xs font-medium">
                                    {matches.length}
                                  </span>
                                </div>
                                <div className="flex-1 h-px bg-gradient-to-r from-border-muted/50 to-transparent"></div>
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
                              <p className="text-text-secondary text-sm">
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
                        <p className="text-text-secondary">
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