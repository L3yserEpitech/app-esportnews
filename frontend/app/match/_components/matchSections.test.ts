import { describe, it, expect } from 'vitest';
import { resolveSections, SECTION_IDS } from './matchSections';

describe('resolveSections', () => {
  // LoL, Valorant et Dota rendent draft et stats à l'intérieur de gameResults,
  // par map : pas de sections séparées, contrairement au preset tier1.
  it('gives LoL its own preset — draft and stats live inside gameResults', () => {
    const s = resolveSections('leagueoflegends', false);
    expect(s).toContain('header');
    expect(s).toContain('gameResults');
    expect(s).not.toContain('draft');
    expect(s).not.toContain('playerStats');
  });

  it('falls back to default (no draft/playerStats) for an unmapped wiki', () => {
    const s = resolveSections('counterstrike', false);
    expect(s).not.toContain('draft');
    expect(s).not.toContain('playerStats');
    expect(s[0]).toBe('header');
  });

  it('promotes stream to index 1 when live', () => {
    const live = resolveSections('leagueoflegends', true);
    expect(live[1]).toBe('stream');
    const notLive = resolveSections('leagueoflegends', false);
    expect(notLive[1]).not.toBe('stream');
  });

  it('only references known section ids', () => {
    for (const id of resolveSections('leagueoflegends', true)) {
      expect(SECTION_IDS).toContain(id);
    }
  });
});
