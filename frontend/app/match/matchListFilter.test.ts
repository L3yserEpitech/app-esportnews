import { describe, expect, it } from 'vitest';
import { matchesForLocalDate } from './matchListFilter';

const match = (game: string, beginAt: string, home = 'A', away = 'B') => ({
  begin_at: beginAt,
  videogame: { name: game },
  opponents: [{ opponent: { name: home } }, { opponent: { name: away } }],
});
const toLocalDate = (date: Date) => date.toISOString().slice(0, 10);

describe('matchesForLocalDate', () => {
  it('garde Mobile Legends, 10e jeu du site', () => {
    const mlbb = match('Mobile Legends', '2026-11-01T10:00:00Z');

    expect(matchesForLocalDate([mlbb], '2026-11-01', toLocalDate)).toEqual([mlbb]);
  });

  it('retire un match sans ses deux équipes', () => {
    const tbd = match('CS2', '2026-11-01T10:00:00Z', 'A', '');

    expect(matchesForLocalDate([tbd], '2026-11-01', toLocalDate)).toEqual([]);
  });

  it("retire un match d'un autre jour local", () => {
    const otherDay = match('CS2', '2026-11-02T10:00:00Z');

    expect(matchesForLocalDate([otherDay], '2026-11-01', toLocalDate)).toEqual([]);
  });

  it('garde un match sans date', () => {
    const undated = { ...match('CS2', ''), begin_at: null };

    expect(matchesForLocalDate([undated], '2026-11-01', toLocalDate)).toEqual([undated]);
  });
});
