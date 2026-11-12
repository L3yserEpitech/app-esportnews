// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import fr from '@/public/locales/fr.json';
import { GameProvider } from '../contexts/GameContext';
import { advertisementService } from '../services/advertisementService';
import NewsPage from './NewsPageClient';

vi.mock('../components/ads/AdColumn', () => ({ default: () => null }));
vi.mock('../components/article/ArticleCard', () => ({
  default: ({ article }: { article: { title: string } }) => createElement('article', null, article.title),
}));
vi.mock('../components/article/FeaturedArticleCard', () => ({
  default: ({ article }: { article: { title: string } }) =>
    createElement('section', { 'data-testid': 'featured' }, article.title),
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? createElement('div', { role: 'dialog' }, children) : null,
  DialogContent: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  DialogTitle: ({ children }: { children: ReactNode }) => createElement('h2', null, children),
}));
vi.mock('../services/advertisementService', () => ({
  advertisementService: { getActiveAdvertisements: vi.fn(async () => []) },
}));

const GAMES = [
  { id: 3, name: 'LoL', acronym: 'lol', full_name: 'League of Legends' },
  { id: 5, name: 'RL', acronym: 'rl', full_name: 'Rocket League' },
  { id: 7, name: 'R6', acronym: 'r6siege', full_name: 'Rainbow Six Siege' },
];

const LOADER = fr.pages_detail.articles.loading;
const NEWS = fr.pages_detail.news;

// Le faux backend. corpus : nombre d'articles par jeu, titrés `<jeu>-<rang>` du plus récent au plus ancien.
let corpus: Record<string, number>;
let isDown: (game: string, offset: number) => boolean;
let held: Array<{ game: string; open: () => void }> | null;
let gamesGate: Promise<void> | null;
let gamesDown: boolean;
let articleRequests: Record<string, string>[];
let searchRequests: Record<string, string>[];
const scrollIntoView = vi.fn();

const json = (body: unknown, total?: number) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: total === undefined ? {} : { 'X-Total-Count': String(total) },
  });

const row = (title: string) => ({ id: title, slug: title, title, created_at: '2026-01-01T00:00:00Z' });

async function backend(input: string): Promise<Response> {
  const url = new URL(input);
  const query = Object.fromEntries(url.searchParams);
  if (url.pathname === '/api/games') {
    await gamesGate;
    return gamesDown ? new Response('{}', { status: 500 }) : json(GAMES);
  }
  if (url.pathname === '/api/articles/search') {
    searchRequests.push(query);
    return json([row(`résultat ${query.q}`)]);
  }
  if (url.pathname !== '/api/articles') throw new Error(`requête inattendue : ${input}`);

  articleRequests.push(query);
  const game = query.game_id ?? 'all';
  const offset = Number(query.offset ?? 0);
  if (held) await new Promise<void>((open) => held!.push({ game, open }));
  if (isDown(game, offset)) return new Response('{}', { status: 503 });
  const titles = Array.from({ length: corpus[game] }, (_, i) => `${game}-${i + 1}`);
  return json(titles.slice(offset, offset + Number(query.limit)).map(row), corpus[game]);
}

function holdGames() {
  let release = () => {};
  gamesGate = new Promise((resolve) => {
    release = resolve;
  });
  return release;
}

function renderPage(saved?: string) {
  if (saved) localStorage.setItem('selectedGame', saved);
  render(
    createElement(NextIntlClientProvider, {
      locale: 'fr',
      messages: fr,
      children: createElement(GameProvider, { children: createElement(NewsPage) }),
    }),
  );
}

const loaded = () => waitFor(() => expect(screen.queryByText(LOADER)).toBeNull());
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve)));
const gameButton = (name: string) => screen.findByRole('button', { name: new RegExp(`lectionner ${name}$`) });

async function mount(saved?: string) {
  renderPage(saved);
  await gameButton('LoL');
  await loaded();
}

async function clickGame(name: string) {
  fireEvent.click(await gameButton(name));
  await loaded();
}

const button = (name: string | RegExp) => screen.queryByRole('button', { name }) as HTMLButtonElement | null;

async function click(name: string | RegExp) {
  fireEvent.click(button(name)!);
  await loaded();
}

