import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import TournamentMatchCard from '../components/tournaments/TournamentMatchCard';
import TournamentHeader from '../tournois/_components/sections/TournamentHeader';
import MatchHeader from '../match/_components/sections/MatchHeader';
import MatchPageClient from '../match/MatchPageClient';
import TournamentsPageClient from '../tournois/TournamentsPageClient';
import PlayerDetailPageClient from '../joueur/_components/PlayerDetailPageClient';
import TeamDetailPageClient from '../equipe/_components/TeamDetailPageClient';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'fr' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));
vi.mock('../contexts/GameContext', () => ({
  useGame: () => ({
    selectedGame: null,
    games: [],
    isLoadingGames: true,
    setSelectedGame: () => {},
    getSelectedGameData: () => null,
  }),
}));
vi.mock('flag-icons/css/flag-icons.min.css', () => ({}));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: () => {} }) }));
vi.mock('../components/ads/AdColumn', () => ({ default: () => null }));
vi.mock('../components/games/GameSelector', () => ({ default: () => null }));
vi.mock('../hooks/useIsDarkTheme', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useIsDarkTheme: () => true,
}));

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
  vi.useRealTimers();
});

function htmlIn(timeZone: string, element: () => React.ReactElement): string {
  process.env.TZ = timeZone;
  return renderToString(element());
}

const opponent = (id: number, name: string) => ({ type: 'team', opponent: { id, name, acronym: name, template: name, image_url: '' } });
const match = {
  id: 1,
  match2id: 'aB3dE5fG7h_0001',
  wiki: 'counterstrike',
  status: 'not_started',
  begin_at: '2026-11-10T23:30:00Z',
  number_of_games: 3,
  opponents: [opponent(1, 'Alpha'), opponent(2, 'Beta')],
  results: [],
  games: [],
  streams_list: [],
  league: { name: 'Cup' },
  tournament: { name: 'Cup' },
  videogame: { id: 1, name: 'CS2', slug: 'cs2' },
} as never;
const tournament = {
  id: 1,
  name: 'Cup',
  wiki: 'counterstrike',
  begin_at: '2026-11-10T23:30:00Z',
  end_at: '2026-11-20T23:30:00Z',
  videogame: { id: 1, name: 'CS2', slug: 'cs2' },
} as never;

// The server renders in UTC on Vercel, the browser in the visitor's zone. What the
// first client render shows must be what the server sent, whatever the two zones.
describe('rendu serveur indépendant du fuseau', () => {
  it('carte de match', () => {
    const card = () => createElement(TournamentMatchCard, { match });
    expect(htmlIn('UTC', card)).toBe(htmlIn('America/New_York', card));
  });

  it('en-tête de tournoi', () => {
    const header = () => createElement(TournamentHeader, { tournament } as never);
    expect(htmlIn('UTC', header)).toBe(htmlIn('Asia/Tokyo', header));
  });

  it('en-tête de match', () => {
    const header = () => createElement(MatchHeader, { match, games: [] } as never);
    expect(htmlIn('UTC', header)).toBe(htmlIn('America/New_York', header));
  });
});

// A Liquipedia date without a zone read as local time shifted with the zone, and
// a date at midnight UTC gave the year before in Los Angeles.
describe('dates sans fuseau', () => {
  it('transferts sur la fiche joueur', () => {
    const player = {
      id: 'ZywOo',
      name: 'Mathieu',
      nationalities: [],
      transfers: [
        { date: '2018-10-08 00:00:00', from_team: 'A', to_team: 'B' },
        { date: '2018-10-01 23:30:00', from_team: 'B', to_team: 'C' },
      ],
    } as never;
    const page = () => createElement(PlayerDetailPageClient, { pagename: 'ZywOo', wiki: 'counterstrike', initialPlayer: player });
    const utc = htmlIn('UTC', page);

    expect(utc).toBe(htmlIn('Asia/Tokyo', page));
    expect(utc).toBe(htmlIn('Europe/Helsinki', page));
    expect(utc).toContain('08 oct. 2018');
    expect(utc).toContain('01 oct. 2018');
  });

  it('année de fondation sur la fiche équipe', () => {
    const team = { id: 1, name: 'Team', template: 'team', create_date: '2018-01-01', players: [], wiki: 'counterstrike' } as never;
    const page = () => createElement(TeamDetailPageClient, { teamId: 'team', wiki: 'counterstrike', initialTeam: team });
    const utc = htmlIn('UTC', page);

    expect(utc).toBe(htmlIn('America/Los_Angeles', page));
    expect(utc).toMatch(/Fondée en (<!-- -->)?2018/);
  });
});

// /match and /tournois are static: their HTML holds the day of the deployment.
describe('pages statiques sans la date du build', () => {
  const dayOf = (now: string, element: () => React.ReactElement) => {
    vi.useFakeTimers({ now: new Date(now) });
    const html = renderToString(element());
    vi.useRealTimers();
    return html;
  };

  it('/match', () => {
    const page = () => createElement(MatchPageClient);
    expect(dayOf('2026-11-01T12:00:00Z', page)).toBe(dayOf('2026-12-25T12:00:00Z', page));
  });

  it('/tournois', () => {
    const page = () => createElement(TournamentsPageClient);
    expect(dayOf('2026-11-01T12:00:00Z', page)).toBe(dayOf('2026-12-25T12:00:00Z', page));
  });
});

describe('rendu serveur indépendant de l\'horloge', () => {
  const at = (now: string, element: () => React.ReactElement) => {
    vi.useFakeTimers({ now: new Date(now) });
    const html = renderToString(element());
    vi.useRealTimers();
    return html;
  };

  it('en-tête de tournoi : le statut vient du backend tant que la page s\'hydrate', () => {
    const live = { ...(tournament as object), status: 'running' } as never;
    const header = () => createElement(TournamentHeader, { tournament: live } as never);

    expect(at('2026-11-12T12:00:00Z', header)).toBe(at('2027-03-01T12:00:00Z', header));
  });
});
