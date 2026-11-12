import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { articleService } from './articleService';

const row = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  slug: `article-${id}`,
  title: `Titre ${id}`,
  created_at: '2026-01-01T00:00:00Z',
  category: 'Actus',
  ...extra,
});

const reply = (body: unknown, total?: string, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: total === undefined ? {} : { 'X-Total-Count': total },
  });

function stubFetch(answer: () => Response) {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(String(url));
    return answer();
  });
  return urls;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getArticlesPage : URL', () => {
  // L'hôte dépend de NEXT_PUBLIC_BACKEND_URL, lu à l'import du service.
  const queryFor = async (options?: Parameters<typeof articleService.getArticlesPage>[0]) => {
    const urls = stubFetch(() => reply([], '0'));
    await articleService.getArticlesPage(options);
    const { pathname, searchParams } = new URL(urls[0]);
    expect(pathname).toBe('/api/articles');
    return Object.fromEntries(searchParams);
  };

  it('sans option, aucune query string', async () => {
    expect(await queryFor()).toEqual({});
    expect(await queryFor({})).toEqual({});
  });

  it('porte tous les filtres', async () => {
    expect(
      await queryFor({ limit: 9, offset: 10, category: 'Actus', excludeNews: true, author: 'Kenan', gameId: '3' }),
    ).toEqual({
      limit: '9',
      offset: '10',
      category: 'Actus',
      excludeNews: 'true',
      author: 'Kenan',
      game_id: '3',
    });
  });

  it("n'envoie pas game_id sans jeu", async () => {
    expect(await queryFor({ gameId: undefined })).toEqual({});
    expect(await queryFor({ gameId: '' })).toEqual({});
  });

  it('omet limit=0, offset=0 et excludeNews=false', async () => {
    expect(await queryFor({ limit: 0, offset: 0, excludeNews: false })).toEqual({});
  });
});

describe('getArticlesPage : total', () => {
  it('prend le total du header, pas le nombre de lignes', async () => {
    stubFetch(() => reply([row(1), row(2)], '57'));
    const page = await articleService.getArticlesPage({ limit: 2 });
    expect(page.total).toBe(57);
    expect(page.articles.map((a) => a.id)).toEqual([1, 2]);
  });

  it.each([[undefined], ['abc']])('un header %s donne 0, jamais NaN', async (header) => {
    stubFetch(() => reply([row(1), row(2)], header));
    expect((await articleService.getArticlesPage()).total).toBe(0);
  });
});

describe('getArticlesPage : erreurs et réponses invalides', () => {
  it.each([404, 503])('HTTP %i lève une erreur', async (status) => {
    stubFetch(() => reply({ message: 'non' }, '42', status));
    await expect(articleService.getArticlesPage({ gameId: 'abc' })).rejects.toThrow(String(status));
  });

  it('une panne réseau lève une erreur', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(articleService.getArticlesPage()).rejects.toThrow('Failed to fetch');
  });

  it('un corps non JSON lève une erreur', async () => {
    stubFetch(() => new Response('<html>502</html>', { status: 200, headers: { 'X-Total-Count': '9' } }));
    await expect(articleService.getArticlesPage()).rejects.toThrow();
  });

  it.each([[null], [{ error: 'x' }]])('le corps %j lève une erreur', async (body) => {
    stubFetch(() => reply(body, '9'));
    await expect(articleService.getArticlesPage()).rejects.toThrow('not a list');
  });

  it('une ligne null lève une erreur plutôt que de rendre une page amputée', async () => {
    stubFetch(() => reply([row(1), null], '2'));
    await expect(articleService.getArticlesPage()).rejects.toThrow();
  });

  it('une réponse vide valide reste une liste vide, pas une erreur', async () => {
    stubFetch(() => reply([], '0'));
    await expect(articleService.getArticlesPage({ gameId: '7' })).resolves.toEqual({ articles: [], total: 0 });
  });

  it('tolère des champs nuls', async () => {
    stubFetch(() => reply([row(1, { tags: null, views: null, content: null, featuredImage: null })], '1'));
    const { articles } = await articleService.getArticlesPage();
    expect(articles[0]).toMatchObject({ id: 1, tags: [], views: 0, readTime: 0 });
  });
});

describe('getAllArticles, pour les appelants existants', () => {
  it('rend les lignes seules, comme avant', async () => {
    stubFetch(() => reply([row(1), row(2)], '57'));
    const articles = await articleService.getAllArticles({ limit: 2 });
    expect(articles.map((a) => a.slug)).toEqual(['article-1', 'article-2']);
  });

  it('rend [] sur erreur : les sitemaps comptent dessus pour arrêter de paginer', async () => {
    stubFetch(() => reply({}, undefined, 500));
    await expect(articleService.getAllArticles({ limit: 100, offset: 100 })).resolves.toEqual([]);
  });

  it.each<[string, () => Response]>([
    ['une panne réseau', () => { throw new TypeError('Failed to fetch'); }],
    ['un corps qui n\'est pas une liste', () => reply({ error: 'x' }, '9')],
  ])('rend aussi [] sur %s', async (_name, answer) => {
    stubFetch(answer);
    await expect(articleService.getAllArticles()).resolves.toEqual([]);
  });
});