const next = () => click(/Suivant/);
const previous = () => click(/Précédent/);
const featured = () => screen.queryByTestId('featured')?.textContent ?? null;
const grid = () => screen.queryAllByRole('article').map((el) => el.textContent);
const pageLabel = () => screen.queryByText(/^Page \d+ sur \d+$/)?.textContent ?? null;
const shown = (text: string) => screen.queryByText(text) !== null;
const lastGridRequest = () => articleRequests.filter((r) => r.limit === '9').at(-1);
const pair = (game?: string, offset = '1') => [
  { limit: '1', category: 'Actus', ...(game && { game_id: game }) },
  { limit: '9', offset, category: 'Actus', ...(game && { game_id: game }) },
];
const pillRemove = (game: string) => button(`Retirer le filtre ${game}`);

beforeEach(() => {
  corpus = { all: 50, '3': 23, '5': 3, '7': 0 };
  isDown = () => false;
  held = null;
  gamesGate = null;
  gamesDown = false;
  articleRequests = [];
  searchRequests = [];
  localStorage.clear();
  scrollIntoView.mockClear();
  vi.mocked(advertisementService.getActiveAdvertisements).mockClear();
  // jsdom ne l'implémente pas.
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  vi.stubGlobal('fetch', backend);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('chargement et filtre', () => {
  it('sans jeu : la une, la grille et la pagination couvrent toutes les actus', async () => {
    await mount();

    expect(articleRequests).toEqual(pair());
    expect(featured()).toBe('all-1');
    expect(grid()).toEqual(['all-2', 'all-3', 'all-4', 'all-5', 'all-6', 'all-7', 'all-8', 'all-9', 'all-10']);
    expect(pageLabel()).toBe('Page 1 sur 6');
  });

  it('un jeu : la une, la grille et la pagination le suivent', async () => {
    await mount('3');

    expect(articleRequests).toEqual(pair('3'));
    expect(featured()).toBe('3-1');
    expect(grid()[0]).toBe('3-2');
    expect(pageLabel()).toBe('Page 1 sur 3');
  });

  it('les publicités ne se rechargent pas à chaque changement de jeu', async () => {
    await mount();
    await clickGame('LoL');
    await clickGame('LoL');
    expect(advertisementService.getActiveAdvertisements).toHaveBeenCalledTimes(1);
  });
});

describe('attente de la sélection', () => {
  it("sans sélection enregistrée, les articles n'attendent pas /api/games", async () => {
    const releaseGames = holdGames();
    renderPage();
    await loaded();

    expect(featured()).toBe('all-1');
    expect(articleRequests).toEqual(pair());

    releaseGames();
    await gameButton('LoL');
    expect(articleRequests).toEqual(pair());
  });

  it('une sélection enregistrée attend sa validation, puis envoie une seule paire', async () => {
    const releaseGames = holdGames();
    renderPage('3');

    expect(articleRequests).toEqual([]);
    expect(shown(LOADER)).toBe(true);

    releaseGames();
    await loaded();
    expect(articleRequests).toEqual(pair('3'));
    expect(featured()).toBe('3-1');
  });

  it.each(['999', 'abc', 'null'])('%s, absent de la liste des jeux, ne vide pas la page', async (saved) => {
    await mount(saved);

    expect(articleRequests).toEqual(pair());
    expect(featured()).toBe('all-1');
    expect(screen.queryByRole('button', { name: /^Retirer le filtre/ })).toBeNull();
  });

  it('/api/games en panne : toutes les actus, sans filtre impossible à retirer', async () => {
    gamesDown = true;
    renderPage('3');
    await loaded();

    expect(articleRequests).toEqual(pair());
    expect(pageLabel()).toBe('Page 1 sur 6');
    expect(screen.queryByRole('button', { name: /^Retirer le filtre/ })).toBeNull();
  });
});

describe('retour à la page 1', () => {
  it('changer de jeu depuis la page 3 revient à la page 1, en une seule salve', async () => {
    await mount();
    await next();
    await next();
    articleRequests = [];

    await clickGame('LoL');

    expect(articleRequests).toEqual(pair('3'));
    expect(pageLabel()).toBe('Page 1 sur 3');
  });

  it('revenir sur un jeu ne ressuscite pas son ancienne page', async () => {
    await mount('3');
    await next();
    await next();

    await clickGame('RL');
    await clickGame('LoL');

    expect(lastGridRequest()).toMatchObject({ offset: '1', game_id: '3' });
    expect(pageLabel()).toBe('Page 1 sur 3');
  });

  it('désélectionner un jeu ne ressuscite pas la page de « tous les jeux »', async () => {
    await mount();
    await next();
    await next();

    await clickGame('LoL');
    await clickGame('LoL');

    expect(lastGridRequest()).toEqual(pair()[1]);
    expect(pageLabel()).toBe('Page 1 sur 6');
  });
});

describe('réponses périmées', () => {
  it.each([
    ['des articles', false],
    ['une erreur', true],
  ])('%s arrivés trop tard ne remplacent jamais le jeu courant', async (_name, staleFails) => {
    await mount();
    isDown = (game) => staleFails && game === '3';
    held = [];

    fireEvent.click(await gameButton('LoL'));
    fireEvent.click(await gameButton('RL'));
    const pending = held;
    expect(pending).toHaveLength(4);
    expect(shown(LOADER)).toBe(true);

    pending.filter((r) => r.game === '5').forEach((r) => r.open());
    await loaded();
    expect(featured()).toBe('5-1');

    pending.filter((r) => r.game === '3').forEach((r) => r.open());
    await flush();
    expect(shown(NEWS.load_error)).toBe(false);
    expect(featured()).toBe('5-1');
    expect(grid()).toEqual(['5-2', '5-3']);
  });
});

describe('pagination', () => {
  it.each([
    [0, null, 0],
    [1, null, 0],
    [10, null, 9],
    [11, 'Page 1 sur 2', 9],
    [20, 'Page 1 sur 3', 9],
  ])('avec %i articles : pagination %s', async (total, label, gridSize) => {
    corpus['3'] = total;
    await mount('3');

    expect(pageLabel()).toBe(label);
    expect(grid()).toHaveLength(gridSize);
    expect(featured()).toBe(total > 0 ? '3-1' : null);
  });

  it('ne déborde pas aux extrémités', async () => {
    corpus['3'] = 11;
    await mount('3');
    expect(button(/Précédent/)!.disabled).toBe(true);
    expect(button(/Suivant/)!.disabled).toBe(false);

    await next();
    expect(pageLabel()).toBe('Page 2 sur 2');
    expect(grid()).toEqual(['3-11']);
    expect(button(/Suivant/)!.disabled).toBe(true);

    await previous();
    expect(lastGridRequest()!.offset).toBe('1');
  });

  it('remonte vers la grille au changement de page', async () => {
    await mount('3');
    await next();
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'start' });
  });

  // Article supprimé au back-office entre deux clics : la page demandée n'existe plus.
  it('une page devenue vide laisse un moyen de revenir, avec un total cohérent', async () => {
    await mount('3');
    await next();

    corpus['3'] = 8;
    await next();

    expect(grid()).toEqual([]);
    expect(featured()).toBe('3-1');
    expect(pageLabel()).toBe('Page 3 sur 3');
    expect(button(/Suivant/)!.disabled).toBe(true);

    await previous();
    expect(pageLabel()).toBe('Page 2 sur 2');
    await previous();
    expect(grid()).toHaveLength(7);
    expect(pageLabel()).toBeNull();
  });
});

