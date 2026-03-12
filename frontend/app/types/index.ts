// Game types
export interface Game {
  id: number;
  created_at: string;
  name: string;
  acronym: string;
  selected_image: string; // URL de l'image sélectionnée
  unselected_image: string; // URL de l'image non sélectionnée
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

// News & Articles types (Supabase structure)
export interface NewsItem {
  id: number;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  author: string;
  created_at: string;
  readTime?: number; // Calculé côté client si nécessaire
  featuredImage: string;
  category: string;
  credit?: string;
  tags: string[];
  views: number;
  videoUrl?: string; // URL de la vidéo de couverture (YouTube, Vimeo, ou MP4)
  videoType?: 'youtube' | 'vimeo' | 'mp4'; // Type de vidéo
}

export interface Article extends NewsItem {
  content: string;
  content_black?: string;
  content_white?: string;
}

// Type pour la réponse directe de Supabase
export interface SupabaseArticle {
  id: number;
  created_at: string;
  slug: string;
  tags: string[];
  title: string;
  views: number;
  author: string;
  content: string;
  category: string;
  credit?: string;
  subtitle: string;
  description: string;
  content_black: string;
  content_white: string;
  featuredImage: string;
  videoUrl?: string;
  videoType?: 'youtube' | 'vimeo' | 'mp4';
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
  notifi_push?: boolean;
  notif_articles?: boolean;
  notif_news?: boolean;
  notif_matchs?: boolean;
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

// Tournament types (PandaScore) - Go Backend Compatible
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
  role?: string | null;
  image_url?: string | null;
  active?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  nationality?: string | null;
}

// Nouveaux types pour les matchs étendus
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
}

export interface PandaMapPick {
  id: number;
  name: string;
  slug: string;
  videogame_versions: string[];
  image_url: string;
  picking_team_id: number | null;
}
