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

// Tournament types (PandaScore)
export interface PandaTournament {
  id: number;
  name: string;
  type: string;
  matches: PandaMatch[];
  country: string;
  begin_at: string;
  detailed_stats: boolean;
  end_at: string | null;
  winner_id: number | null;
  winner_type: string;
  teams: PandaTeam[];
  slug: string;
  serie_id: number;
  serie: PandaSerie;
  modified_at: string;
  videogame: PandaVideogame;
  league_id: number;
  league: PandaLeague;
  has_bracket: boolean;
  prizepool: string | null;
  region: string;
  tier: 's' | 'a' | 'b' | 'c' | 'd';
  videogame_title: PandaVideogameTitle;
  live_supported: boolean;
  expected_roster: PandaExpectedRoster[];
  gameSlug?: string; // Ajouté par le backend pour identifier le jeu
}

export interface PandaMatch {
  id: number;
  name: string;
  status: string;
  live: {
    supported: boolean;
    url: string | null;
    opens_at: string | null;
  };
  begin_at: string;
  detailed_stats: boolean;
  end_at: string | null;
  forfeit: boolean;
  winner_id: number | null;
  winner_type: string;
  draw: boolean;
  slug: string;
  modified_at: string;
  tournament_id: number;
  match_type: string;
  number_of_games: number;
  scheduled_at: string;
  original_scheduled_at: string;
  game_advantage: any | null;
  streams_list: PandaStream[];
  rescheduled: boolean;
  // Nouvelles propriétés étendues de l'API
  tournament?: PandaTournament;
  league?: PandaLeague;
  serie?: PandaSerie;
  videogame?: PandaVideogame;
  opponents?: PandaOpponent[];
  results?: PandaResult[];
  games?: PandaGame[];
  map_picks?: PandaMapPick[];
  winner?: PandaTeam | null;
  videogame_version?: {
    name: string;
    current: boolean;
  };
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
  location: string;
  slug: string;
  modified_at: string;
  acronym: string | null;
  image_url: string;
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
  active: boolean;
  id: number;
  name: string;
  role: string | null;
  slug: string;
  modified_at: string;
  age: number | null;
  birthday: string | null;
  first_name: string | null;
  last_name: string | null;
  nationality: string;
  image_url: string | null;
}

// Nouveaux types pour les matchs étendus
export interface PandaOpponent {
  type: string;
  opponent: PandaTeam;
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
