import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Le HTML servi aux crawlers : les effets ne tournent pas côté serveur, c'est
// l'état de chargement qui est rendu. Règle du §13 : le H1 doit y être.
const game = vi.hoisted(() => ({
  games: [] as { id: number }[],
  selectedGame: null as string | null,
  setSelectedGame: () => {},
  isSelectionRestored: false,
  isLoadingGames: true,
  getSelectedGameData: () => null,
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('../components/ui/ContentLoader', () => ({
  default: ({ label }: { label: string }) => createElement('p', { 'data-testid': 'loader' }, label),
}));
vi.mock('../components/ads/AdColumn', () => ({ default: () => null }));
vi.mock('../components/article/ArticleCard', () => ({ default: () => null }));
vi.mock('../components/article/FeaturedArticleCard', () => ({ default: () => null }));
vi.mock('../components/games/GameSelector', () => ({
  default: ({ isLoading }: { isLoading: boolean }) =>
    createElement('div', { 'data-testid': 'selector', 'data-loading': String(isLoading) }),
}));
vi.mock('../contexts/GameContext', () => ({ useGame: () => game }));
vi.mock('../services/articleService', () => ({
  articleService: {
    getArticlesPage: () => {
      throw new Error('aucun appel API pendant le rendu serveur');
    },
  },
}));
vi.mock('../services/advertisementService', () => ({
  advertisementService: { getActiveAdvertisements: async () => [] },
}));
vi.mock('../hooks/useArticleSearch', () => ({
  useArticleSearch: () => ({ results: [], isSearching: false }),
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: () => null,
  DialogContent: () => null,
  DialogTitle: () => null,
}));

import NewsPage from './NewsPageClient';

const html = () => renderToStaticMarkup(createElement(NewsPage));

describe('rendu serveur de /news', () => {
  it('sort le H1, la recherche, le chargeur et le sélecteur', () => {
    const out = html();

    expect(out).toMatch(/<h1[^>]*>pages_detail\.news\.h1<\/h1>/);
    expect(out).toContain('pages_detail.articles.search.placeholder_news');
    expect(out).toContain('data-testid="loader"');
    expect(out).toContain('data-testid="selector"');
  });

  it("n'expose qu'un seul H1", () => {
    expect(html().match(/<h1/g)).toHaveLength(1);
  });

  it("ne déclenche aucun appel d'API", () => {
    expect(html).not.toThrow();
  });
});
