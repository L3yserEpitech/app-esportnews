/**
 * Type definitions for the mobile app
 * Contains shared types and interfaces used across the application
 */

// =====================================================
// Advertisement Types
// =====================================================

/**
 * Advertisement from backend API
 */
export interface Advertisement {
  id: number;
  created_at: string;
  title: string;
  position: number; // 1, 2, or 3
  type: 'image' | 'video';
  url: string; // URL to the ad asset (image or video)
  redirect_link: string; // URL to redirect when clicked
}

// =====================================================
// User Types
// =====================================================

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  admin: boolean;
  favorite_teams?: number[];
  notifi_push?: boolean;
  notif_articles?: boolean;
  notif_news?: boolean;
  notif_matchs?: boolean;
  created_at: string;
}

// =====================================================
// Game Types
// =====================================================

export interface Game {
  id: number;
  name: string;
  acronym: string;
  selected_image: string;
  unselected_image: string;
  full_name?: string;
  created_at: string;
}

// =====================================================
// Article Types
// =====================================================

export interface Article {
  id: number;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  content: string;
  content_black?: string;
  content_white?: string;
  author: string;
  category: string;
  tags: string[];
  featuredImage?: string;
  credit?: string;
  views: number;
  created_at: string;
}

// =====================================================
// Tournament Types
// =====================================================

export interface Tournament {
  id: number;
  panda_id: number;
  name: string;
  slug: string;
  status: 'running' | 'upcoming' | 'finished';
  begin_at: string;
  end_at?: string;
  tier: 's' | 'a' | 'b' | 'c' | 'd';
  prizepool?: string;
  videogame_id?: number;
  raw_data?: any;
}

// =====================================================
// Match Types
// =====================================================

export interface Opponent {
  id?: number;
  name: string;
  acronym?: string;
  image_url?: string;
}

export interface Match {
  id: number;
  panda_id: number;
  name: string;
  status: 'running' | 'upcoming' | 'finished';
  begin_at: string;
  end_at?: string;
  tournament_id?: number;
  live_supported: boolean;
  live_url?: string;
  opponents: Opponent[];
  raw_data?: any;
}

// =====================================================
// Live Match Types (from SportDevs)
// =====================================================

export interface LiveMatch {
  id: string;
  title: string;
  game: string;
  tournament: string;
  teams: {
    home: string;
    away: string;
  };
  stream_url?: string;
  start_time: string;
}
