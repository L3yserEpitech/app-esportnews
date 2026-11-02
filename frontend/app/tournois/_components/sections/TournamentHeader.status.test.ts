import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TournamentHeader from './TournamentHeader';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('../../../hooks/useHydrated', () => ({ useHydrated: () => true }));

const tournament = {
  id: 1,
  name: 'Cup',
  status: 'running',
  begin_at: '2026-11-01T00:00:00Z',
  end_at: '2026-11-10T00:00:00Z',
} as never;

const statusAt = (now: string) => {
  vi.useFakeTimers({ now: new Date(now) });
  return renderToStaticMarkup(createElement(TournamentHeader, { tournament } as never));
};

afterEach(() => vi.useRealTimers());

// end_at is midnight UTC on the last day, and the backend says running all that day.
describe('statut du tournoi une fois hydraté', () => {
  it('reste en cours le jour de la finale', () => {
    expect(statusAt('2026-11-10T00:00:00Z')).toContain('status_running');
    expect(statusAt('2026-11-10T23:59:59Z')).toContain('status_running');
  });

  it('passe à terminé le lendemain à minuit UTC', () => {
    expect(statusAt('2026-11-11T00:00:00Z')).toContain('status_finished');
  });

  it('reste à venir avant le premier jour', () => {
    expect(statusAt('2026-10-31T23:59:59Z')).toContain('status_upcoming');
  });
});
