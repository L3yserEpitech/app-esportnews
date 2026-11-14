import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatchJsonLd, TournamentJsonLd } from './entityJsonLd';

type Node = Record<string, unknown>;

function event(element: ReturnType<typeof createElement>): Node {
  const html = renderToStaticMarkup(element);
  const nodes = [...html.matchAll(/<script[^>]*>(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as Node);
  const found = nodes.find((n) => n['@type'] === 'Event' || n['@type'] === 'SportsEvent');
  if (!found) throw new Error('no event node');
  return found;
}

const URL = 'https://www.esportnews.fr/cs/match/a-vs-b-ZyB9O2XPMD_R05-M001';
const match = {
  wiki: 'counterstrike',
  opponents: [{ opponent: { name: 'A' } }, { opponent: { name: 'B' } }],
  tournament: { name: 'PGL Cluj-Napoca 2027' },
  begin_at: '2026-11-11T18:30:00Z',
  end_at: '2026-11-11T18:30:00Z',
};

// Search Console, 2026-11-11: 1 466 events, none valid, all for a missing location.
describe('event JSON-LD', () => {
  it('gives a match the location Google requires', () => {
    const node = event(createElement(MatchJsonLd, { match, url: URL }));
    expect(node.location).toEqual({ '@type': 'VirtualLocation', url: URL });
    expect(node.eventAttendanceMode).toBe('https://schema.org/OnlineEventAttendanceMode');
    expect(node.eventStatus).toBe('https://schema.org/EventScheduled');
    expect(node).not.toHaveProperty('superEvent');
    expect(node.description).toContain('PGL Cluj-Napoca 2027');
  });

  it('drops an end date that only repeats the start, and an absent image', () => {
    const node = event(createElement(MatchJsonLd, { match, url: URL }));
    expect(node).not.toHaveProperty('endDate');
    expect(node).not.toHaveProperty('image');
  });

  it('reports a moved match with its previous date', () => {
    const moved = { ...match, rescheduled: true, original_scheduled_at: '2026-11-10T18:30:00Z' };
    const node = event(createElement(MatchJsonLd, { match: moved, url: URL }));
    expect(node.eventStatus).toBe('https://schema.org/EventRescheduled');
    expect(node.previousStartDate).toBe('2026-11-10T18:30:00Z');
  });

  it('keeps the prize pool out of offers and gives an on-site tournament its venues', () => {
    const tournament = {
      name: 'Worlds',
      type: 'Offline',
      prizepool: '$100,000',
      begin_at: '2026-10-15T00:00:00Z',
      venues: [
        { name: 'Riot Games Arena', city: 'Los Angeles', country: 'us' },
        { name: 'Barclays Center', city: 'New York City', country: 'us' },
      ],
    };
    const node = event(createElement(TournamentJsonLd, { tournament, url: URL, image: 'https://x/y.png' }));
    expect(node).not.toHaveProperty('offers');
    expect(node.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode');
    expect(node.location).toEqual([
      {
        '@type': 'Place',
        name: 'Riot Games Arena',
        address: { '@type': 'PostalAddress', addressLocality: 'Los Angeles', addressCountry: 'US' },
      },
      {
        '@type': 'Place',
        name: 'Barclays Center',
        address: { '@type': 'PostalAddress', addressLocality: 'New York City', addressCountry: 'US' },
      },
    ]);
    expect(node.image).toEqual(['https://x/y.png']);
  });

  // Google reported "location missing" on an on-site event with only a virtual place.
  it('never declares an on-site event without its venue', () => {
    const offlineUnknown = { name: 'LAN', type: 'Offline', begin_at: '2026-10-15T00:00:00Z' };
    const node = event(createElement(TournamentJsonLd, { tournament: offlineUnknown, url: URL }));
    expect(node.eventAttendanceMode).toBe('https://schema.org/OnlineEventAttendanceMode');
    expect(node.location).toEqual({ '@type': 'VirtualLocation', url: URL });
  });

  it('ignores venues of an online tournament', () => {
    const online = { name: 'Cup', type: 'Online', venues: [{ city: 'Paris', country: 'fr' }] };
    const node = event(createElement(TournamentJsonLd, { tournament: online, url: URL }));
    expect(node.location).toEqual({ '@type': 'VirtualLocation', url: URL });
  });
});
