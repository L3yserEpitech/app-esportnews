import { useEffect, useState } from 'react';

// The health screen counts in seconds (« il y a 40 s »), where the rest of the
// back-office rounds to « à l'instant »: a webhook 40 seconds old and one
// 4 minutes old do not say the same thing.
export function since(iso: string | null | undefined, now: number): string {
  if (!iso) return '—';
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return '—';
  const s = Math.floor((now - at) / 1000);
  if (s < 1) return "à l'instant";
  if (s < 60) return `il y a ${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

// « 22 min », « 3 h »: the age shown in the « Expirée » chip.
export function age(iso: string, now: number): string {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  return min < 120 ? `${min} min` : `${Math.floor(min / 60)} h`;
}

// Re-renders on a timer so relative times keep moving between two fetches.
export function useNow(everyMs = 10_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}
