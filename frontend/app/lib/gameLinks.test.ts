import { describe, it, expect } from 'vitest';
import { matchHref, tournamentHref } from './gameLinks';

describe('matchHref', () => {
  it('construit /match/<slug>/<match2id> quand le wiki est connu', () => {
    expect(matchHref({ wiki: 'counterstrike', match2id: 'ABC_001', id: 42 }))
      .toBe('/match/cs/ABC_001');
  });

  it('préfère match2id à id', () => {
    expect(matchHref({ wiki: 'valorant', match2id: 'X1', id: 99 }))
      .toBe('/match/valorant/X1');
  });

  it('tombe sur id quand match2id est absent', () => {
    expect(matchHref({ wiki: 'valorant', id: 99 })).toBe('/match/valorant/99');
  });

  it('fallback legacy /match/<id> quand le wiki est inconnu/absent', () => {
    expect(matchHref({ id: 7 })).toBe('/match/7');
    expect(matchHref({ wiki: 'unknownwiki', id: 7 })).toBe('/match/7');
  });
});

describe('tournamentHref', () => {
  it('construit /tournois/<slug>/<id> quand le wiki est connu', () => {
    expect(tournamentHref({ wiki: 'rainbowsix', id: 123 }))
      .toBe('/tournois/r6/123');
  });

  it('fallback legacy /tournois/<id> quand le wiki est inconnu/absent', () => {
    expect(tournamentHref({ id: 5 })).toBe('/tournois/5');
  });
});
