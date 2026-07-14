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
   * wiki: requis par le backend pour scoper le fetch — sans lui, un ID numérique
   * ne déclenche pas le scan 10-wikis et renvoie 404 (cf. CLAUDE.md §18.1).
   */
  async getMatchById(id: number, wiki?: string | null): Promise<PandaMatch | null> {
    try {
      const response = await apiClient.get<PandaMatch>(`/api/matches/${id}`, {
        params: wiki ? { wiki } : undefined,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching match:', error);
      return null;
    }
  }

  /**
   * Récupérer plusieurs matchs par leurs IDs
   */
  async getMatchesByIds(ids: number[], wiki?: string | null): Promise<PandaMatch[]> {
    try {
      const promises = ids.map(id => this.getMatchById(id, wiki));
      const results = await Promise.all(promises);
      return results.filter((match): match is PandaMatch => match !== null);
    } catch (error: any) {
      console.error('Error fetching matches by IDs:', error);
      return [];
    }
  }
}

export const matchService = new MatchService();
