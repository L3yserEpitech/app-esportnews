import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { tournamentService } from '@/services';
import type { PandaTournament } from '@/types';

type TournamentStatus = 'running' | 'upcoming' | 'finished';

interface UseTournamentsOptions {
  status: TournamentStatus;
  gameFilter?: string | null;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseTournamentsReturn {
  tournaments: PandaTournament[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export const useTournaments = ({
  status,
  gameFilter,
  limit = 20,
  autoRefresh = false,
  refreshInterval = 300000,
}: UseTournamentsOptions): UseTournamentsReturn => {
  const [tournaments, setTournaments] = useState<PandaTournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchTournaments = useCallback(
    async (currentOffset: number = 0, isRefresh: boolean = false) => {
      try {
        if (isRefresh) {
          setIsRefreshing(true);
        } else if (currentOffset === 0) {
          setIsLoading(true);
        }

        setError(null);

        let data: PandaTournament[] = [];

        switch (status) {
          case 'running':
            data = await tournamentService.getTournaments({
              limit,
              offset: currentOffset,
              sort: 'tier',
              game: gameFilter || undefined,
            });
            break;
          case 'upcoming':
            data = await tournamentService.getUpcomingTournaments({
              limit,
              offset: currentOffset,
              sort: '-begin_at',
            });
            break;
          case 'finished':
            data = await tournamentService.getFinishedTournaments({
              limit,
              offset: currentOffset,
              sort: '-begin_at',
            });
            break;
        }

        if (gameFilter && status !== 'running') {
          data = data.filter((t) => {
            const gameAcronym = t.videogame?.slug || t.videogame?.name?.toLowerCase();
            return gameAcronym === gameFilter.toLowerCase();
          });
        }

        if (isRefresh || currentOffset === 0) {
          setTournaments(data);
          setOffset(limit);
        } else {
          setTournaments((prev) => [...prev, ...data]);
          setOffset((prev) => prev + limit);
        }

        setHasMore(data.length === limit);
      } catch (err) {
        console.error('Error fetching tournaments:', err);
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des tournois');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [status, gameFilter, limit]
  );

  const refetch = useCallback(async () => {
    setOffset(0);
    await fetchTournaments(0, true);
  }, [fetchTournaments]);

  const loadMore = useCallback(async () => {
    if (!isLoading && !isRefreshing && hasMore) {
      await fetchTournaments(offset, false);
    }
  }, [isLoading, isRefreshing, hasMore, offset, fetchTournaments]);

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchTournaments(0, false);
  }, [status, gameFilter, limit]);

  useEffect(() => {
    if (!autoRefresh) return;

    let intervalId: NodeJS.Timeout | null = null;
    let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

    const startPolling = () => {
      intervalId = setInterval(() => {
        fetchTournaments(0, true);
      }, refreshInterval);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        startPolling();
        fetchTournaments(0, true);
      } else {
        stopPolling();
      }
    };

    startPolling();
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      stopPolling();
      appStateSubscription?.remove();
    };
  }, [autoRefresh, refreshInterval, fetchTournaments]);

  return {
    tournaments,
    isLoading,
    isRefreshing,
    error,
    refetch,
    loadMore,
    hasMore,
  };
};
