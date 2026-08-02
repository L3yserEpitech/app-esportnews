const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface PlayerTransfer {
  date: string;
  from_team: string;
  to_team: string;
  from_team_template: string;
  to_team_template: string;
  role: string;
}

export interface PlayerDetail {
  pageid: number;
  pagename: string;
  id: string;
  alternate_id?: string;
  name: string;
  localized_name?: string;
  nationalities: string[];
  region?: string;
  birth_date?: string;
  age?: number;
  team_pagename?: string;
  team_template?: string;
  links?: Record<string, string>;
  status?: string;
  earnings: number;
  earnings_by_year?: Record<string, number>;
  roles?: string[];
  signature_picks?: string[];
  first_name?: string;
  last_name?: string;
  transfers: PlayerTransfer[];
  wiki: string;
}

class PlayerService {
  async getPlayer(pagename: string, wiki: string): Promise<PlayerDetail> {
    const response = await fetch(
      `${API_BASE_URL}/api/players/${encodeURIComponent(pagename)}?wiki=${encodeURIComponent(wiki)}`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch player: ${response.status}`);
    }
    return response.json();
  }
}

export const playerService = new PlayerService();
