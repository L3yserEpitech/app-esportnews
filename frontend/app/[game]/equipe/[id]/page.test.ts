import { afterEach, describe, expect, it, vi } from 'vitest';
import TeamDetailPage, { generateMetadata } from './page';
import { BROWSER, GOOGLEBOT, notFoundDigest, stubBackend } from '../../../lib/entityPageTestUtils';

let ua = BROWSER;
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': ua }) }));
vi.mock('../../../equipe/_components/TeamDetailPageClient', () => ({ default: () => null }));

const props = (id: string, query: Record<string, string> = {}) => ({
  params: Promise.resolve({ game: 'cs', id: encodeURIComponent(id) }),
  searchParams: Promise.resolve(query),
});
const team = { name: 'Team Vitality', template: 'team vitality' };

afterEach(() => { vi.unstubAllGlobals(); ua = BROWSER; });

describe('fiche équipe : absence confirmée ou panne', () => {
  it('rend un vrai 404 quand le backend confirme l\'absence', async () => {
    stubBackend(() => new Response('{}', { status: 404 }));
    await expect(TeamDetailPage(props('equipe qui nexiste pas'))).rejects.toEqual(notFoundDigest);
  });

  it('rend un vrai 404 sur un id numérique absent', async () => {
    const urls = stubBackend(() => new Response('{}', { status: 404 }));
    await expect(TeamDetailPage(props('4242'))).rejects.toEqual(notFoundDigest);
    expect(urls[0]).toContain('/api/teams/4242/detail');
  });

  it('ne rend pas 404 sur un 503, à un visiteur', async () => {
    stubBackend(() => new Response('{}', { status: 503 }));
    await expect(TeamDetailPage(props('team vitality'))).resolves.toBeTruthy();
  });

  it('ne rend pas 404 sur une coupure réseau, à un visiteur', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('ECONNRESET'); });
    await expect(TeamDetailPage(props('team vitality'))).resolves.toBeTruthy();
  });

  it('répond en 5xx à un robot pendant une panne, sans 404', async () => {
    ua = GOOGLEBOT;
    stubBackend(() => new Response('{}', { status: 503 }));
    const error = await TeamDetailPage(props('team vitality')).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(String(error.digest ?? '')).not.toContain('404');
  });

  it('retrouve une équipe par le template sans suffixe de date', async () => {
    const urls = stubBackend((url) => (url.includes('heroic%20sep%202024')
      ? new Response('{}', { status: 404 })
      : Response.json({ name: 'HEROIC', template: 'heroic' })));
    await expect(TeamDetailPage(props('heroic sep 2024'))).rejects.toMatchObject({ digest: expect.stringContaining('/cs/equipe/heroic;308') });
    expect(urls).toHaveLength(2);
  });

  it('ne retente pas le template sans date quand le premier appel est en panne', async () => {
    const urls = stubBackend(() => new Response('{}', { status: 503 }));
    await TeamDetailPage(props('heroic sep 2024'));
    expect(urls).toHaveLength(1);
  });

  it('demande aussi le nom quand le lien le porte (équipe renommée)', async () => {
    const urls = stubBackend(() => Response.json({ name: 'OK Brion', template: 'brion 2023' }));
    await TeamDetailPage(props('brion 2023', { name: 'OK Brion' }));
    expect(urls[0]).toContain('name=OK%20Brion');
  });

  it('traite un 400 du backend comme une absence', async () => {
    stubBackend(() => new Response('{}', { status: 400 }));
    ua = GOOGLEBOT;
    await expect(TeamDetailPage(props('99999999999999999999'))).rejects.toEqual(notFoundDigest);
    await expect(TeamDetailPage(props('Infinity'))).rejects.toEqual(notFoundDigest);
  });

  // Most match opponents have no Liquipedia team page, and their links carry
  // ?name=: visitors keep the page they get today, search engines do not index it.
  it('garde la page sans fiche Liquipedia quand le lien porte le nom, sans l\'indexer', async () => {
    stubBackend(() => new Response('{}', { status: 404 }));
    await expect(TeamDetailPage(props('i hate drugs', { name: 'I Hate Drugs' }))).resolves.toBeTruthy();

    const metadata = await generateMetadata(props('i hate drugs', { name: 'I Hate Drugs' }));
    expect(metadata.robots).toMatchObject({ index: false });
    expect(metadata.title).toBe('I Hate Drugs | Esport News');
  });
});

