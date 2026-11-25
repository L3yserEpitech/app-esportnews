import type { Tone } from '@/components/ui';
import { dayTime } from '@/lib/format';

export type SpotMode = 'adsense' | 'custom' | 'off';
export type MediaType = 'image' | 'video';

export interface Spot {
  key: string;
  label: string;
  format: string;
  placement: string;
  sort: number;
  mode: SpotMode;
  effective_mode: SpotMode;
  adsense_slot: string;
  title: string;
  media_url: string;
  media_type: MediaType;
  redirect_link: string;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
  updated_by: string;
  builtin: boolean;
}

// What the team reads on a spot: the chosen mode, crossed with its date window.
export type SpotState = 'adsense' | 'custom' | 'scheduled' | 'ended' | 'off';

export function spotState(spot: Pick<Spot, 'mode' | 'starts_at' | 'ends_at'>, now = Date.now()): SpotState {
  if (spot.mode !== 'custom') return spot.mode;
  if (spot.starts_at && new Date(spot.starts_at).getTime() > now) return 'scheduled';
  if (spot.ends_at && new Date(spot.ends_at).getTime() <= now) return 'ended';
  return 'custom';
}

export const STATE_CHIP: Record<SpotState, { label: string; tone: Tone }> = {
  adsense: { label: 'Régie', tone: 'gris' },
  custom: { label: 'Bannière perso', tone: 'rose' },
  scheduled: { label: 'Programmée', tone: 'bleu' },
  ended: { label: 'Terminée', tone: 'gris' },
  off: { label: 'Masqué', tone: 'ambre' },
};

// « Du 1 déc. à 09:00 au 24 déc. à 23:59 », or one side only.
export function windowText(spot: Pick<Spot, 'starts_at' | 'ends_at'>): string {
  if (spot.starts_at && spot.ends_at) return `Du ${dayTime(spot.starts_at)} au ${dayTime(spot.ends_at)}`;
  if (spot.starts_at) return `À partir du ${dayTime(spot.starts_at)}`;
  if (spot.ends_at) return `Jusqu'au ${dayTime(spot.ends_at)}`;
  return '';
}

export function parseFormat(format: string): { width: number; height: number } {
  const m = /^(\d{2,4})x(\d{2,4})$/.exec(format);
  if (!m) return { width: 300, height: 250 };
  return { width: Number(m[1]), height: Number(m[2]) };
}

// The largest box of the spot's ratio that fits in maxWidth × maxHeight.
export function fitFormat(format: string, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const { width, height } = parseFormat(format);
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const pad = (n: number) => String(n).padStart(2, '0');

// <input type="datetime-local"> speaks local time without a zone.
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isHttpsUrl(value: string): boolean {
  if (/\s/.test(value)) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.host !== '';
  } catch {
    return false;
  }
}

export const KEY_PATTERN = /^[a-z0-9-]{2,40}$/;
export const FORMAT_PATTERN = /^\d{2,4}x\d{2,4}$/;
export const SLOT_PATTERN = /^\d{4,20}$/;
