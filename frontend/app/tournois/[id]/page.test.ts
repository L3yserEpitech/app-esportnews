import { afterEach, describe, expect, it, vi } from 'vitest';
import LegacyTournamentPage, { generateMetadata } from './page';
import { BROWSER, GOOGLEBOT, stubBackend } from '../../lib/entityPageTestUtils';

let ua = BROWSER;
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': ua }) }));
vi.mock('../_components/TournamentDetailPageClient', () => ({ default: () => null }));

const props = { params: Promise.resolve({ id: '377513' }) };

afterEach(() => { vi.unstubAllGlobals(); ua = BROWSER; });

describe('/tournois/<id> legacy pendant une panne', () => {
  it('répond en 5xx à un moteur de recherche', async () => {
    ua = GOOGLEBOT;
    stubBackend(() => new Response('{}', { status: 503 }));
    const error = await LegacyTournamentPage(props).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(String(error.digest ?? '')).not.toContain('404');
  });

  it('rend la page au visiteur, avec un canonical', async () => {
    stubBackend(() => new Response('{}', { status: 503 }));
    await expect(LegacyTournamentPage(props)).resolves.toBeTruthy();
    expect((await generateMetadata(props)).alternates?.canonical).toBe('https://www.esportnews.fr/tournois/377513');
  });
});
