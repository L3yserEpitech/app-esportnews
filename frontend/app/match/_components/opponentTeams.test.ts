import { describe, it, expect, vi } from 'vitest';
import { loadOpponentTeams, type TeamLookup } from './opponentTeams';
import type { PandaOpponent } from '../../types';

const opponent = (fields: Partial<PandaOpponent['opponent']>): PandaOpponent =>
  ({ type: 'Team', opponent: { id: 1, name: '', slug: '', ...fields } }) as PandaOpponent;

describe('loadOpponentTeams', () => {
  it('resolves each opponent with ONE lookup carrying template and name', async () => {
    const lookup: TeamLookup = vi.fn(async (template) => ({ id: 7, name: template }) as never);
    const teams = await loadOpponentTeams(
      [opponent({ template: 'faze', name: 'FaZe Clan' }), opponent({ template: 'vitality', name: 'Team Vitality' })],
      'counterstrike',
      lookup,
    );
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup).toHaveBeenNthCalledWith(1, 'faze', 'counterstrike', 'FaZe Clan');
    expect(lookup).toHaveBeenNthCalledWith(2, 'vitality', 'counterstrike', 'Team Vitality');
    expect(teams.map((t) => t.name)).toEqual(['faze', 'vitality']);
  });

  it('falls back to the lowercased name as template when the opponent has none', async () => {
    const lookup: TeamLookup = vi.fn(async () => ({ id: 1, name: 'M80' }) as never);
    await loadOpponentTeams([opponent({ name: 'M80 Orig' })], 'counterstrike', lookup);
    expect(lookup).toHaveBeenCalledWith('m80 orig', 'counterstrike', 'M80 Orig');
  });

  it('skips opponents with neither template nor name, and never looks up a hashed id', async () => {
    const lookup: TeamLookup = vi.fn();
    const teams = await loadOpponentTeams([opponent({ id: 2532014407522215000 })], 'counterstrike', lookup);
    expect(lookup).not.toHaveBeenCalled();
    expect(teams).toEqual([]);
  });

  it('drops opponents whose lookup fails and keeps the others in order', async () => {
    const lookup: TeamLookup = vi.fn(async (template) => {
      if (template === 'ghost') throw new Error('404');
      return { id: 3, name: template } as never;
    });
    const teams = await loadOpponentTeams(
      [opponent({ template: 'ghost', name: 'Ghost' }), opponent({ template: 'navi', name: 'NAVI' })],
      'counterstrike',
      lookup,
    );
    expect(teams.map((t) => t.name)).toEqual(['navi']);
  });

  it('skips 1v1 opponents, which have no team page', async () => {
    const lookup: TeamLookup = vi.fn();
    const solo = { ...opponent({ template: 'player1', name: 'Player One' }), type: 'solo' };
    expect(await loadOpponentTeams([solo], 'easportsfc', lookup)).toEqual([]);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('does nothing without a wiki', async () => {
    const lookup: TeamLookup = vi.fn();
    expect(await loadOpponentTeams([opponent({ template: 'faze', name: 'FaZe' })], undefined, lookup)).toEqual([]);
    expect(lookup).not.toHaveBeenCalled();
  });
});
