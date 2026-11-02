import { afterEach, describe, expect, it, vi } from 'vitest';
import MatchDetailPage, { generateMetadata } from './page';
import { BROWSER, GOOGLEBOT, notFoundDigest, stubBackend } from '../../../lib/entityPageTestUtils';

let ua = BROWSER;
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': ua }) }));
vi.mock('../../../match/_components/MatchDetailPageClient', () => ({ default: () => null }));
vi.mock('../../../components/seo/entityJsonLd', () => ({ MatchJsonLd: () => null }));

const props = (id: string) => ({ params: Promise.resolve({ game: 'mlbb', id }) });
const SEGMENT = 'vendetta-vs-lyon-AMERS2NHPL_R04-M001';

afterEach(() => { vi.unstubAllGlobals(); ua = BROWSER; });

describe('match pendant une panne du backend', () => {
  it('garde le canonical de l\'URL demandée et un titre tiré du segment', async () => {
    stubBackend(() => new Response('{}', { status: 503 }));
    const metadata = await generateMetadata(props(SEGMENT));
    expect(metadata.title).toBe('Vendetta vs Lyon | Esport News');
    expect(metadata.alternates?.canonical).toBe(`https://www.esportnews.fr/mlbb/match/${SEGMENT}`);
  });

  it('ne devine pas de titre sur un id nu', async () => {
    stubBackend(() => new Response('{}', { status: 503 }));
    const metadata = await generateMetadata(props('AMERS2NHPL_R04-M001'));
    expect(metadata.title).toBe('Match | Esport News');
    expect(metadata.alternates?.canonical).toBe('https://www.esportnews.fr/mlbb/match/AMERS2NHPL_R04-M001');
  });

  it('rend la page au visiteur, qui refera l\'appel', async () => {
    stubBackend(() => new Response('{}', { status: 503 }));
    await expect(MatchDetailPage(props(SEGMENT))).resolves.toBeTruthy();
  });

  it('répond en 5xx à un robot, jamais une page vide ni un 404', async () => {
    ua = GOOGLEBOT;
    stubBackend(() => new Response('{}', { status: 503 }));
    const error = await MatchDetailPage(props(SEGMENT)).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(String(error.digest ?? '')).not.toContain('404');
  });

  it('reste un vrai 404 quand le backend confirme l\'absence', async () => {
    ua = GOOGLEBOT;
    stubBackend(() => new Response('{}', { status: 404 }));
    await expect(MatchDetailPage(props(SEGMENT))).rejects.toEqual(notFoundDigest);
  });
});

// Next's data cache serves its old copy to the first visitor after expiry, however
// old: a live page opened after a quiet hour showed the score of that hour.
describe('score d\'un match en direct au rendu serveur', () => {
  it('ne passe pas par le cache de données de Next', async () => {
    const init: Array<RequestInit | undefined> = [];
    vi.stubGlobal('fetch', async (_url: string, options?: RequestInit) => {
      init.push(options);
      return new Response('{}', { status: 503 });
    });
    await MatchDetailPage(props(SEGMENT));
    expect(init[0]).toMatchObject({ cache: 'no-store' });
  });
});