// A forged or dated URL must not stay indexable next to the team's real one: same
// rule as match and tournament pages, any other form goes to the canonical in 308.
describe('équipe trouvée sous une autre URL que la sienne', () => {
  const redirectTo = (path: string) => expect.objectContaining({
    digest: expect.stringContaining(`${path};308`),
  });

  it('renvoie une URL forgée vers la fiche trouvée par le nom', async () => {
    stubBackend(() => Response.json(team));
    await expect(TeamDetailPage(props('fantome4', { name: 'Team Vitality' }))).rejects.toEqual(redirectTo('/cs/equipe/team%20vitality'));
  });

  it('renvoie un template daté vers le template actuel', async () => {
    stubBackend((url) => (url.includes('heroic%20sep%202024')
      ? new Response('{}', { status: 404 })
      : Response.json({ name: 'HEROIC', template: 'heroic' })));
    await expect(TeamDetailPage(props('heroic sep 2024'))).rejects.toEqual(redirectTo('/cs/equipe/heroic'));
  });

  it('renvoie un id numérique vers le template, dans le même jeu', async () => {
    stubBackend(() => Response.json({ name: 'FURIA', template: 'furia', wiki: 'counterstrike' }));
    await expect(TeamDetailPage(props('11112'))).rejects.toEqual(redirectTo('/cs/equipe/furia'));
  });

  // A pageid is only unique within its wiki, and the backend scans the others when
  // this one has none: another game's team here is another team, not this page.
  it('ne suit jamais un id numérique vers un autre jeu', async () => {
    stubBackend(() => Response.json({ name: 'Sentinels', template: 'sentinels', wiki: 'valorant' }));
    await expect(TeamDetailPage(props('22222'))).rejects.toEqual(notFoundDigest);
  });

  it('garde la page en noindex sur un id numérique d\'un autre jeu quand le lien porte le nom', async () => {
    stubBackend(() => Response.json({ name: 'Sentinels', template: 'sentinels', wiki: 'valorant' }));
    await expect(TeamDetailPage(props('22222', { name: 'Fnatic' }))).resolves.toBeTruthy();
    expect((await generateMetadata(props('22222', { name: 'Fnatic' }))).robots).toMatchObject({ index: false, follow: true });
  });

  // 1337 would be read back as a pageid: 308, then 404.
  it('ne redirige pas vers un template que l\'URL relirait comme un id', async () => {
    for (const template of ['1337', 'Infinity', '1e5']) {
      stubBackend(() => Response.json({ name: 'Leet', template }));
      await expect(TeamDetailPage(props('fantome', { name: 'Leet' }))).resolves.toBeTruthy();
    }
  });

  it('ne redirige pas vers un template que la condition refuserait, même après des espaces', async () => {
    for (const template of ['!x', ' !x', '\t!x', '\u3000!x', '\u00a0<x']) {
      stubBackend(() => Response.json({ name: 'Bang', template }));
      await expect(TeamDetailPage(props('fantome', { name: 'Bang' }))).resolves.toBeTruthy();
    }
  });

  it('suit un template long, relisible', async () => {
    const template = 'x'.repeat(200);
    stubBackend(() => Response.json({ name: 'Long', template }));
    await expect(TeamDetailPage(props('fantome', { name: 'Long' }))).rejects.toEqual(redirectTo(`/cs/equipe/${template}`));
  });

  // Without a URL of its own the page can only stand on what the link says.
  it('n\'indexe pas une fiche sans URL à elle', async () => {
    stubBackend(() => Response.json({ name: 'NoTpl Gaming' }));
    const metadata = await generateMetadata(props('zz', { name: 'NoTpl Gaming' }));
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBeUndefined();
  });

  it('ne redirige pas quand l\'URL est déjà la bonne', async () => {
    stubBackend(() => Response.json(team));
    await expect(TeamDetailPage(props('team vitality'))).resolves.toBeTruthy();
    await expect(TeamDetailPage(props('team vitality', { name: 'Team Vitality' }))).resolves.toBeTruthy();
  });

  it('reste sur place sans template, ou avec un template que l\'URL ne saurait pas relire', async () => {
    stubBackend(() => Response.json({ name: 'Numeric' }));
    await expect(TeamDetailPage(props('123'))).resolves.toBeTruthy();
    stubBackend(() => Response.json({ name: 'A]]B', template: 'a]]b' }));
    await expect(TeamDetailPage(props('123'))).resolves.toBeTruthy();
  });

  it('pose canonical et og:url sur le template de la fiche', async () => {
    stubBackend(() => Response.json(team));
    const metadata = await generateMetadata(props('fantome4', { name: 'Team Vitality' }));
    expect(metadata.alternates?.canonical).toBe('https://www.esportnews.fr/cs/equipe/team%20vitality');
    expect(metadata.openGraph).toMatchObject({ url: 'https://www.esportnews.fr/cs/equipe/team%20vitality' });
  });
});

describe('métadonnées de la fiche équipe pendant une panne', () => {
  it('pose le canonical et un titre tiré de l\'URL, pas « Équipe non trouvée »', async () => {
    stubBackend(() => new Response('{}', { status: 503 }));
    const metadata = await generateMetadata(props('team vitality'));
    expect(metadata.title).toBe('Team Vitality – Équipe Counter-Strike 2 | Esport News');
    expect(metadata.alternates?.canonical).toBe('https://www.esportnews.fr/cs/equipe/team%20vitality');
  });

  it('n\'invente pas de nom pour un id numérique', async () => {
    stubBackend(() => new Response('{}', { status: 503 }));
    const metadata = await generateMetadata(props('4242'));
    expect(metadata.title).toBe('Équipe Counter-Strike 2 | Esport News');
    expect(metadata.alternates?.canonical).toBe('https://www.esportnews.fr/cs/equipe/4242');
  });
});
