import apiClient from './apiClient';
import type { PandaMatch } from '@/types';

class MatchService {
  /**
   * Récupérer les matchs à une date précise
   */
  async getMatchesByDate(date: string, game?: string): Promise<PandaMatch[]> {
    try {
      const formData = new URLSearchParams();
      formData.set('date', date);
      if (game) {
        formData.set('game', game);
      }

      const response = await apiClient.post<PandaMatch[]>(
        '/api/matches/by-date',
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error fetching matches by date:', error);
      return [];
    }
  }

  /**
   * Récupérer un match par son ID
   */
  async getMatchById(id: number): Promise<PandaMatch | null> {
    try {
      const response = await apiClient.get<PandaMatch>(`/api/matches/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching match:', error);
      return null;
    }
  }
}

export const matchService = new MatchService();
