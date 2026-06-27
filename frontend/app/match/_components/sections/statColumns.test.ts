import { describe, it, expect } from 'vitest';
import { getStatColumns, buildPlayerRows } from './statColumns';
import type { PandaGame } from '../../../types';

describe('getStatColumns', () => {
  it('returns LoL columns', () => {
    const cols = getStatColumns('leagueoflegends');
    expect(cols.map(c => c.key)).toContain('kda');
    expect(cols.map(c => c.key)).toContain('gold');
  });
  it('returns [] for an unknown wiki', () => {
    expect(getStatColumns('counterstrike')).toEqual([]);
  });
});

describe('buildPlayerRows', () => {
  const game = {
    participants: [
      { player: 'Faker', character: 'Azir', team: 1, kills: 5, deaths: 1, assists: 7, extra: { gold: 12000, cs: 250 } },
      { player: 'Chovy', character: 'Orianna', team: 2, kills: 3, deaths: 2, assists: 4, extra: { gold: 11000, cs: 260 } },
    ],
  } as unknown as PandaGame;

  it('splits rows by team and formats kda', () => {
    const { team1, team2 } = buildPlayerRows(game, 'leagueoflegends');
    expect(team1).toHaveLength(1);
    expect(team2).toHaveLength(1);
    expect(team1[0].cells.kda).toBe('5 / 1 / 7');
    expect(team1[0].cells.gold).toBe('12.0k');
  });

  it('returns empty teams when no participants', () => {
    const { team1, team2 } = buildPlayerRows({} as PandaGame, 'leagueoflegends');
    expect(team1).toEqual([]);
    expect(team2).toEqual([]);
  });
});
