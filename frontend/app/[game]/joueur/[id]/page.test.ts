import { afterEach, describe, expect, it, vi } from 'vitest';
import PlayerPage, { generateMetadata } from './page';
import { BROWSER, GOOGLEBOT, notFoundDigest, stubBackend } from '../../../lib/entityPageTestUtils';

let ua = BROWSER;
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': ua }) }));
vi.mock('../../../joueur/_components/PlayerDetailPageClient', () => ({ default: () => null }));
vi.mock('../../../components/seo/entityJsonLd', () => ({ PlayerJsonLd: () => null }));

const props = (id: string) => ({ params: Promise.resolve({ game: 'cs', id }) });

afterEach(() => { vi.unstubAllGlobals(); ua = BROWSER; });

describe('joueur pendant une panne du backend', () => {
  it('garde le canonical et un titre tiré de l\'URL', async () => {
    stubBackend(() => new Response('{}', { status: 503 }));
    const metadata = await generateMetadata(props('ZywOo'));
    expect(metadata.title).toBe('ZywOo – Joueur Counter-Strike 2 | Esport News');
    expect(metadata.alternates?.canonical).toBe('https://www.esportnews.fr/cs/joueur/ZywOo');
  });

  it('rend la page au visiteur', async () => {
    stubBackend(() => new Response('{}', { status: 503 }));
    await expect(PlayerPage(props('ZywOo'))).resolves.toBeTruthy();
  });

  it('répond en 5xx à un robot', async () => {
    ua = GOOGLEBOT;
    stubBackend(() => new Response('{}', { status: 503 }));
    const error = await PlayerPage(props('ZywOo')).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(String(error.digest ?? '')).not.toContain('404');
  });

  it('reste un vrai 404 quand le backend confirme l\'absence', async () => {
    stubBackend(() => new Response('{}', { status: 404 }));
    await expect(PlayerPage(props('Ghost'))).rejects.toEqual(notFoundDigest);
  });
});
