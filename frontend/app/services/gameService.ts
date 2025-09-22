import { Game } from '../types';

const API_BASE_URL = 'https://x8ki-letl-twmt.n7.xano.io/api:Q_7SDD7T';

class GameService {
  async getGames(): Promise<Game[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/game`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const games: Game[] = await response.json();
      return games;
    } catch (error) {
      console.error('Error fetching games:', error);
      throw error;
    }
  }
}

export const gameService = new GameService();