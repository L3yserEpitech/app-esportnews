import type { Tone } from '@/components/ui';

export type PushKind = 'article' | 'match' | 'manual';
export type PushAudience = 'all' | 'ios' | 'android';
export type StoreState = 'received' | 'silent' | 'idle';

export interface PushStats {
  reachable: { total: number; ios: number; android: number };
  sent_7d: number;
  delivery_rate_7d: number | null;
  deactivated_7d: number;
}

export interface PushEntry {
  id: number;
  kind: PushKind;
  title: string;
  audience: string;
  sent: number;
  delivered: number | null;
  failed: number;
  receipts_checked_at: string | null;
  created_at: string;
}

export interface PushLog {
  entries: PushEntry[];
  total: number;
}

export interface StoreStatus {
  last_at: string | null;
  status: StoreState;
}

export interface PushStores {
  apple: StoreStatus;
  google: StoreStatus;
}

export interface PushSettings {
  notify_new_article: boolean;
  match_live_alert: boolean;
}

export const KIND_CHIP: Record<PushKind, { label: string; tone: Tone }> = {
  article: { label: 'Article', tone: 'rose' },
  match: { label: 'Match', tone: 'bleu' },
  manual: { label: 'Manuel', tone: 'gris' },
};

export const AUDIENCES: { value: PushAudience; label: string }[] = [
  { value: 'all', label: 'Tous les appareils' },
  { value: 'ios', label: 'iOS seulement' },
  { value: 'android', label: 'Android seulement' },
];

// Same limits as validateManualPush in backend-go/internal/backoffice/push.go.
export const MAX_PUSH_TITLE = 65;
export const MAX_PUSH_BODY = 178;

export const devices = (n: number) => `${n.toLocaleString('fr-FR')} ${n > 1 ? 'appareils' : 'appareil'}`;
