import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import JeuPage from './page';

const match = (match2id: string, home: string, away: string) => ({
  id: 370157,
  match2id,
  wiki: 'counterstrike',
  opponents: [{ opponent: { name: home } }, { opponent: { name: away } }],
});

function stubBackend(upcoming: unknown[]) {
  vi.stubGlobal('fetch', async (url: string) => {
    const path = String(url);
    if (path.includes('/api/games/acronym/')) {
      return Response.json({ id: 3, name: 'Counter-Strike 2', acronym: 'csgo' });
    }
    return Response.json(path.includes('/api/matches/upcoming') ? upcoming : []);
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('page jeu', () => {
  it('lie chaque match, pas le pageid que ses matchs partagent', async () => {
    stubBackend([
      match('2CV5lDzur9_R01-M001', 'Legacy', 'The MongolZ'),
      match('2CV5lDzur9_R01-M002', 'HEROIC', 'B8'),
    ]);

    const html = renderToStaticMarkup(await JeuPage({ params: Promise.resolve({ game: 'csgo' }) }));

    expect(html).toContain('href="/cs/match/legacy-vs-the-mongolz-2CV5lDzur9_R01-M001"');
    expect(html).toContain('href="/cs/match/heroic-vs-b8-2CV5lDzur9_R01-M002"');
    expect(html).not.toContain('href="/match/370157"');
  });
});
