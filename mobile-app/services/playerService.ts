import apiClient from './apiClient';
import type { PlayerDetail } from '@/types';

class PlayerService {
  /**
   * Récupérer le profil d'un joueur (+ transferts).
   * GET /api/players/:pagename?wiki=<wiki>
   * wiki: REQUIS par le backend (pas de scan 10-wikis). 404 = joueur inexistant,
   * 503 = échec transitoire (429/budget/réseau).
   */
  async getPlayer(pagename: string, wiki: string): Promise<PlayerDetail | null> {
    if (!pagename || !wiki) return null;
    try {
      const response = await apiClient.get<PlayerDetail>(
        `/api/players/${encodeURIComponent(pagename)}`,
        { params: { wiki } }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching player:', error);
      return null;
    }
  }
}

export const playerService = new PlayerService();
