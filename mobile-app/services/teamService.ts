import apiClient from './apiClient';
import type {
  NormalizedTeam,
  TeamDetail,
  TeamMatchesResponse,
  TeamPlacementsResponse,
} from '@/types';

class TeamService {
  /**
   * Rechercher des équipes par nom (parallèle sur les 10 wikis).
   * GET /api/teams/search?query=<q>&page_size=<n>
   */
  async searchTeams(query: string, pageSize: number = 10): Promise<NormalizedTeam[]> {
    if (!query) return [];
    try {
      const response = await apiClient.get<NormalizedTeam[]>('/api/teams/search', {
        params: { query, page_size: pageSize },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error searching teams:', error);
      return [];
    }
  }

  /**
   * Récupérer une équipe par son pageid (roster inclus).
   * GET /api/teams/:id?wiki=<wiki>
   * wiki: hint optionnel pour éviter le fan-out 10-wikis côté backend.
   */
  async getTeamById(id: number, wiki?: string | null): Promise<NormalizedTeam | null> {
    try {
      const response = await apiClient.get<NormalizedTeam>(`/api/teams/${id}`, {
        params: wiki ? { wiki } : undefined,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching team:', error);
      return null;
    }
  }

  /**
   * Récupérer les détails enrichis d'une équipe (roster + achievements).
   * GET /api/teams/:id/detail?wiki=<wiki>
   */
  async getTeamDetail(id: number, wiki?: string | null): Promise<TeamDetail | null> {
    try {
      const response = await apiClient.get<TeamDetail>(`/api/teams/${id}/detail`, {
        params: wiki ? { wiki } : undefined,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching team detail:', error);
      return null;
    }
  }

  /**
   * Récupérer les matchs récents ET à venir d'une équipe.
   * GET /api/teams/:id/matches?wiki=<wiki>&template=<template>&name=<name>
   * Le backend exige wiki + template ; il renvoie { recent, upcoming } en un
   * seul appel (pas de param `type`, contrairement à ce que suggère CLAUDE.md §6).
   */
  async getTeamMatches(
    id: number,
    wiki: string,
    template: string,
    name?: string
  ): Promise<TeamMatchesResponse> {
    try {
      const params: Record<string, string> = { wiki, template };
      if (name) params.name = name;
      const response = await apiClient.get<TeamMatchesResponse>(
        `/api/teams/${id}/matches`,
        { params }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching team matches:', error);
      return { recent: [], upcoming: [] };
    }
  }

  /**
   * Récupérer les placements en tournoi d'une équipe.
   * GET /api/teams/:id/placements?wiki=<wiki>&name=<name>&limit=<n>
   * Le backend exige wiki + name.
   */
  async getTeamPlacements(
    id: number,
    wiki: string,
    name: string,
    limit: number = 20
  ): Promise<TeamPlacementsResponse> {
    try {
      const response = await apiClient.get<TeamPlacementsResponse>(
        `/api/teams/${id}/placements`,
        { params: { wiki, name, limit } }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching team placements:', error);
      return { placements: [] };
    }
  }

  /**
   * Récupérer les équipes favorites de l'utilisateur (résolues via Liquipedia).
   * GET /api/users/favorite-teams — JWT requis.
   */
  async getFavoriteTeams(): Promise<NormalizedTeam[]> {
    try {
      const response = await apiClient.get<NormalizedTeam[]>('/api/users/favorite-teams');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching favorite teams:', error);
      return [];
    }
  }

  /**
   * Récupérer juste les IDs des équipes favorites.
   * GET /api/users/favorite-teams/ids — JWT requis.
   */
  async getFavoriteTeamIds(): Promise<number[]> {
    try {
      const response = await apiClient.get<number[]>('/api/users/favorite-teams/ids');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching favorite team IDs:', error);
      return [];
    }
  }

  /**
   * Ajouter une équipe aux favoris (max 3).
   * POST /api/users/favorite-teams/:teamId — JWT requis.
   * Retourne la nouvelle liste d'IDs favoris, ou null en cas d'erreur.
   */
  async addFavoriteTeam(teamId: number): Promise<number[] | null> {
    try {
      const response = await apiClient.post<{ favorite_teams: number[] }>(
        `/api/users/favorite-teams/${teamId}`
      );
      return response.data.favorite_teams;
    } catch (error: any) {
      console.error('Error adding favorite team:', error);
      return null;
    }
  }

  /**
   * Retirer une équipe des favoris.
   * DELETE /api/users/favorite-teams/:teamId — JWT requis.
   * Retourne la nouvelle liste d'IDs favoris, ou null en cas d'erreur.
   */
  async removeFavoriteTeam(teamId: number): Promise<number[] | null> {
    try {
      const response = await apiClient.delete<{ favorite_teams: number[] }>(
        `/api/users/favorite-teams/${teamId}`
      );
      return response.data.favorite_teams;
    } catch (error: any) {
      console.error('Error removing favorite team:', error);
      return null;
    }
  }
}

export const teamService = new TeamService();
