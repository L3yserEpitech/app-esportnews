// Import types from the types file
import { LiveMatch as LiveMatchType } from '../types';
import { getApiBaseUrl } from '../lib/apiConfig';

// Re-export for backward compatibility
export type LiveMatch = LiveMatchType;
export type Match = LiveMatchType;

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export const matchService = {
  /**
   * Get running/live matches
   * @param gameAcronym Optional game filter (e.g., "valorant", "lol", "cs2")
   */
  async getRunningMatches(gameAcronym?: string): Promise<Match[]> {
    try {
      let url = `${API_BASE_URL}/api/matches/running`;
      if (gameAcronym) {
        url += `?game=${encodeURIComponent(gameAcronym)}`;
      }
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch running matches: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching running matches:', error);
      return [];
    }
  },

  /**
   * Get upcoming matches
   * @param gameAcronym Optional game filter (e.g., "valorant", "lol", "cs2")
   */
  async getUpcomingMatches(gameAcronym?: string): Promise<Match[]> {
    try {
      let url = `${API_BASE_URL}/api/matches/upcoming`;
      if (gameAcronym) {
        url += `?game=${encodeURIComponent(gameAcronym)}`;
      }
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch upcoming matches: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching upcoming matches:', error);
      return [];
    }
  },

  /**
   * Get past/finished matches
   * @param gameAcronym Optional game filter (e.g., "valorant", "lol", "cs2")
   */
  async getPastMatches(gameAcronym?: string): Promise<Match[]> {
    try {
      let url = `${API_BASE_URL}/api/matches/past`;
      if (gameAcronym) {
        url += `?game=${encodeURIComponent(gameAcronym)}`;
      }
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch past matches: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching past matches:', error);
      return [];
    }
  },

  /**
   * Get matches by status
   * @param status Match status: 'running' | 'upcoming' | 'past'
   * @param gameAcronym Optional game filter
   */
  async getMatchesByStatus(status: 'running' | 'upcoming' | 'past', gameAcronym?: string): Promise<Match[]> {
    switch (status) {
      case 'running':
        return this.getRunningMatches(gameAcronym);
      case 'upcoming':
        return this.getUpcomingMatches(gameAcronym);
      case 'past':
        return this.getPastMatches(gameAcronym);
      default:
        return [];
    }
  },

  /**
   * Get a single match by ID (PageID)
   * @param matchId Match PageID
   * @param wiki Optional wiki name to speed up lookup (avoids searching all wikis)
   */
  async getMatchById(matchId: string, wiki?: string): Promise<Match> {
    try {
      const baseUrl = getApiBaseUrl();
      let url = `${baseUrl}/api/matches/${matchId}`;
      if (wiki) {
        url += `?wiki=${encodeURIComponent(wiki)}`;
      }
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch match: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching match by ID:', error);
      throw error;
    }
  },

  /**
   * Get multiple matches by IDs (not implemented in backend yet)
   * @param matchIds Array of match IDs
   */
  async getMatchesByIds(matchIds: number[]): Promise<Match[]> {
    try {
      // TODO: Implement batch endpoint in backend if needed
      // For now, fetch one by one
      const promises = matchIds.map(id => this.getMatchById(String(id)));
      const results = await Promise.allSettled(promises);
      return results
        .filter((r): r is PromiseFulfilledResult<Match> => r.status === 'fulfilled')
        .map(r => r.value);
    } catch (error) {
      console.error('Error fetching matches by IDs:', error);
      return [];
    }
  },

  /**
   * Get matches by specific date
   * @param date Date in YYYY-MM-DD format
   * @param gameAcronym Optional game filter
   */
  async getMatchesByDate(date: string, gameAcronym?: string): Promise<Match[]> {
    try {
      const url = `${API_BASE_URL}/api/matches/by-date`;

      // Use URLSearchParams for application/x-www-form-urlencoded
      const params = new URLSearchParams();
      params.append('date', date);
      if (gameAcronym) {
        params.append('game', gameAcronym);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch matches by date: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching matches by date:', error);
      return [];
    }
  },

  /**
   * Legacy method for backward compatibility
   */
  async getLiveMatches(gameAcronym?: string): Promise<LiveMatch[]> {
    return this.getRunningMatches(gameAcronym);
  }
};

// Export legacy service for backward compatibility
export const liveMatchService = matchService;
