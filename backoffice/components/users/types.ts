import type { Role } from '@/lib/session';

// Shapes of /api/bo/users (backend-go/internal/backoffice/users*.go).

export type PremiumSource = 'app_store' | 'google_play' | 'stripe' | 'gift';

export interface PremiumState {
  active: boolean;
  source: PremiumSource | null;
  expires_at: string | null;
  gifted: boolean;
  expiring: boolean;
  will_renew: boolean | null;
}

export interface UserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  premium: PremiumState;
  devices: number;
  matches_followed: number;
  tournaments_followed: number;
  created_at: string | null;
  last_seen_at: string | null;
}

export interface DeletedAccount {
  user_id: number;
  registered_at: string | null;
  deleted_at: string;
  deleted_by: string;
  reason: string;
}

export interface UserPage {
  users: UserRow[];
  deleted?: DeletedAccount[];
  total: number;
}

export interface UserStats {
  accounts: number;
  premium_active: number;
  reachable_devices: number;
  signups_28d: number;
}

export interface FavoriteTeam {
  id: number;
  name: string | null;
}

export interface Account {
  id: number;
  email: string;
  name: string;
  avatar: string | null;
  role: Role;
  created_at: string | null;
  last_seen_at: string | null;
  signup_source: string | null;
  age: number | null;
  favorite_teams: FavoriteTeam[];
  sessions: number | null;
}

export interface PremiumDetail extends PremiumState {
  product: string | null;
  transaction: string | null;
  transaction_kind: 'original_transaction' | 'purchase_token' | null;
  last_verified_at: string | null;
  gift_note: string | null;
}

export interface Device {
  id: number;
  platform: string;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface FollowedMatch {
  id: number;
  name: string;
  tournament: string;
  game_acronym: string;
  game: string;
  status: string;
  begin_at: string | null;
  notified_start: boolean;
  origin: 'like' | 'tournament' | 'team';
  created_at: string | null;
}

export interface FollowedTournament {
  id: number;
  name: string;
  game_acronym: string;
  game: string;
  status: string;
  begin_at: string | null;
  end_at: string | null;
  created_at: string | null;
}

export interface FollowLimit {
  used: number;
  limit: number;
}

export interface Follows {
  matches: FollowedMatch[];
  tournaments: FollowedTournament[];
  matches_total: number;
  tournaments_total: number;
  match_limit: FollowLimit;
  tournament_limit: FollowLimit;
  unlimited: boolean;
}

export interface UserDetail {
  user: Account;
  premium: PremiumDetail;
  devices: Device[];
  follows: Follows;
}

// What the dialogs need to know about the account they act on.
export interface UserRef {
  id: number;
  email: string;
  role: Role;
}
