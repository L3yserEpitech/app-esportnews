const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

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
}

export const teamService = new TeamService();
