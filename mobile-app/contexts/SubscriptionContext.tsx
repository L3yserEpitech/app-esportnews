import { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import AuthContext from '@/contexts/AuthContext';
import {
  matchSubscriptionService,
  MatchSubscriptionData,
  TournamentSubscriptionData,
  SubscribeMatchMeta,
  SubscribeTournamentMeta,
} from '@/services/matchSubscriptionService';

const FREE_MATCH_LIMIT = 5;
const FREE_TOURNAMENT_LIMIT = 3;

interface SubscriptionContextType {
  // ID sets for quick lookup (heart icon state)
  subscribedMatchIds: Set<number>;
  subscribedTournamentIds: Set<number>;

  // Full subscription data (for profile screen)
  matchSubscriptions: MatchSubscriptionData[];
  tournamentSubscriptions: TournamentSubscriptionData[];

  loading: boolean;
  error: string | null;

  // Actions
  subscribeToMatch: (matchId: number, meta: SubscribeMatchMeta) => Promise<void>;
  unsubscribeFromMatch: (matchId: number) => Promise<void>;
  subscribeToTournament: (tournamentId: number, meta: SubscribeTournamentMeta) => Promise<void>;
  unsubscribeFromTournament: (tournamentId: number) => Promise<void>;
  refreshSubscriptions: () => Promise<void>;
  loadFullSubscriptions: () => Promise<void>;

  // Limit checks
  canSubscribeMatch: boolean;
  canSubscribeTournament: boolean;
  matchSubCount: number;
  tournamentSubCount: number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;
  const isAuthenticated = authContext?.isAuthenticated ?? false;

  const [subscribedMatchIds, setSubscribedMatchIds] = useState<Set<number>>(new Set());
  const [subscribedTournamentIds, setSubscribedTournamentIds] = useState<Set<number>>(new Set());
  const [matchSubscriptions, setMatchSubscriptions] = useState<MatchSubscriptionData[]>([]);
  const [tournamentSubscriptions, setTournamentSubscriptions] = useState<TournamentSubscriptionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPremium = user?.premium === true;
  const matchSubCount = subscribedMatchIds.size;
  const tournamentSubCount = subscribedTournamentIds.size;
  const canSubscribeMatch = isPremium || matchSubCount < FREE_MATCH_LIMIT;
  const canSubscribeTournament = isPremium || tournamentSubCount < FREE_TOURNAMENT_LIMIT;

  const loadSubscriptionIds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [matchIds, tournamentIds] = await Promise.all([
        matchSubscriptionService.getMatchSubscriptionIds(),
        matchSubscriptionService.getTournamentSubscriptionIds(),
      ]);
      setSubscribedMatchIds(new Set(matchIds));
      setSubscribedTournamentIds(new Set(tournamentIds));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load subscriptions';
      setError(message);
      console.error('[SubscriptionContext] Failed to load subscription IDs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load subscribed IDs on authentication
  useEffect(() => {
    if (isAuthenticated) {
      loadSubscriptionIds();
    } else {
      // Clear state on logout
      setSubscribedMatchIds(new Set());
      setSubscribedTournamentIds(new Set());
      setMatchSubscriptions([]);
      setTournamentSubscriptions([]);
      setError(null);
    }
  }, [isAuthenticated, loadSubscriptionIds]);

  // Load full subscription data (lazy, called from profile screen)
  const loadFullSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const [matches, tournaments] = await Promise.all([
        matchSubscriptionService.getMatchSubscriptions(),
        matchSubscriptionService.getTournamentSubscriptions(),
      ]);
      setMatchSubscriptions(matches);
      setTournamentSubscriptions(tournaments);
    } catch (error) {
      console.error('[SubscriptionContext] Failed to load full subscriptions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const subscribeToMatch = useCallback(async (matchId: number, meta: SubscribeMatchMeta) => {
    // Optimistic update
    setSubscribedMatchIds(prev => new Set(prev).add(matchId));

    try {
      await matchSubscriptionService.subscribeToMatch(matchId, meta);
    } catch (error) {
      // Rollback on failure
      setSubscribedMatchIds(prev => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
      throw error;
    }
  }, []);

  const unsubscribeFromMatch = useCallback(async (matchId: number) => {
    // Optimistic update
    setSubscribedMatchIds(prev => {
      const next = new Set(prev);
      next.delete(matchId);
      return next;
    });

    try {
      await matchSubscriptionService.unsubscribeFromMatch(matchId);
    } catch (error) {
      // Rollback on failure
      setSubscribedMatchIds(prev => new Set(prev).add(matchId));
      throw error;
    }
  }, []);

  const subscribeToTournament = useCallback(async (tournamentId: number, meta: SubscribeTournamentMeta) => {
    // Optimistic update
    setSubscribedTournamentIds(prev => new Set(prev).add(tournamentId));

    try {
      await matchSubscriptionService.subscribeToTournament(tournamentId, meta);
      // Also refresh match IDs since tournament subscription auto-creates match subs
      const matchIds = await matchSubscriptionService.getMatchSubscriptionIds();
      setSubscribedMatchIds(new Set(matchIds));
    } catch (error) {
      // Rollback on failure
      setSubscribedTournamentIds(prev => {
        const next = new Set(prev);
        next.delete(tournamentId);
        return next;
      });
      throw error;
    }
  }, []);

  const unsubscribeFromTournament = useCallback(async (tournamentId: number) => {
    // Optimistic update
    setSubscribedTournamentIds(prev => {
      const next = new Set(prev);
      next.delete(tournamentId);
      return next;
    });

    try {
      await matchSubscriptionService.unsubscribeFromTournament(tournamentId);
      // Also refresh match IDs since tournament unsub removes auto-created match subs
      const matchIds = await matchSubscriptionService.getMatchSubscriptionIds();
      setSubscribedMatchIds(new Set(matchIds));
    } catch (error) {
      // Rollback on failure
      setSubscribedTournamentIds(prev => new Set(prev).add(tournamentId));
      throw error;
    }
  }, []);

  const refreshSubscriptions = useCallback(async () => {
    await loadSubscriptionIds();
  }, [loadSubscriptionIds]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscribedMatchIds,
        subscribedTournamentIds,
        matchSubscriptions,
        tournamentSubscriptions,
        loading,
        error,
        subscribeToMatch,
        unsubscribeFromMatch,
        subscribeToTournament,
        unsubscribeFromTournament,
        refreshSubscriptions,
        loadFullSubscriptions,
        canSubscribeMatch,
        canSubscribeTournament,
        matchSubCount,
        tournamentSubCount,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export default SubscriptionContext;
