'use client';

import { PandaTournament, PandaMatch, NewsItem } from '../../../types';
import { formatCalendarDate } from '../../../lib/calendarDate';

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

function dayKey(date: Date, timeZone: string | undefined): string {
  const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * Group matches by date string (YYYY-MM-DD) preserving order. relativeLabels off
 * during hydration: "today" depends on a clock the server and the browser may not share.
 */
export function groupMatchesByDate(matches: PandaMatch[], timeZone?: string, relativeLabels = true): MatchDateGroup[] {
  const groups = new Map<string, PandaMatch[]>();
  const order: string[] = [];

  for (const m of matches) {
    const raw = m.begin_at || m.scheduled_at || '';
    let dateKey = 'unknown';
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000) {
        dateKey = dayKey(d, timeZone);
      }
    }
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
      order.push(dateKey);
    }
    groups.get(dateKey)!.push(m);
  }

  const today = dayKey(new Date(), timeZone);
  const shifted = (days: number) => {
    const [y, mo, d] = today.split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
  };

  return order.map(dateKey => {
    let label: string;
    if (dateKey === 'unknown') {
      label = 'Date inconnue';
    } else if (relativeLabels && dateKey === today) {
      label = "Aujourd'hui";
    } else if (relativeLabels && dateKey === shifted(-1)) {
      label = 'Hier';
    } else if (relativeLabels && dateKey === shifted(1)) {
      label = 'Demain';
    } else {
      label = formatCalendarDate(dateKey, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    return { dateKey, label, matches: groups.get(dateKey)! };
  });
}
