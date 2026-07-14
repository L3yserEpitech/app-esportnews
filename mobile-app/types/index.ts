// Game types
export interface Game {
  id: number;
  created_at: string;
  name: string;
  acronym: string;
  selected_image: string;
  unselected_image: string;
  full_name: string;
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

// PandaScore Live Match types (from /api/live endpoint)
// LiveMatch is an alias for PandaMatch (for backward compatibility)
export type LiveMatch = PandaMatch;

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
  readTime?: number;
  featuredImage: string;
  category: string;
  credit?: string;
  tags: string[];
  views: number;
  videoUrl?: string;
  videoType?: 'youtube' | 'vimeo' | 'mp4';
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
  avatar?: string;
  admin: boolean;
  premium?: boolean;
  favorite_team?: any;
  created_at: string;
  age?: number;
  notifi_push?: boolean;
  notif_articles?: boolean;
  notif_news?: boolean;
  notif_matchs?: boolean;

  // IAP (In-App Purchase) — iOS App Store & Google Play
  iap_platform?: string;
  iap_product_id?: string;
  iap_transaction_id?: string;
  iap_original_transaction_id?: string;
  iap_expires_at?: string;
}

// Advertisement types
export interface Advertisement {
  id: number;
  created_at: string;
  title: string | null;
  position: number | null;
  type: string | null;
  url: string | null;
  redirect_link: string | null;
}

// Tournament types (PandaScore)
export interface PandaRoster {
  team?: PandaTeam;
  players?: PandaPlayer[];
}

export interface PandaTournament {
  id: number;
  name: string;
  slug?: string | null;
  status?: string | null;
  type?: string;
  tier?: string | null;
  begin_at?: string | null;
  end_at?: string | null;
  region?: string | null;
  prizepool?: string | null;
  has_bracket?: boolean;
  videogame?: PandaVideogame;
  league?: PandaLeague;
  teams?: PandaTeam[];
  matches?: PandaMatch[];
  expected_roster?: PandaRoster[];
  winner_id?: number | null;
  banner_url?: string | null;
  banner_dark_url?: string | null;
  icon_url?: string | null;
  icon_dark_url?: string | null;
  wiki?: string | null;
}

export interface PandaMatchResult {
  team_id: number;
  score: number;
}

export interface PandaMatch {
  id: number;
  name: string;
  slug?: string | null;
  status?: string | null;
  begin_at?: string | null;
  end_at?: string | null;
  scheduled_at?: string | null;
  original_scheduled_at?: string | null;
  match_type?: string | null;
  number_of_games?: number | null;
  tournament?: PandaTournament;
  opponents?: PandaOpponent[];
  results?: PandaMatchResult[];
  league?: PandaLeague;
  serie?: PandaSerie;
  streams_list?: PandaStream[];
  games?: PandaGame[];
  winner_id?: number | null;
  winner?: { id: number; type: string; acronym?: string | null; name?: string | null } | null;
  rescheduled?: boolean;
  live?: {
    supported?: boolean;
    url?: string | null;
    opens_at?: string | null;
  };
  videogame?: PandaVideogame;

  // Liquipedia extra fields
  wiki?: string | null;
  match2id?: string | null;

  // Bracket fields for tournament bracket tree
  section?: string | null;
  match2bracketid?: string | null;
  mvp?: string | null;
  vod?: string | null;
  patch?: string | null;
  links?: Record<string, string>;
}

export interface PandaStream {
  main: boolean;
  language: string;
  embed_url: string;
  official: boolean;
  raw_url: string;
}

export interface PandaTeam {
  id: number;
  name: string;
  slug: string;
  acronym?: string | null;
  image_url?: string | null;
  dark_image_url?: string | null;
  players?: PandaPlayer[];
  location?: string | null;
  template?: string | null;
}

export interface PandaSerie {
  id: number;
  name: string;
  year: number;
  begin_at: string;
  end_at: string;
  winner_id: number | null;
  winner_type: string;
  slug: string;
  modified_at: string;
  league_id: number;
  season: string;
  full_name: string;
}

export interface PandaVideogame {
  id: number;
  name: string;
  slug: string;
}

export interface PandaLeague {
  id: number;
  name: string;
  url: string | null;
  slug: string;
  modified_at: string;
  image_url: string;
}

export interface PandaVideogameTitle {
  id: number;
  name: string;
  slug: string;
  videogame_id: number;
}

export interface PandaExpectedRoster {
  team: PandaTeam;
  players: PandaPlayer[];
}

export interface PandaPlayer {
  id: number;
  name: string;
  slug?: string | null;
  role?: string | null;
  image_url?: string | null;
  active?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  nationality?: string | null;
}

export interface PandaOpponent {
  id: number;
  type: string;
  team?: PandaTeam;
  opponent?: PandaTeam;
}

export interface PandaResult {
  team_id: number;
  score: number;
}

export interface PandaParticipant {
  player: string;
  character?: string | null; // champion / agent / hero
  role?: string | null;
  team?: number; // 1 or 2
  kills?: number | null;
  deaths?: number | null;
  assists?: number | null;
  extra?: Record<string, unknown>; // game-specific: gold, acs, netWorth, items[]...
}

export interface PandaGame {
  complete: boolean;
  id: number;
  position: number;
  status: string;
  length: number | null;
  finished: boolean;
  begin_at: string | null;
  detailed_stats: boolean;
  end_at: string | null;
  forfeit: boolean;
  match_id: number;
  winner_type: string;
  winner: {
    id: number | null;
    type: string;
  };
  map?: string;
  scores?: number[];
  participants?: PandaParticipant[];
  extradata?: Record<string, unknown>;
}

export interface PandaMapPick {
  id: number;
  name: string;
  slug: string;
  videogame_versions: string[];
  image_url: string;
  picking_team_id: number | null;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  age?: number;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
