import { describe, it, expect } from 'vitest';
import {
  GAMES,
  gameBySlug,
  gameByWiki,
  isValidSlug,
  slugToWiki,
  wikiToSlug,
} from './gameRegistry';

describe('gameRegistry', () => {
  it('contient les 10 jeux', () => {
    expect(GAMES).toHaveLength(10);
  });

  it('a des slugs uniques et des wikis uniques', () => {
    expect(new Set(GAMES.map((g) => g.slug)).size).toBe(10);
    expect(new Set(GAMES.map((g) => g.wiki)).size).toBe(10);
  });

  it('mappe slug -> wiki (slugs SEO propres)', () => {
    expect(slugToWiki('cs')).toBe('counterstrike');
    expect(slugToWiki('cod')).toBe('callofduty');
    expect(slugToWiki('eafc')).toBe('easportsfc');
    expect(slugToWiki('mlbb')).toBe('mobilelegends');
  });

  it('mappe wiki -> slug (réciproque)', () => {
    expect(wikiToSlug('counterstrike')).toBe('cs');
    expect(wikiToSlug('rainbowsix')).toBe('r6');
    expect(wikiToSlug('leagueoflegends')).toBe('lol');
  });

  it('valide les slugs connus et rejette les inconnus', () => {
    expect(isValidSlug('valorant')).toBe(true);
    expect(isValidSlug('wildrift')).toBe(false); // remplacé par mlbb
    expect(isValidSlug('inconnu')).toBe(false);
  });

  it('résout une entrée complète par slug et par wiki', () => {
    expect(gameBySlug('lol')?.name).toBe('League of Legends');
    expect(gameByWiki('valorant')?.acronym).toBe('valorant');
  });

  it('retourne undefined pour les valeurs inconnues', () => {
    expect(gameBySlug('xx')).toBeUndefined();
    expect(slugToWiki('xx')).toBeUndefined();
    expect(wikiToSlug('xx')).toBeUndefined();
  });
});
