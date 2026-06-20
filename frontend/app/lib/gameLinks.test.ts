import { describe, it, expect } from 'vitest';
import { matchHref, tournamentHref } from './gameLinks';

describe('matchHref', () => {
  it('construit /<slug>/match/<match2id> (game-first) quand le wiki est connu', () => {
    expect(matchHref({ wiki: 'counterstrike', match2id: 'ABC_001', id: 42 }))
      .toBe('/cs/match/ABC_001');
  });

  it('préfère match2id à id', () => {
    expect(matchHref({ wiki: 'valorant', match2id: 'X1', id: 99 }))
      .toBe('/valorant/match/X1');
  });

  it('tombe sur id quand match2id est absent', () => {
    expect(matchHref({ wiki: 'valorant', id: 99 })).toBe('/valorant/match/99');
  });

  it('fallback legacy /match/<id> quand le wiki est inconnu/absent', () => {
    expect(matchHref({ id: 7 })).toBe('/match/7');
    expect(matchHref({ wiki: 'unknownwiki', id: 7 })).toBe('/match/7');
  });
});

describe('tournamentHref', () => {
  it('construit /<slug>/tournois/<id> (game-first) quand le wiki est connu', () => {
    expect(tournamentHref({ wiki: 'rainbowsix', id: 123 }))
      .toBe('/r6/tournois/123');
  });

  it('fallback legacy /tournois/<id> quand le wiki est inconnu/absent', () => {
    expect(tournamentHref({ id: 5 })).toBe('/tournois/5');
  });
});
