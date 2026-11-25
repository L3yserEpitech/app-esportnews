// French formatting used across the back-office. Everything is rendered on the
// client (the app sits behind a login), so the browser's time zone applies.

const nf = new Intl.NumberFormat('fr-FR');
const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : nf.format(n));
export const dec1 = (n: number | null | undefined) => (n === null || n === undefined ? '—' : nf1.format(n));
export const pct = (ratio: number | null | undefined) =>
  ratio === null || ratio === undefined ? '—' : `${nf1.format(ratio * 100)} %`;

// 1 900 000 → « 1,9 M », 4 200 → « 4 200 ».
export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1_000_000) return `${nf1.format(n / 1_000_000)} M`;
  return nf.format(n);
}

export function bytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1024 ** 3) return `${nf1.format(n / 1024 ** 3)} Go`;
  if (n >= 1024 ** 2) return `${nf.format(Math.round(n / 1024 ** 2))} Mo`;
  if (n >= 1024) return `${nf.format(Math.round(n / 1024))} Ko`;
  return `${n} o`;
}

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d;
}

const shortDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fullDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const clock = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

// « 18 nov. » this year, « 3 mars 2025 » otherwise.
export function day(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  return d.getFullYear() === new Date().getFullYear() ? shortDay.format(d) : fullDay.format(d);
}

export function dayYear(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  return d ? fullDay.format(d) : '—';
}

export function time(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  return d ? clock.format(d) : '—';
}

// « 18 nov. à 14:02 »
export function dayTime(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  return d ? `${day(d)} à ${clock.format(d)}` : '—';
}

// « Mardi 18 novembre »
export function dayHeading(v: string | number | Date): string {
  const d = toDate(v);
  if (!d) return '';
  const s = longDay.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dayKey(v: string | number | Date): string {
  const d = toDate(v);
  if (!d) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// « à l'instant », « il y a 3 min », « hier », « il y a 12 j », then the date.
export function ago(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 0) return dayTime(d);
  if (s < 45) return "à l'instant";
  if (s < 90) return 'il y a 1 min';
  const min = Math.round(s / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return 'hier';
  if (days < 31) return `il y a ${days} j`;
  return day(d);
}

// « dans 2 j », « dans 5 h » for deadlines.
export function until(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '—';
  const s = Math.round((d.getTime() - Date.now()) / 1000);
  if (s <= 0) return 'dépassé';
  const h = Math.round(s / 3600);
  if (h < 1) return `dans ${Math.max(1, Math.round(s / 60))} min`;
  if (h < 48) return `dans ${h} h`;
  return `dans ${Math.round(h / 24)} j`;
}

export function initials(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/[\s.@_-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Signed variation between two periods, as the KPI tiles show it.
export function delta(current: number, previous: number): { text: string; up: boolean } | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  const ratio = (current - previous) / previous;
  return { text: `${ratio >= 0 ? '↗' : '↘'} ${nf1.format(Math.abs(ratio) * 100)} %`, up: ratio >= 0 };
}

export function plural(n: number, one: string, many: string): string {
  return `${num(n)} ${n > 1 ? many : one}`;
}
