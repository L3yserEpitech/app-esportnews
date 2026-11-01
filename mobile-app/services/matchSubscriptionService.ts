import apiClient from './apiClient';

export interface MatchSubscriptionData {
  id: number;
  match_id: number;
  match2id: string;
  match_name: string;
  tournament_name: string;
  game_acronym: string;
  begin_at: string | null;
  status: string;
  from_tournament?: number | null;
  created_at: string;
}

export interface TournamentSubscriptionData {
  id: number;
  tournament_id: number;
  tournament_name: string;
  game_acronym: string;
  begin_at: string | null;
  end_at: string | null;
  status: string;
  created_at: string;
}

export interface SubscribeMatchMeta {
  match_name: string;
  // Alphanumeric Liquipedia id: the push payload carries it so tapping the
  // notification opens the exact match page (a numeric id 404s once the match
  // leaves the poller caches).
  match2id?: string;
  tournament_name: string;
  game_acronym: string;
  begin_at?: string;
}

export interface SubscribeTournamentMeta {
  tournament_name: string;
  game_acronym: string;
  begin_at?: string;
  end_at?: string;
}

class MatchSubscriptionService {
  // --- Match subscriptions ---

  async getMatchSubscriptions(): Promise<MatchSubscriptionData[]> {
    const res = await apiClient.get<MatchSubscriptionData[]>('/api/subscriptions/matches');
    return res.data;
  }

  async getSubscribedMatch2Ids(): Promise<string[]> {
    const res = await apiClient.get<string[]>('/api/subscriptions/matches/match2ids');
    return res.data;
  }

  // matchId is the pageid of the tournament page, shared by all its matches: the
  // match itself is identified by meta.match2id.
  async subscribeToMatch(matchId: number, meta: SubscribeMatchMeta): Promise<MatchSubscriptionData> {
    const res = await apiClient.post<MatchSubscriptionData>(
      `/api/subscriptions/matches/${matchId}`,
      meta
    );
    return res.data;
  }

  async unsubscribeFromMatch(match2id: string): Promise<void> {
    await apiClient.delete(`/api/subscriptions/matches/${encodeURIComponent(match2id)}`);
  }

  // --- Tournament subscriptions ---

  async getTournamentSubscriptions(): Promise<TournamentSubscriptionData[]> {
    const res = await apiClient.get<TournamentSubscriptionData[]>('/api/subscriptions/tournaments');
    return res.data;
  }

  async getTournamentSubscriptionIds(): Promise<number[]> {
    const res = await apiClient.get<number[]>('/api/subscriptions/tournaments/ids');
    return res.data;
  }

  async subscribeToTournament(tournamentId: number, meta: SubscribeTournamentMeta): Promise<TournamentSubscriptionData> {
    const res = await apiClient.post<TournamentSubscriptionData>(
      `/api/subscriptions/tournaments/${tournamentId}`,
      meta
    );
    return res.data;
  }

  async unsubscribeFromTournament(tournamentId: number): Promise<void> {
    await apiClient.delete(`/api/subscriptions/tournaments/${tournamentId}`);
  }
}

export const matchSubscriptionService = new MatchSubscriptionService();