describe('état vide', () => {
  it('sans jeu actif, le message reste « revenez bientôt »', async () => {
    corpus.all = 0;
    await mount();

    expect(shown(fr.pages.home.news.no_news)).toBe(true);
    expect(button(NEWS.see_all_games)).toBeNull();
  });

  it('sous filtre, il nomme le jeu, garde le H1 et la recherche, et « Voir tous les jeux » retire le filtre', async () => {
    await mount('7');

    expect(shown('Aucune actu pour Rainbow Six Siege')).toBe(true);
    expect(shown(fr.pages.home.news.no_news)).toBe(false);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(NEWS.h1);
    expect(button(new RegExp(fr.pages_detail.articles.search.placeholder_news))).not.toBeNull();

    await click(NEWS.see_all_games);

    expect(featured()).toBe('all-1');
    expect(localStorage.getItem('selectedGame')).toBeNull();
  });
});

describe('pastille du filtre (mobile)', () => {
  it('nomme le jeu actif, est masquée sur desktop, et son bouton retire le filtre', async () => {
    await mount('5');

    const chip = pillRemove('Rocket League')!.parentElement!;
    expect(chip.textContent).toBe('Rocket League');
    expect(chip.className).toContain('md:hidden');

    await click('Retirer le filtre Rocket League');

    expect(pillRemove('Rocket League')).toBeNull();
    expect(lastGridRequest()).toEqual(pair()[1]);
  });

  it('reste visible pendant le chargement, sur un jeu vide et en panne', async () => {
    held = [];
    renderPage('7');
    await screen.findByRole('button', { name: 'Retirer le filtre Rainbow Six Siege' });
    expect(shown(LOADER)).toBe(true);

    held.forEach((r) => r.open());
    held = null;
    await loaded();
    expect(shown('Aucune actu pour Rainbow Six Siege')).toBe(true);
    expect(pillRemove('Rainbow Six Siege')).not.toBeNull();

    isDown = (game) => game === '5';
    await clickGame('RL');
    expect(shown(NEWS.load_error)).toBe(true);
    expect(pillRemove('Rocket League')).not.toBeNull();
  });
});

