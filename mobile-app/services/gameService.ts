import apiClient from './apiClient';
import type { Game } from '@/types';

class GameService {
  /**
   * Récupérer tous les jeux supportés
   */
  async getGames(): Promise<Game[]> {
    try {
      const response = await apiClient.get<Game[]>('/api/games');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching games:', error);
      throw new Error('Impossible de récupérer la liste des jeux');
    }
  }

  /**
   * Récupérer un jeu par son ID
   */
  async getGameById(id: number): Promise<Game> {
    try {
      const response = await apiClient.get<Game>(`/api/games/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching game:', error);
      throw new Error(`Impossible de récupérer le jeu #${id}`);
    }
  }

  /**
   * Récupérer un jeu par son acronyme
   */
  async getGameByAcronym(acronym: string): Promise<Game> {
    try {
      const response = await apiClient.get<Game>(`/api/games/acronym/${acronym}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching game by acronym:', error);
      throw new Error(`Impossible de récupérer le jeu "${acronym}"`);
    }
  }
}

export const gameService = new GameService();
