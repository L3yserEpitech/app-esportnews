import { describe, it, expect } from 'vitest';
import { pastLastmod, uniqueMatches, uniqueTournaments } from './sitemapEntries';

describe('uniqueMatches', () => {
  it('garde tous les matchs d\'un même tournoi, qui partagent leur id', () => {
    const matches = [
      { id: 195739, match2id: 'ABCDEFGHIJ_0001' },
      { id: 195739, match2id: 'ABCDEFGHIJ_0002' },
    ];
    expect(uniqueMatches(matches)).toEqual(matches);
  });

  it('retire un match présent dans deux listes', () => {
    const first = { id: 1, match2id: 'ABCDEFGHIJ_0001', status: 'running' };
    const second = { id: 1, match2id: 'ABCDEFGHIJ_0001', status: 'finished' };
    expect(uniqueMatches([first, second])).toEqual([first]);
  });

  it('retombe sur id quand match2id manque', () => {
    expect(uniqueMatches([{ id: 7 }, { id: 7 }, { id: 8 }])).toEqual([{ id: 7 }, { id: 8 }]);
  });
});

describe('uniqueTournaments', () => {
  it('retire un tournoi présent dans deux listes', () => {
    const t = { id: 1, wiki: 'valorant' };
    expect(uniqueTournaments([t, { ...t }])).toEqual([t]);
  });

  it('garde deux tournois de jeux différents au même pageid', () => {
    const list = [{ id: 1, wiki: 'valorant' }, { id: 1, wiki: 'dota2' }];
    expect(uniqueTournaments(list)).toEqual(list);
  });
});

describe('pastLastmod', () => {
  const now = new Date('2026-11-01T12:00:00Z');

  it('rend une date passée au format ISO', () => {
    expect(pastLastmod('2026-10-15T00:00:00Z', now)).toBe('2026-10-15T00:00:00.000Z');
  });

  it('écarte une date future', () => {
    expect(pastLastmod('2026-11-02T00:00:00Z', now)).toBeNull();
  });

  it('écarte une valeur absente ou illisible', () => {
    expect(pastLastmod(null, now)).toBeNull();
    expect(pastLastmod(undefined, now)).toBeNull();
    expect(pastLastmod('pas une date', now)).toBeNull();
  });
});
