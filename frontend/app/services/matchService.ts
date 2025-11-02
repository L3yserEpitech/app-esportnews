import { PandaMatch } from '../types';

class MatchService {
  private baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

  /**
   * Récupère les détails complets d'un match depuis l'API
   * @param matchId - ID du match PandaScore
   * @returns Objet PandaMatch avec tous les détails
   */
  async getMatchById(matchId: number | string): Promise<PandaMatch> {
    try {
      const response = await fetch(`${this.baseUrl}/api/matches/${matchId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch match ${matchId}: ${response.statusText}`);
      }

      const match: PandaMatch = await response.json();
      return match;
    } catch (error) {
      console.error(`Error fetching match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les détails complets pour plusieurs matchs
   * @param matchIds - Array d'IDs de matchs
   * @returns Array de PandaMatch
   */
  async getMatchesByIds(matchIds: (number | string)[]): Promise<PandaMatch[]> {
    try {
      const matches = await Promise.all(
        matchIds.map((id) => this.getMatchById(id))
      );
      return matches;
    } catch (error) {
      console.error('Error fetching multiple matches:', error);
      throw error;
    }
  }
}

export const matchService = new MatchService();
