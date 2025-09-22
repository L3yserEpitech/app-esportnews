// Game types
export interface GameImage {
  access: string;
  path: string;
  name: string;
  type: string;
  size: number;
  mime: string;
  meta: {
    width: number;
    height: number;
  };
  url: string;
}

export interface Game {
  id: number;
  created_at: number;
  name: string;
  acronym: string;
  selected_image: GameImage;
  unselected_image: GameImage;
}

// Match types
export interface Match {
  id: string;
  game: Game;
  tournament: Tournament;
  teams: Team[];
  status: 'live' | 'upcoming' | 'finished';
  startTime: string;
  streams?: Stream[];
}

// SportDevs Live Match types
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

export interface Team {
  id: string;
  name: string;
  logo?: string;
  score?: number;
}

export interface Tournament {
  id: string;
  name: string;
  game: Game;
}

export interface Stream {
  url: string;
  platform: string;
  language: string;
}

// News & Articles types
export interface NewsItem {
  id: number;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  author: string;
  created_at: string;
  readTime: number;
  featuredImage: string;
  category: string;
  tags: string[];
  views: number;
  status: 'publié' | 'brouillon';
}

export interface Article extends NewsItem {
  content: string;
  content_black?: string;
  content_white?: string;
}

// User types
export interface User {
  id: number;
  name: string;
  email: string;
  photo?: string;
  photoUploaded: boolean;
  admin: boolean;
  favorite_team?: any;
  created_at: string;
}

// Advertisement types
export interface Advertisement {
  id: number;
  title: string;
  position: number;
  type: 'banner' | 'video' | 'native';
  url: string;
  redirect_link: string;
  is_active: boolean;
  file_size: number;
  file_type: string;
  duration?: number;
  created_at: string;
  updated_at: string;
}

// UI State types
export interface GameSelection {
  selectedGames: string[];
  activeGame?: string;
}

export interface UserPreferences {
  selectedGames: string[];
  isSubscribed: boolean;
  theme: 'light' | 'dark';
}
