import { useState, useEffect, useCallback } from 'react';
import { matchService } from '@/services';
import { PandaMatch } from '@/types';
import { format } from 'date-fns';

interface UseMatchesParams {
  date: Date;
  gameFilter?: string | null;
}

interface UseMatchesReturn {
  matches: PandaMatch[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useMatches = ({
  date,
  gameFilter,
}: UseMatchesParams): UseMatchesReturn => {
  const [matches, setMatches] = useState<PandaMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        // Format date as YYYY-MM-DD for API
        const formattedDate = format(date, 'yyyy-MM-dd');

        // Fetch matches by date
        const data = await matchService.getMatchesByDate(
          formattedDate,
          gameFilter || undefined
        );

        setMatches(data);
      } catch (err) {
        console.error('Error fetching matches:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Erreur lors du chargement des matchs'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [date, gameFilter]
  );

  // Initial fetch
  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Refetch function for pull-to-refresh
  const refetch = useCallback(async () => {
    await fetchMatches(true);
  }, [fetchMatches]);

  return {
    matches,
    isLoading,
    isRefreshing,
    error,
    refetch,
  };
};
