// match.id is the page id of the tournament, shared by all its matches (up to 73
// measured): only match2id tells two matches apart.
export function uniqueMatches<T extends { id: number | string; match2id?: string | null }>(matches: T[]): T[] {
  const seen = new Set<string>();
  return matches.filter((m) => {
    const key = m.match2id || String(m.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// A page id is only unique within its wiki.
export function uniqueTournaments<T extends { id: number | string; wiki?: string | null }>(tournaments: T[]): T[] {
  const seen = new Set<string>();
  return tournaments.filter((t) => {
    const key = `${t.wiki}:${t.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Google ignores lastmod on a site where it proves inaccurate, and a page cannot
// have been modified in the future: an upcoming date is left out, not clamped.
// Liquipedia's placeholder for an unknown date is year 0000, which Search
// Console reports as an invalid date (3 tournaments on 2026-11-11).
export function pastLastmod(value: string | null | undefined, now: Date = new Date()): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date > now || date.getUTCFullYear() < 2000) return null;
  return date.toISOString();
}
