'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X, Newspaper } from 'lucide-react';
import ContentLoader from '../components/ui/ContentLoader';
import AdColumn from '../components/ads/AdColumn';
import ArticleCard from '../components/article/ArticleCard';
import FeaturedArticleCard from '../components/article/FeaturedArticleCard';
import GameSelector from '../components/games/GameSelector';
import { useGame } from '../contexts/GameContext';
import { NewsItem, Advertisement } from '../types';
import { articleService } from '../services/articleService';
import { advertisementService } from '../services/advertisementService';
import { useArticleSearch } from '../hooks/useArticleSearch';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

const ARTICLES_PER_PAGE = 9;
const NEWS_CATEGORY = 'Actus';

export default function NewsPage() {
  const t = useTranslations();
  const { games, selectedGame, setSelectedGame, isSelectionRestored, isLoadingGames, getSelectedGameData } = useGame();
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [featuredArticle, setFeaturedArticle] = useState<NewsItem | null>(null);
  const [totalArticles, setTotalArticles] = useState(0);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Only an id present in `games` filters: localStorage can hold anything, and
  // without the list (/api/games down) the filter could be neither shown nor removed.
  const activeGameData = getSelectedGameData();
  const activeGameId = activeGameData ? String(activeGameData.id) : undefined;

  // A page number and a total only mean something for the game they were read
  // under: the selection also changes from the navbar on mobile or from another tab.
  // Adjusted during render because an effect would first load the new game at the old page.
  const [currentPage, setCurrentPage] = useState(1);
  const [pageGame, setPageGame] = useState(activeGameId);
  if (pageGame !== activeGameId) {
    setPageGame(activeGameId);
    setCurrentPage(1);
    setTotalArticles(0);
  }

  // GameProvider reads the saved game after this page's first effects, and only the
  // list of games can validate it. Without a saved game, /api/games delays nothing.
  const isWaitingForSelection = !isSelectionRestored || (selectedGame !== null && isLoadingGames);

  // Featured = most recent article of the selection; the grid starts right after it.
  useEffect(() => {
    if (isWaitingForSelection) return;

    let stale = false;
    setIsLoadingArticles(true);
    setLoadFailed(false);

    Promise.all([
      articleService.getArticlesPage({ limit: 1, category: NEWS_CATEGORY, gameId: activeGameId }),
      articleService.getArticlesPage({
        limit: ARTICLES_PER_PAGE,
        offset: 1 + (currentPage - 1) * ARTICLES_PER_PAGE,
        category: NEWS_CATEGORY,
        gameId: activeGameId,
      }),
    ])
      .then(([featured, page]) => {
        if (stale) return;
        setFeaturedArticle(featured.articles[0] ?? null);
        setArticles(page.articles);
        setTotalArticles(page.total);
        setIsLoadingArticles(false);
      })
      .catch((error) => {
        if (stale) return;
        console.error('Erreur lors du chargement des actualités:', error);
        setLoadFailed(true);
        setIsLoadingArticles(false);
      });

    return () => {
      stale = true;
    };
  }, [isWaitingForSelection, activeGameId, currentPage, retryCount]);

  // Load ads
  const loadAds = useCallback(async () => {
    try {
      setIsLoadingAds(true);
      const fetchedAds = await advertisementService.getActiveAdvertisements();
      setAds(fetchedAds);
    } catch (error) {
      console.error('Erreur lors du chargement des publicités:', error);
    } finally {
      setIsLoadingAds(false);
    }
  }, []);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // Raccourci clavier pour ouvrir la modale de recherche (⌘K ou Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
      // Fermer avec Escape
      if (e.key === 'Escape' && isSearchModalOpen) {
        setIsSearchModalOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen]);

  // Server-side full-text search via /api/articles/search. Runs against the
  // full corpus of "Actus" articles regardless of the current pagination
  // window. Debounced + abortable — see hooks/useArticleSearch.ts.
  const { results: searchHits, isSearching: isSearchingNews } = useArticleSearch(
    searchQuery,
    {
      category: NEWS_CATEGORY,
      enabled: isSearchModalOpen,
      limit: 50,
    },
  );

  const filteredArticles = useMemo(
    () => (searchQuery.trim() ? searchHits : articles),
    [searchQuery, searchHits, articles],
  );

  // Calculate total pages based on total articles (excluding featured)
  const totalPages = Math.ceil(Math.max(0, totalArticles - 1) / ARTICLES_PER_PAGE);

  // Ref pour la section des articles
  const articlesSectionRef = useRef<HTMLDivElement>(null);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    articlesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Clicked from the bottom of a long page, the error would land above the viewport.
  useEffect(() => {
    if (loadFailed && currentPage > 1) articlesSectionRef.current?.scrollIntoView({ block: 'center' });
  }, [loadFailed, currentPage]);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Game Selector - Desktop only (mobile: bouton manette de la navbar) */}
      <div className="pt-20 hidden md:block">
        <GameSelector
          games={games}
          selectedGame={selectedGame}
          onSelectionChange={setSelectedGame}
          isLoading={isLoadingGames}
        />
      </div>

      <main className="container mx-auto px-4 py-8 pt-24 md:pt-4">
        <div className="flex gap-8">
          {/* News content */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary mt-3 mb-6">{t('pages_detail.news.h1')}</h1>

            {/* Barre de recherche : toujours là, un jeu sans actu ne doit pas la retirer */}
            <div className="mb-12 mt-3">
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="w-full max-w-md flex items-center justify-center gap-3 px-4 py-3 bg-bg-secondary/50 border border-border-primary/50 rounded-xl text-left text-text-secondary hover:border-border-primary hover:bg-bg-secondary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
                <span className="text-sm">{t('pages_detail.articles.search.placeholder_news')}</span>
                <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-text-muted bg-bg-tertiary border border-border-primary/50 rounded">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </button>
            </div>

            {/* Le sélecteur de jeux est masqué sur mobile : le filtre doit rester visible */}
            {activeGameData && (
              <div className="md:hidden mb-6 inline-flex max-w-full items-center gap-1 pl-4 pr-1 py-1 bg-bg-secondary/50 border border-border-primary/50 rounded-xl text-sm text-text-primary">
                <span className="truncate">{activeGameData.full_name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedGame(null)}
                  aria-label={t('pages_detail.news.remove_game_filter', { game: activeGameData.full_name })}
                  className="flex-shrink-0 p-2 rounded-lg text-text-muted hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {isLoadingArticles ? (
              <ContentLoader label={t('pages_detail.articles.loading')} icon={Newspaper} />
            ) : loadFailed ? (
              <div ref={articlesSectionRef} className="text-center py-12">
                <div className="text-text-muted text-lg mb-4">
                  {t('pages_detail.news.load_error')}
                </div>
                <button
                  type="button"
                  onClick={() => setRetryCount((count) => count + 1)}
                  className="px-6 py-2 bg-accent hover:bg-accent/80 text-text-inverse rounded-lg font-medium transition-colors"
                >
                  {t('pages_detail.news.retry')}
                </button>
              </div>
            ) : !featuredArticle && articles.length === 0 ? (
              <div className="text-center py-12">
                {activeGameData ? (
                  <>
                    <div className="text-text-muted text-lg mb-4">
                      {t('pages_detail.news.no_news_for_game', { game: activeGameData.full_name })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedGame(null)}
                      className="px-6 py-2 bg-accent hover:bg-accent/80 text-text-inverse rounded-lg font-medium transition-colors"
                    >
                      {t('pages_detail.news.see_all_games')}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-text-muted text-lg mb-2">
                      {t('pages.home.news.no_news')}
                    </div>
                    <p className="text-text-muted-alt text-sm">
                      {t('pages.home.news.no_news_subtitle')}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-12">
                {/* Featured article (most recent) */}
                {featuredArticle && (
                  <FeaturedArticleCard
                    article={featuredArticle}
                  />
                )}

                {/* News articles section */}
                {articles.length > 0 && (
                  <div ref={articlesSectionRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {articles.map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pagination : une page vidée entre deux clics (currentPage > 1) garde son retour */}
            {!isLoadingArticles && (totalPages > 1 || currentPage > 1) && (
              <div className="mt-12 flex items-center justify-center gap-4">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-6 py-2 bg-bg-secondary hover:bg-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-lg font-medium transition-colors border border-border-primary"
                >
                  ← Précédent
                </button>

                <span className="text-text-secondary font-medium">
                  Page {currentPage} sur {Math.max(currentPage, totalPages)}
                </span>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-6 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed text-text-inverse rounded-lg font-medium transition-colors"
                >
                  Suivant →
                </button>
              </div>
            )}
          </div>

          {/* Ad column */}
          <AdColumn
            ads={ads}
            isSubscribed={isSubscribed}
            isLoading={isLoadingAds}
          />
        </div>
      </main>

      {/* Modale de recherche plein écran */}
      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent overlayVariant="default" className="w-[98vw] max-w-[1920px] h-[90vh] max-h-[90vh] p-0 gap-0 bg-background border-border-primary/50 flex flex-col [&>button]:hidden">
          <DialogTitle className="sr-only">{t('pages_detail.articles.search.placeholder_news')}</DialogTitle>
          {/* Header de la modale avec barre de recherche */}
          <div className="p-6 border-b border-border-primary/50 bg-background">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('pages_detail.articles.search.input_placeholder')}
                  className="w-full pl-12 pr-4 py-3 bg-bg-secondary/50 border border-border-primary/50 rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setIsSearchModalOpen(false);
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {searchQuery && (
              <p className="mt-3 text-sm text-text-muted">
                {filteredArticles.length} {filteredArticles.length === 1 ? t('pages_detail.articles.search.result_singular') : t('pages_detail.articles.search.result_plural')}
              </p>
            )}
          </div>

          {/* Contenu scrollable avec résultats */}
          <div className="flex-1 overflow-y-auto p-6 bg-background">
            {!searchQuery ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
                  <p className="text-text-secondary text-lg mb-2">{t('pages_detail.articles.search.start_typing')}</p>
                  <p className="text-text-muted text-sm">{t('pages_detail.articles.search.search_by')}</p>
                </div>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-50" />
                  <p className="text-text-secondary text-lg mb-2">{t('pages_detail.articles.search.no_results')}</p>
                  <p className="text-text-muted text-sm">{t('pages_detail.articles.search.try_other_keywords')}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {filteredArticles.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onClick={() => {
                      setIsSearchModalOpen(false);
                      setSearchQuery('');
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
