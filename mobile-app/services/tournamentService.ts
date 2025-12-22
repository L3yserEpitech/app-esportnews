import apiClient from './apiClient';
import type { PandaTournament, PandaMatch } from '@/types';

export interface TournamentFiltersType {
  tiers: string[];
}

export interface TournamentQueryParams {
  limit?: number;
  offset?: number;
  sort?: 'tier' | '-tier' | 'begin_at' | '-begin_at';
  game?: string;
  status?: 'running' | 'upcoming' | 'finished';
  'filter[tier]'?: string;
}

class TournamentService {
  /**
   * Récupérer les tournois (running par défaut)
   */
  async getTournaments(params?: TournamentQueryParams): Promise<PandaTournament[]> {
    try {
      const response = await apiClient.get<PandaTournament[]>('/api/tournaments', { params });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching tournaments:', error);
      return [];
    }
  }

  /**
   * Récupérer tous les tournois en cours
   */
  async getAllRunningTournaments(sort?: string): Promise<PandaTournament[]> {
    try {
      const response = await apiClient.get<PandaTournament[]>('/api/tournaments/all', {
        params: { sort },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching all running tournaments:', error);
      return [];
    }
  }

  /**
   * Récupérer les tournois à venir
   */
  async getUpcomingTournaments(params?: TournamentQueryParams): Promise<PandaTournament[]> {
    try {
      const response = await apiClient.get<PandaTournament[]>('/api/tournaments/upcoming', {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching upcoming tournaments:', error);
      return [];
    }
  }

  /**
   * Récupérer les tournois terminés
   */
  async getFinishedTournaments(params?: TournamentQueryParams): Promise<PandaTournament[]> {
    try {
      const response = await apiClient.get<PandaTournament[]>('/api/tournaments/finished', {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching finished tournaments:', error);
      return [];
    }
  }

  /**
   * Récupérer les tournois à une date précise
   */
  async getTournamentsByDate(date: string, game?: string): Promise<PandaTournament[]> {
    try {
      const formData = new URLSearchParams();
      formData.set('date', date);
      if (game) {
        formData.set('game', game);
      }

      const response = await apiClient.post<PandaTournament[]>(
        '/api/tournaments/by-date',
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error fetching tournaments by date:', error);
      return [];
    }
  }

  /**
   * Récupérer un tournoi par son ID
   */
  async getTournamentById(id: number): Promise<PandaTournament | null> {
    try {
      console.log(`📡 API Call: GET /api/tournaments/${id}`);
      const response = await apiClient.get<PandaTournament>(`/api/tournaments/${id}`);
      console.log(`✅ API Response:`, response.data?.name || 'No name');
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching tournament:', error.message || error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * Récupérer les tournois avec filtres
   */
  async getFilteredTournaments(
    status: 'running' | 'upcoming' | 'finished' = 'running',
    gameAcronym?: string,
    filters?: TournamentFiltersType
  ): Promise<PandaTournament[]> {
    try {
      const params: any = { status };

      if (gameAcronym) {
        params.game = gameAcronym;
      }

      if (filters?.tiers && filters.tiers.length > 0) {
        params['filter[tier]'] = filters.tiers.join(',');
      }

      const response = await apiClient.get<PandaTournament[]>('/api/tournaments/filtered', {
        params,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error fetching filtered tournaments:', error);
      return [];
    }
  }
}

export const tournamentService = new TournamentService();
