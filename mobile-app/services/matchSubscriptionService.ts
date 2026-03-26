import apiClient from './apiClient';

export interface MatchSubscriptionData {
  id: number;
  match_id: number;
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
  tournament_name: string;
  game_acronym: string;
  begin_at?: string;
}

export interface SubscribeTournamentMeta {
  tournament_name: string;
  game_acronym: string;
  begin_at?: string;
  end_at?: string;
  match_ids?: number[];
}

class MatchSubscriptionService {
  // --- Match subscriptions ---

  async getMatchSubscriptions(): Promise<MatchSubscriptionData[]> {
    const res = await apiClient.get<MatchSubscriptionData[]>('/api/subscriptions/matches');
    return res.data;
  }

  async getMatchSubscriptionIds(): Promise<number[]> {
    const res = await apiClient.get<number[]>('/api/subscriptions/matches/ids');
    return res.data;
  }

  async subscribeToMatch(matchId: number, meta: SubscribeMatchMeta): Promise<MatchSubscriptionData> {
    const res = await apiClient.post<MatchSubscriptionData>(
      `/api/subscriptions/matches/${matchId}`,
      meta
    );
    return res.data;
  }

  async unsubscribeFromMatch(matchId: number): Promise<void> {
    await apiClient.delete(`/api/subscriptions/matches/${matchId}`);
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
