import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResultatsPage, { generateMetadata } from './page';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': 'Mozilla/5.0' }) }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/cs/equipe/team%20vitality/resultats',
}));
vi.mock('../../../../components/ads/AdColumn', () => ({ default: () => null }));
vi.mock('../../../../hooks/useIsDarkTheme', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useIsDarkTheme: () => true,
}));

const props = {
  params: Promise.resolve({ game: 'cs', id: 'team%20vitality' }),
  searchParams: Promise.resolve({}),
};

function stubBackend() {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(String(url));
    return Response.json({ name: 'Team Vitality', template: 'team vitality', acronym: 'VIT', image_url: 'https://x/light.png', dark_mode_image_url: 'https://x/dark.png' });
  });
  return urls;
}

afterEach(() => vi.unstubAllGlobals());

// Liquipedia compares opponentname with its case: the lowercase template finds no placement.
describe('résultats d\'équipe sans ?name= dans l\'URL', () => {
  it('prend le vrai nom de l\'équipe pour la page', async () => {
    stubBackend();

    const html = renderToStaticMarkup(await ResultatsPage(props));

    expect(html).toContain('>Team Vitality<');
    expect(html).not.toContain('>team vitality<');
  });

  it('prend le logo prévu pour le thème sombre', async () => {
    stubBackend();

    const html = renderToStaticMarkup(await ResultatsPage(props));

    expect(html).toContain(encodeURIComponent('https://x/dark.png'));
    expect(html).not.toContain(encodeURIComponent('https://x/light.png'));
  });

  it('prend le vrai nom de l\'équipe pour le titre', async () => {
    stubBackend();

    const metadata = await generateMetadata(props);

    expect(metadata.title).toBe('Team Vitality — Résultats en tournoi | Esport News');
  });

  // The name in the URL proves nothing: anyone can write one.
  it('préfère le nom de la fiche à celui du lien', async () => {
    stubBackend();

    const html = renderToStaticMarkup(await ResultatsPage({ ...props, searchParams: Promise.resolve({ name: 'Forged' }) }));
    const metadata = await generateMetadata({ ...props, searchParams: Promise.resolve({ name: 'Forged' }) });

    expect(html).toContain('>Team Vitality<');
    expect(metadata.title).toBe('Team Vitality — Résultats en tournoi | Esport News');
  });
});

describe('résultats d\'une équipe absente ou indisponible', () => {
  const ghost = { params: Promise.resolve({ game: 'cs', id: 'equipe%20qui%20nexiste%20pas' }), searchParams: Promise.resolve({}) };

  it('rend un vrai 404 quand le backend confirme l\'absence', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));

    await expect(ResultatsPage(ghost)).rejects.toMatchObject({ digest: expect.stringContaining('404') });
  });

  it('garde la page sans fiche quand le lien porte le nom, sans l\'indexer', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));
    const withName = { ...ghost, searchParams: Promise.resolve({ name: 'Ghost Squad' }) };

    await expect(ResultatsPage(withName)).resolves.toBeTruthy();
    expect((await generateMetadata(withName)).robots).toMatchObject({ index: false, follow: true });
  });

  it('renvoie une URL forgée vers les résultats de la fiche trouvée', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ name: 'Team Vitality', template: 'team vitality' }));
    const forged = { params: Promise.resolve({ game: 'cs', id: 'fantome' }), searchParams: Promise.resolve({ name: 'Team Vitality' }) };

    await expect(ResultatsPage(forged)).rejects.toMatchObject({ digest: expect.stringContaining('/cs/equipe/team%20vitality/resultats;308') });
    expect((await generateMetadata(forged)).alternates?.canonical).toBe('https://www.esportnews.fr/cs/equipe/team%20vitality/resultats');
  });

  it('n\'indexe pas les résultats d\'une fiche sans URL à elle', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ name: 'NoTpl Gaming' }));
    const metadata = await generateMetadata({ ...ghost, searchParams: Promise.resolve({ name: 'NoTpl Gaming' }) });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it('ne rend pas 404 pendant une panne du backend', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 503 }));

    await expect(ResultatsPage(ghost)).resolves.toBeTruthy();
  });
});