describe('panne du backend', () => {
  it("affiche l'erreur et « Réessayer », sans état vide, sans chargeur, sans déplacer la page", async () => {
    isDown = () => true;
    await mount();

    expect(shown(NEWS.load_error)).toBe(true);
    expect(button(NEWS.retry)).not.toBeNull();
    expect(shown(LOADER)).toBe(false);
    expect(shown(fr.pages.home.news.no_news)).toBe(false);
    expect(featured()).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('« Réessayer » remet le chargeur, relance la une et la grille, puis rétablit la page', async () => {
    isDown = () => true;
    await mount();
    articleRequests = [];

    held = [];
    fireEvent.click(button(NEWS.retry)!);
    expect(shown(LOADER)).toBe(true);
    expect(shown(NEWS.load_error)).toBe(false);
    expect(articleRequests).toEqual(pair());

    isDown = () => false;
    held.forEach((r) => r.open());
    await loaded();
    expect(button(NEWS.retry)).toBeNull();
    expect(featured()).toBe('all-1');
    expect(pageLabel()).toBe('Page 1 sur 6');
  });

  it('changer de jeu efface une erreur précédente', async () => {
    isDown = (game) => game === '3';
    await mount('3');
    expect(shown(NEWS.load_error)).toBe(true);

    await clickGame('RL');
    expect(shown(NEWS.load_error)).toBe(false);
    expect(featured()).toBe('5-1');
  });

  it('un jeu en panne ne garde pas la pagination du jeu précédent', async () => {
    await mount('3');
    expect(pageLabel()).toBe('Page 1 sur 3');

    isDown = (game) => game === '5';
    await clickGame('RL');

    expect(shown(NEWS.load_error)).toBe(true);
    expect(pageLabel()).toBeNull();
  });

  it('une panne de la grille seule en page 2 : message à l\'écran, « Précédent », et « Réessayer » sert la page 2', async () => {
    await mount('3');
    isDown = (_game, offset) => offset === 10;
    await next();

    expect(shown(NEWS.load_error)).toBe(true);
    expect(grid()).toEqual([]);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'center' });
    expect(pageLabel()).toBe('Page 2 sur 3');
    expect(button(/Précédent/)!.disabled).toBe(false);

    isDown = () => false;
    await click(NEWS.retry);
    expect(lastGridRequest()).toMatchObject({ offset: '10', game_id: '3' });
    expect(pageLabel()).toBe('Page 2 sur 3');
    expect(grid()[0]).toBe('3-11');
  });
});

describe('recherche', () => {
  it('⌘K cherche dans toutes les actus, quel que soit le jeu', async () => {
    await mount('7');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    fireEvent.change(screen.getByPlaceholderText(fr.pages_detail.articles.search.input_placeholder), {
      target: { value: 'kcorp' },
    });
    await screen.findByText('résultat kcorp');
    expect(searchRequests).toEqual([{ q: 'kcorp', category: 'Actus', limit: '50' }]);

    await clickGame('LoL');
    expect(searchRequests).toHaveLength(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
