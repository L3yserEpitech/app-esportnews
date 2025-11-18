import { PandaMatch } from '../types';

class MatchService {
  private baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  /**
   * Récupère les détails complets d'un match depuis l'API
   * @param matchId - ID du match PandaScore
   * @returns Objet PandaMatch avec tous les détails
   */
  async getMatchById(matchId: number | string): Promise<PandaMatch> {
    try {
      const url = `${this.baseUrl}/api/matches/${matchId}`;
      console.log(`[MatchService] 📡 GET ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log(`[MatchService] Response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch match ${matchId}: ${response.statusText}`);
      }

      const match: PandaMatch = await response.json();
      console.log(`[MatchService] ✅ Match ${matchId} loaded:`, {
        id: match.id,
        name: match.name,
        status: match.status,
        opponentsCount: match.opponents?.length || 0,
      });
      return match;
    } catch (error) {
      console.error(`[MatchService] ❌ Error fetching match ${matchId}:`, error);
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
      console.log(`[MatchService] 📦 Fetching ${matchIds.length} matches:`, matchIds);
      const startTime = Date.now();

      const matches = await Promise.all(
        matchIds.map((id) => this.getMatchById(id))
      );

      const duration = Date.now() - startTime;
      console.log(`[MatchService] ✅ All ${matches.length} matches loaded in ${duration}ms`, {
        matchIds: matches.map(m => m.id),
        statuses: matches.map(m => m.status),
      });

      return matches;
    } catch (error) {
      console.error('[MatchService] ❌ Error fetching multiple matches:', error);
      throw error;
    }
  }
}

export const matchService = new MatchService();
