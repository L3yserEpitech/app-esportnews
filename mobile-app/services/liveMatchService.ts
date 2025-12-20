import apiClient from './apiClient';
import type { LiveMatch } from '@/types';

class LiveMatchService {
  /**
   * Récupérer les matchs en direct
   * @param gameAcronym - Acronyme du jeu pour filtrer (optionnel)
   */
  async getLiveMatches(gameAcronym?: string): Promise<LiveMatch[]> {
    try {
      const params = gameAcronym ? { game: gameAcronym } : {};
      const response = await apiClient.get<LiveMatch[]>('/api/live', { params });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching live matches:', error);
      return [];
    }
  }

  /**
   * Récupérer les matchs live pour tous les jeux
   */
  async getAllLiveMatches(): Promise<LiveMatch[]> {
    return this.getLiveMatches();
  }
}

export const liveMatchService = new LiveMatchService();
