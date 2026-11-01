interface FilterableMatch {
  begin_at?: string | null;
  scheduled_at?: string | null;
  opponents?: Array<{ opponent?: { name?: string | null } | null }> | null;
}

// Keeps the matches of the calendar's local day that have both teams. A match
// with no date yet stays listed.
export function matchesForLocalDate<T extends FilterableMatch>(
  matches: T[],
  selectedDate: string,
  toLocalDate: (date: Date) => string,
): T[] {
  return matches.filter((match) => {
    if (!match.opponents?.[0]?.opponent?.name || !match.opponents?.[1]?.opponent?.name) return false;

    const rawDate = match.begin_at || match.scheduled_at;
    return !rawDate || toLocalDate(new Date(rawDate)) === selectedDate;
  });
}
