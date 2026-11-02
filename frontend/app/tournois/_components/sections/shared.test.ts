import { afterEach, describe, expect, it, vi } from 'vitest';
import { groupMatchesByDate } from './shared';
import type { PandaMatch } from '../../../types';

const match = (begin_at: string) => ({ begin_at }) as unknown as PandaMatch;

afterEach(() => vi.useRealTimers());

describe('groupes de matchs par jour', () => {
  it('range un match de la nuit dans le jour du fuseau demandé', () => {
    const late = match('2026-11-10T23:30:00Z');

    expect(groupMatchesByDate([late], 'Europe/Paris')[0].dateKey).toBe('2026-11-11');
    expect(groupMatchesByDate([late], 'America/New_York')[0].dateKey).toBe('2026-11-10');
  });

  it('écrit le jour en toutes lettres', () => {
    vi.useFakeTimers({ now: new Date('2026-11-01T12:00:00Z') });

    expect(groupMatchesByDate([match('2026-11-10T12:00:00Z')], 'Europe/Paris')[0].label).toBe('Mardi 10 novembre 2026');
  });

  it('compare aujourd\'hui, hier et demain dans le fuseau demandé', () => {
    // 23:30 UTC: already the 2nd in Paris, still the 1st in New York.
    vi.useFakeTimers({ now: new Date('2026-11-01T23:30:00Z') });
    const groups = (tz: string) => groupMatchesByDate([match('2026-11-02T10:00:00Z')], tz)[0].label;

    expect(groups('Europe/Paris')).toBe("Aujourd'hui");
    expect(groups('America/New_York')).toBe('Demain');
  });

  // The server and the browser may not agree on the day (midnight, a wrong clock).
  it('n\'écrit aujourd\'hui ni demain tant que la page s\'hydrate', () => {
    vi.useFakeTimers({ now: new Date('2026-11-02T10:00:00Z') });

    expect(groupMatchesByDate([match('2026-11-02T10:00:00Z')], 'Europe/Paris', false)[0].label).toBe('Lundi 2 novembre 2026');
  });

  it('garde les matchs sans date à part', () => {
    expect(groupMatchesByDate([match('')], 'Europe/Paris')[0].label).toBe('Date inconnue');
  });
});
