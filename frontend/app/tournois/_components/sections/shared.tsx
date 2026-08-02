'use client';

import { PandaTournament, PandaMatch, NewsItem } from '../../../types';

export interface MatchDateGroup {
  dateKey: string;
  label: string;
  matches: PandaMatch[];
}

export interface TournamentSectionProps {
  tournament: PandaTournament;
  wiki?: string | null;
  liveMatches: PandaMatch[];
  matchesByDate: MatchDateGroup[];
  totalMatches: number;
  relatedArticles: NewsItem[];
}

/** Group matches by date string (YYYY-MM-DD) preserving order */
export function groupMatchesByDate(matches: PandaMatch[]): MatchDateGroup[] {
  const groups = new Map<string, PandaMatch[]>();
  const order: string[] = [];

  for (const m of matches) {
    const raw = m.begin_at || m.scheduled_at || '';
    let dateKey = 'unknown';
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000) {
        dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
      order.push(dateKey);
    }
    groups.get(dateKey)!.push(m);
  }

  return order.map(dateKey => {
    let label: string;
    if (dateKey === 'unknown') {
      label = 'Date inconnue';
    } else {
      const [y, mo, d] = dateKey.split('-').map(Number);
      const date = new Date(y, mo - 1, d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.getTime() === today.getTime()) {
        label = "Aujourd'hui";
      } else if (date.getTime() === yesterday.getTime()) {
        label = 'Hier';
      } else if (date.getTime() === tomorrow.getTime()) {
        label = 'Demain';
      } else {
        label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
    }
    return { dateKey, label, matches: groups.get(dateKey)! };
  });
}
