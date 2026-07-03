import { describe, it, expect } from 'vitest';
import { csMapImage, flattenVeto } from './csAssets';

describe('csMapImage', () => {
  it('maps known names and falls back to de_<slug>', () => {
    expect(csMapImage('Mirage')).toContain('de_mirage.png');
    expect(csMapImage('Dust2')).toContain('de_dust2.png');
    expect(csMapImage('Office')).toContain('cs_office.png');
    expect(csMapImage(null)).toBeNull();
  });
});

describe('flattenVeto', () => {
  it('unrolls a standard BO3 veto in order', () => {
    const steps = flattenVeto([
      { type: 'ban', team1: 'Anubis', vetostart: '1', format: 'bo3' },
      { type: 'ban', team2: 'Vertigo' },
      { type: 'pick', team1: 'Mirage' },
      { type: 'pick', team2: 'Inferno' },
      { type: 'ban', team1: 'Nuke' },
      { type: 'ban', team2: 'Ancient' },
      { type: 'decider', decider: 'Dust2' },
    ]);
    expect(steps.map(s => s.map)).toEqual(['Anubis', 'Vertigo', 'Mirage', 'Inferno', 'Nuke', 'Ancient', 'Dust2']);
    expect(steps[0]).toEqual({ map: 'Anubis', type: 'ban', teamIndex: 0 });
    expect(steps[3]).toEqual({ map: 'Inferno', type: 'pick', teamIndex: 1 });
    expect(steps[6]).toEqual({ map: 'Dust2', type: 'decider', teamIndex: null });
  });

  it('splits a round where both teams act', () => {
    const steps = flattenVeto([{ type: 'ban', team1: 'Nuke', team2: 'Ancient' }]);
    expect(steps).toHaveLength(2);
    expect(steps[0].teamIndex).toBe(0);
    expect(steps[1].teamIndex).toBe(1);
  });
});
