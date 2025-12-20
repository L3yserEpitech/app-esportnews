import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { liveMatchService } from '@/services';
import { LiveMatch } from '@/types';

interface UseLiveMatchesOptions {
  gameAcronym?: string;
  pollingInterval?: number; // en millisecondes (défaut: 30000 = 30s)
  enabled?: boolean; // permet de désactiver le polling
}

interface UseLiveMatchesReturn {
  liveMatches: LiveMatch[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useLiveMatches = (
  options: UseLiveMatchesOptions = {}
): UseLiveMatchesReturn => {
  const {
    gameAcronym,
    pollingInterval = 30000, // 30 secondes par défaut
    enabled = true,
  } = options;

  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isMountedRef = useRef(true);

  // Fonction de fetch des live matches
  const fetchLiveMatches = useCallback(async () => {
    if (!enabled) return;

    try {
      setError(null);
      const data = await liveMatchService.getLiveMatches(gameAcronym);

      if (isMountedRef.current) {
        setLiveMatches(data);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error fetching live matches:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des matchs en direct');
        setIsLoading(false);
      }
    }
  }, [gameAcronym, enabled]);

  // Fonction publique pour refetch manuel
  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchLiveMatches();
  }, [fetchLiveMatches]);

  // Démarrer le polling
  const startPolling = useCallback(() => {
    if (!enabled) return;

    // Arrêter le polling existant si présent
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Fetch initial
    fetchLiveMatches();

    // Setup polling interval
    pollingIntervalRef.current = setInterval(() => {
      fetchLiveMatches();
    }, pollingInterval);
  }, [enabled, pollingInterval, fetchLiveMatches]);

  // Arrêter le polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Gérer les changements d'état de l'app (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const wasInBackground = appStateRef.current.match(/inactive|background/);
      const isNowActive = nextAppState === 'active';

      if (wasInBackground && isNowActive) {
        // App revient en foreground → redémarrer le polling
        console.log('[useLiveMatches] App is now active, restarting polling');
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        // App va en background → arrêter le polling
        console.log('[useLiveMatches] App is going to background, stopping polling');
        stopPolling();
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [startPolling, stopPolling]);

  // Démarrer le polling au mount ou quand gameAcronym change
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Démarrer le polling si l'app est active
    if (AppState.currentState === 'active') {
      startPolling();
    }

    // Cleanup au unmount
    return () => {
      stopPolling();
    };
  }, [gameAcronym, enabled, startPolling, stopPolling]);

  // Cleanup au unmount du composant
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  return {
    liveMatches,
    isLoading,
    error,
    refetch,
  };
};
