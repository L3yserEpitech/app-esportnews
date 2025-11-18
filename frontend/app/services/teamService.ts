const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface Player {
  active: boolean;
  id: number;
  name: string;
  role: string | null;
  slug: string;
  modified_at: string;
  age: number | null;
  birthday: string | null;
  first_name: string;
  last_name: string;
  nationality: string;
  image_url: string;
}

export interface Team {
  id: number;
  name: string;
  location: string;
  slug: string;
  players: Player[];
  modified_at: string;
  acronym: string;
  image_url: string;
  dark_mode_image_url: string | null;
  current_videogame: {
    id: number;
    name: string;
    slug: string;
  };
}

class TeamService {
  /**
   * Rechercher des équipes par nom
   */
  async searchTeams(query: string, pageSize: number = 10): Promise<Team[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/teams/search?query=${encodeURIComponent(query)}&page_size=${pageSize}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de la recherche d\'équipes');
    }

    const teams: Team[] = await response.json();
    return teams;
  }

  /**
   * Récupérer les IDs des équipes favorites
   */
  async getFavoriteTeamIds(token: string): Promise<number[]> {
    const response = await fetch(`${API_BASE_URL}/api/users/favorite-teams/ids`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de la récupération des IDs favoris');
    }

    const ids: number[] = await response.json();
    return ids;
  }

  /**
   * Récupérer les détails des équipes favorites
   */
  async getFavoriteTeams(token: string): Promise<Team[]> {
    const response = await fetch(`${API_BASE_URL}/api/users/favorite-teams`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de la récupération des équipes favorites');
    }

    const teams: Team[] = await response.json();
    return teams;
  }

  /**
   * Ajouter une équipe aux favorites
   */
  async addFavoriteTeam(token: string, teamId: number): Promise<number[]> {
    const response = await fetch(`${API_BASE_URL}/api/users/favorite-teams/${teamId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de l\'ajout de l\'équipe aux favorites');
    }

    const result = await response.json();
    return result.favorite_teams;
  }

  /**
   * Retirer une équipe des favorites
   */
  async removeFavoriteTeam(token: string, teamId: number): Promise<number[]> {
    const response = await fetch(`${API_BASE_URL}/api/users/favorite-teams/${teamId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors du retrait de l\'équipe des favorites');
    }

    const result = await response.json();
    return result.favorite_teams;
  }

  /**
   * Récupère les détails complets d'une équipe avec ses joueurs
   */
  async getTeamById(teamId: number | string): Promise<Team> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/${teamId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch team ${teamId}: ${response.statusText}`);
      }

      const team: Team = await response.json();
      return team;
    } catch (error) {
      console.error(`Error fetching team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les détails complets pour plusieurs équipes
   */
  async getTeamsByIds(teamIds: (number | string)[]): Promise<Team[]> {
    try {
      const teams = await Promise.all(
        teamIds.map((id) => this.getTeamById(id))
      );
      return teams;
    } catch (error) {
      console.error('Error fetching multiple teams:', error);
      throw error;
    }
  }
}

export const teamService = new TeamService();
