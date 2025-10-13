import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${process.env.BACKEND_URL}/matches-live`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer 7KwP-8CB10mnytro5OinZA',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch live matches' },
        { status: response.status }
      );
    }

    const data: LiveMatch[] = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching live matches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}