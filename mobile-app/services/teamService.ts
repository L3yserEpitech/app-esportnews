import apiClient from './apiClient';
import type {
  NormalizedTeam,
  TeamDetail,
  TeamMatchesResponse,
  TeamPlacementsResponse,
} from '@/types';

// Les templates Liquipedia traînent souvent un suffixe de date ("furia 2025",
// "heroic sep 2024") qui ne résout pas ; on retente sur la base.
const TEMPLATE_DATE_SUFFIX = /\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?\s*\d{4}$/i;

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
   * Détail d'une équipe depuis son template Liquipedia, en un seul appel.
   * GET /api/teams/by-template?template=<t>&wiki=<w>&detail=1
   *
   * C'est la seule voie exploitable depuis un match ou un tournoi : leurs
   * opponents ne portent pas de pageid, seulement un `id` synthétique
   * (hash du nom d'équipe) que /teams/:id/detail ne peut pas résoudre.
   */
  async getTeamDetailByTemplate(
    template: string,
    wiki: string,
    name?: string
  ): Promise<TeamDetail | null> {
    const fetchOne = async (tpl: string) => {
      const params: Record<string, string | number> = { template: tpl, wiki, detail: 1 };
      // Repli serveur pour les équipes renommées : le template d'un match passé
      // ("brion 2023") ne correspond plus à la fiche, le nom si.
      if (name) params.name = name;
      const response = await apiClient.get<TeamDetail>('/api/teams/by-template', { params });
      return response.data;
    };

    try {
      return await fetchOne(template);
    } catch {
      const base = template.replace(TEMPLATE_DATE_SUFFIX, '').trim();
      if (!base || base === template) return null;
      try {
        return await fetchOne(base);
      } catch (error: any) {
        console.error('Error fetching team detail by template:', error);
        return null;
      }
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
