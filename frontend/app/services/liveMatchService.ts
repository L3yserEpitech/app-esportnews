// PandaMatch interface (from backend) - matches running endpoint
export interface LiveMatch {
  id: number;
  name: string;
  slug?: string;
  status?: string;
  begin_at?: string;
  end_at?: string;
  scheduled_at?: string;
  match_type?: string;
  number_of_games?: number;
  tournament_id: number;
  league_id?: number;
  serie_id?: number;
  opponents?: Array<{
    opponent: {
      id: number;
      name: string;
      acronym: string;
      slug: string;
      image_url: string;
    };
    type: string;
  }>;
  results?: Array<{
    team_id: number;
    score: number;
  }>;
  tournament?: {
    id: number;
    name: string;
    slug?: string;
    tier?: string;
  };
  league?: {
    id: number;
    name: string;
    slug: string;
    image_url: string;
  };
  videogame?: {
    id: number;
    name: string;
    slug: string;
  };
  live?: {
    supported: boolean;
    opens_at?: string;
    url?: string;
  };
  streams_list?: Array<{
    language: string;
    main: boolean;
    official: boolean;
    embed_url?: string;
    raw_url: string;
  }>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

export const liveMatchService = {
  async getLiveMatches(gameAcronym?: string): Promise<LiveMatch[]> {
    try {
      let url = `${API_BASE_URL}/api/live`;
      if (gameAcronym) {
        url += `?game=${encodeURIComponent(gameAcronym)}`;
      }
      console.log('[liveMatchService] Fetching live matches:', { gameAcronym, url });

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch live matches: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching live matches:', error);
      throw error;
    }
  }
};