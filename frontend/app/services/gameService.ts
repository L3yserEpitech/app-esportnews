import { Game } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

class GameService {
  async getGames(): Promise<Game[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/games`, {
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

  async getGameById(id: number): Promise<Game> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/games/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const game: Game = await response.json();
      return game;
    } catch (error) {
      console.error('Error fetching game:', error);
      throw error;
    }
  }

  async getGameByAcronym(acronym: string): Promise<Game> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/games/acronym/${acronym}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const game: Game = await response.json();
      return game;
    } catch (error) {
      console.error('Error fetching game by acronym:', error);
      throw error;
    }
  }
}

export const gameService = new GameService();