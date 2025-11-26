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
  image_url?: string | null;
  players?: PandaPlayer[];
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
}

// Nouveaux types pour les matchs étendus
export interface PandaOpponent {
  id: number;
  type: string;
  team?: PandaTeam;
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
