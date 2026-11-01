import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResultatsPage, { generateMetadata } from './page';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({
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
    return Response.json({ name: 'Team Vitality', acronym: 'VIT', image_url: 'https://x/light.png', dark_mode_image_url: 'https://x/dark.png' });
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

  it('ne résout pas l\'équipe quand le lien porte déjà son nom', async () => {
    const urls = stubBackend();

    await ResultatsPage({ ...props, searchParams: Promise.resolve({ name: 'Team Vitality' }) });

    expect(urls.filter((u) => u.includes('/api/teams/'))).toEqual([]);
  });
});
