import { afterEach, describe, expect, it, vi } from 'vitest';
import TournamentDetailPage, { generateMetadata } from './page';
import { BROWSER, GOOGLEBOT, notFoundDigest, stubBackend } from '../../../lib/entityPageTestUtils';

let ua = BROWSER;
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': ua }) }));
vi.mock('../../../tournois/_components/TournamentDetailPageClient', () => ({ default: () => null }));
vi.mock('../../../components/seo/entityJsonLd', () => ({ TournamentJsonLd: () => null }));

const props = (id: string) => ({ params: Promise.resolve({ game: 'cs', id }) });
const SEGMENT = 'blast-frequent-flyers-program-2026-377513';

afterEach(() => { vi.unstubAllGlobals(); ua = BROWSER; });

describe('tournoi pendant une panne du backend', () => {
  it('garde le canonical de l\'URL demandée et un titre tiré du segment', async () => {
    stubBackend(() => new Response('{}', { status: 503 }));
    const metadata = await generateMetadata(props(SEGMENT));
    expect(metadata.title).toBe('Blast Frequent Flyers Program 2026 – Tournoi | Esport News');
    expect(metadata.alternates?.canonical).toBe(`https://www.esportnews.fr/cs/tournois/${SEGMENT}`);
  });

  it('ne devine pas de titre sur un id nu', async () => {
    stubBackend(() => new Response('{}', { status: 503 }));
    const metadata = await generateMetadata(props('377513'));
    expect(metadata.title).toBe('Tournoi | Esport News');
    expect(metadata.alternates?.canonical).toBe('https://www.esportnews.fr/cs/tournois/377513');
  });

  it('rend la page au visiteur', async () => {
    stubBackend(() => new Response('{}', { status: 503 }));
    await expect(TournamentDetailPage(props(SEGMENT))).resolves.toBeTruthy();
  });

  it('répond en 5xx à un robot', async () => {
    ua = GOOGLEBOT;
    stubBackend(() => new Response('{}', { status: 503 }));
    const error = await TournamentDetailPage(props(SEGMENT)).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(String(error.digest ?? '')).not.toContain('404');
  });

  it('reste un vrai 404 quand le backend confirme l\'absence', async () => {
    stubBackend(() => new Response('{}', { status: 404 }));
    await expect(TournamentDetailPage(props(SEGMENT))).rejects.toEqual(notFoundDigest);
  });
});
