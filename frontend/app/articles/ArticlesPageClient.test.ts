// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import fr from '@/public/locales/fr.json';
import ArticlesPageClient from './ArticlesPageClient';

vi.mock('../components/ads/AdColumn', () => ({ default: () => null }));
vi.mock('../components/article/ArticleCard', () => ({
  default: ({ article }: { article: { title: string } }) => createElement('article', null, article.title),
}));
vi.mock('../components/article/FeaturedArticleCard', () => ({
  default: ({ article }: { article: { title: string } }) => createElement('section', null, article.title),
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? createElement('div', { role: 'dialog' }, children) : null,
  DialogContent: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  DialogTitle: ({ children }: { children: ReactNode }) => createElement('h2', null, children),
}));
vi.mock('../services/advertisementService', () => ({
  advertisementService: { getActiveAdvertisements: async () => [] },
}));

let gridDown: boolean;

const loaded = () => waitFor(() => expect(screen.queryByText(fr.pages_detail.articles.loading)).toBeNull());

beforeEach(() => {
  gridDown = false;
  // jsdom ne l'implémente pas.
  HTMLElement.prototype.scrollIntoView = () => {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('fetch', async (input: string) => {
    const { searchParams } = new URL(input);
    const offset = Number(searchParams.get('offset') ?? 0);
    if (gridDown && offset > 1) return new Response('{}', { status: 503 });
    const titles = Array.from({ length: 12 }, (_, i) => `analyse-${i + 1}`);
    const rows = titles
      .slice(offset, offset + Number(searchParams.get('limit')))
      .map((title) => ({ id: title, slug: title, title, created_at: '2026-01-01T00:00:00Z' }));
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'X-Total-Count': '12' } });
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('une panne de la grille ne laisse pas la page précédente affichée', async () => {
  render(
    createElement(NextIntlClientProvider, { locale: 'fr', messages: fr, children: createElement(ArticlesPageClient) }),
  );
  await loaded();
  expect(screen.getAllByRole('article')).toHaveLength(9);
  expect(screen.getByText('Page 1 sur 2')).toBeTruthy();

  gridDown = true;
  fireEvent.click(screen.getByRole('button', { name: /Suivant/ }));
  await loaded();

  expect(screen.queryAllByRole('article')).toEqual([]);
  expect(screen.getByText('Aucun article trouvé')).toBeTruthy();
});
