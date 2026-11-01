import { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import AuthContext from '@/contexts/AuthContext';
import {
  matchSubscriptionService,
  MatchSubscriptionData,
  TournamentSubscriptionData,
  SubscribeMatchMeta,
  SubscribeTournamentMeta,
} from '@/services/matchSubscriptionService';

const FREE_TOURNAMENT_LIMIT = 3;

interface SubscriptionContextType {
  // ID sets for quick lookup (heart icon state). Matches go by match2id: their
  // numeric id is the pageid of the tournament page, shared by all its matches.
  subscribedMatch2Ids: Set<string>;
  subscribedTournamentIds: Set<number>;

  // Full subscription data (for profile screen)
  matchSubscriptions: MatchSubscriptionData[];
  tournamentSubscriptions: TournamentSubscriptionData[];

  loading: boolean;
  error: string | null;

  // Actions
  subscribeToMatch: (matchId: number, match2id: string, meta: SubscribeMatchMeta) => Promise<void>;
  unsubscribeFromMatch: (match2id: string) => Promise<void>;
  subscribeToTournament: (tournamentId: number, meta: SubscribeTournamentMeta) => Promise<void>;
  unsubscribeFromTournament: (tournamentId: number) => Promise<void>;
  refreshSubscriptions: () => Promise<void>;
  loadFullSubscriptions: () => Promise<void>;

  // Limit checks
  canSubscribeTournament: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;
  const isAuthenticated = authContext?.isAuthenticated ?? false;

  const [subscribedMatch2Ids, setSubscribedMatch2Ids] = useState<Set<string>>(new Set());
  const [subscribedTournamentIds, setSubscribedTournamentIds] = useState<Set<number>>(new Set());
  const [matchSubscriptions, setMatchSubscriptions] = useState<MatchSubscriptionData[]>([]);
  const [tournamentSubscriptions, setTournamentSubscriptions] = useState<TournamentSubscriptionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPremium = user?.premium === true;
  const tournamentSubCount = subscribedTournamentIds.size;
  const canSubscribeTournament = isPremium || tournamentSubCount < FREE_TOURNAMENT_LIMIT;

  const loadSubscriptionIds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [match2Ids, tournamentIds] = await Promise.all([
        matchSubscriptionService.getSubscribedMatch2Ids(),
        matchSubscriptionService.getTournamentSubscriptionIds(),
      ]);
      setSubscribedMatch2Ids(new Set(match2Ids));
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
      setSubscribedMatch2Ids(new Set());
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

  const subscribeToMatch = useCallback(async (matchId: number, match2id: string, meta: SubscribeMatchMeta) => {
    // Optimistic update
    setSubscribedMatch2Ids(prev => new Set(prev).add(match2id));

    try {
      await matchSubscriptionService.subscribeToMatch(matchId, meta);
    } catch (error) {
      // Rollback on failure
      setSubscribedMatch2Ids(prev => {
        const next = new Set(prev);
        next.delete(match2id);
        return next;
      });
      throw error;
    }
  }, []);

  const unsubscribeFromMatch = useCallback(async (match2id: string) => {
    // Optimistic update
    setSubscribedMatch2Ids(prev => {
      const next = new Set(prev);
      next.delete(match2id);
      return next;
    });
    const removedItem = matchSubscriptions.find(s => s.match2id === match2id);
    setMatchSubscriptions(prev => prev.filter(s => s.match2id !== match2id));

    try {
      await matchSubscriptionService.unsubscribeFromMatch(match2id);
    } catch (error) {
      // Rollback on failure
      setSubscribedMatch2Ids(prev => new Set(prev).add(match2id));
      if (removedItem) setMatchSubscriptions(prev => [...prev, removedItem]);
      throw error;
    }
  }, [matchSubscriptions]);

  const subscribeToTournament = useCallback(async (tournamentId: number, meta: SubscribeTournamentMeta) => {
    // Optimistic update
    setSubscribedTournamentIds(prev => new Set(prev).add(tournamentId));

    try {
      await matchSubscriptionService.subscribeToTournament(tournamentId, meta);
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
    // Optimistic update — remove tournament
    setSubscribedTournamentIds(prev => {
      const next = new Set(prev);
      next.delete(tournamentId);
      return next;
    });
    const removedTournament = tournamentSubscriptions.find(s => s.tournament_id === tournamentId);
    setTournamentSubscriptions(prev => prev.filter(s => s.tournament_id !== tournamentId));

    // Optimistic update — remove auto-created match subs from this tournament
    const removedMatches = matchSubscriptions.filter(s => s.from_tournament === tournamentId);
    if (removedMatches.length > 0) {
      setMatchSubscriptions(prev => prev.filter(s => s.from_tournament !== tournamentId));
      setSubscribedMatch2Ids(prev => {
        const next = new Set(prev);
        removedMatches.forEach(m => next.delete(m.match2id));
        return next;
      });
    }

    try {
      await matchSubscriptionService.unsubscribeFromTournament(tournamentId);
      // Refresh match IDs from server to stay in sync
      const match2Ids = await matchSubscriptionService.getSubscribedMatch2Ids();
      setSubscribedMatch2Ids(new Set(match2Ids));
    } catch (error) {
      // Rollback on failure
      setSubscribedTournamentIds(prev => new Set(prev).add(tournamentId));
      if (removedTournament) setTournamentSubscriptions(prev => [...prev, removedTournament]);
      if (removedMatches.length > 0) {
        setMatchSubscriptions(prev => [...prev, ...removedMatches]);
        setSubscribedMatch2Ids(prev => {
          const next = new Set(prev);
          removedMatches.forEach(m => next.add(m.match2id));
          return next;
        });
      }
      throw error;
    }
  }, [tournamentSubscriptions, matchSubscriptions]);

  const refreshSubscriptions = useCallback(async () => {
    await loadSubscriptionIds();
  }, [loadSubscriptionIds]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscribedMatch2Ids,
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
        canSubscribeTournament,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export default SubscriptionContext;
