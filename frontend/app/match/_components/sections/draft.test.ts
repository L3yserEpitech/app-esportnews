import { describe, it, expect } from 'vitest';
import { parseDraft } from './draft';
import type { PandaGame } from '../../../types';

describe('parseDraft', () => {
  it('reads bans and picks for both teams', () => {
    const game = {
      extradata: { team1bans: 'Yuumi,Kalista', team2bans: 'Zeri,Renata' },
      participants: [
        { player: 'Faker', character: 'Azir', team: 1 },
        { player: 'Chovy', character: 'Orianna', team: 2 },
      ],
    } as unknown as PandaGame;
    const d = parseDraft(game)!;
    expect(d.team1.bans).toEqual(['Yuumi', 'Kalista']);
    expect(d.team1.picks).toEqual(['Azir']);
    expect(d.team2.picks).toEqual(['Orianna']);
  });

  it('returns null when there is no draft data', () => {
    expect(parseDraft({} as PandaGame)).toBeNull();
  });
});
