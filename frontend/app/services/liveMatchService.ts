export interface LiveMatch {
  id: number;
  name: string;
  tournament_id: number;
  tournament_name: string;
  tournament_importance: number;
  season_id: number;
  season_name: string;
  round_id: number;
  round: {
    id: number;
    name: string;
    round: number;
    end_time: string;
    start_time: string;
  };
  status: {
    type: string;
    reason: string;
  };
  status_type: string;
  home_team_id: number;
  home_team_name: string;
  home_team_hash_image: string;
  away_team_id: number;
  away_team_name: string;
  away_team_hash_image: string;
  home_team_score: {
    current: number;
    display: number;
  };
  away_team_score: {
    current: number;
    display: number;
  };
  start_time: string;
  duration: number;
  class_id: number;
  class_name: string;
  class_hash_image: string;
  league_id: number;
  league_name: string;
  league_hash_image: string;
}

const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://esportnews-backend-92a3q1l44-l3yserepitechs-projects.vercel.app'
  : 'https://esportnews-backend-92a3q1l44-l3yserepitechs-projects.vercel.app';

export const liveMatchService = {
  async getLiveMatches(): Promise<LiveMatch[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/live-matches`);

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