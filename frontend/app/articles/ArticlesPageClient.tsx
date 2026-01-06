'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import AdColumn from '../components/ads/AdColumn';
import ArticleCard from '../components/article/ArticleCard';
import FeaturedArticleCard from '../components/article/FeaturedArticleCard';
import { NewsItem, Advertisement } from '../types';
import { articleService } from '../services/articleService';
import { advertisementService } from '../services/advertisementService';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

// Catégories prédéfinies (exclut "Actus")
const AVAILABLE_CATEGORIES = [
  'Portrait',
  'Guide',
  'Test produit',
  'Analyse',
  'Compétition',
  'Enquête',
  'Gaming',
  'Interview'
];

export default function ArticlesPageClient() {
  const t = useTranslations();
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [featuredArticle, setFeaturedArticle] = useState<NewsItem | null>(null);
  const [totalArticles, setTotalArticles] = useState(0);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NewsItem[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(''); // Empty = all categories (except Actus)
  const [currentPage, setCurrentPage] = useState(1);
  const ARTICLES_PER_PAGE = 9; // 3 lignes x 3 colonnes

  // Load featured article (most recent, excluding Actus)
  const loadFeaturedArticle = useCallback(async () => {
    try {
      const fetchedArticles = await articleService.getAllArticles({
        limit: 1,
        offset: 0,
        excludeNews: true, // Exclure les articles "Actus"
      });
      if (fetchedArticles.length > 0) {
        setFeaturedArticle(fetchedArticles[0]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'article featured:', error);
    }
  }, []);

  // Load paginated articles
  const loadArticles = useCallback(async () => {
    try {
      setIsLoadingArticles(true);
      const offset = 1 + (currentPage - 1) * ARTICLES_PER_PAGE; // Skip featured article
      const fetchedArticles = await articleService.getAllArticles({
        limit: ARTICLES_PER_PAGE,
        offset: offset,
        category: selectedCategory || undefined,
        excludeNews: true, // Exclure les articles "Actus" sur la page Articles
      });

      const totalCount = articleService.getLastTotalCount();
      setArticles(fetchedArticles);
      setTotalArticles(totalCount);

      console.log(`📄 Loaded ${fetchedArticles.length} articles (page ${currentPage})`);
      console.log(`📊 Total articles: ${totalCount}`);
    } catch (error) {
      console.error('Erreur lors du chargement des articles:', error);
    } finally {
      setIsLoadingArticles(false);
    }
  }, [currentPage, selectedCategory]);

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

  // Load featured article on mount
  useEffect(() => {
    loadFeaturedArticle();
    loadAds();
  }, [loadFeaturedArticle, loadAds]);

  // Load articles when page or category changes
  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // Load all articles for search when modal opens
  useEffect(() => {
    const loadSearchArticles = async () => {
      if (isSearchModalOpen && searchResults.length === 0) {
        try {
          setIsLoadingSearch(true);
          // Load all articles (no limit) for client-side search
          const allArticles = await articleService.getAllArticles({
            limit: 1000, // Large limit to get all articles
            offset: 0,
            excludeNews: true, // Exclure les articles "Actus" de la recherche
          });
          setSearchResults(allArticles);
        } catch (error) {
          console.error('Erreur lors du chargement des articles de recherche:', error);
        } finally {
          setIsLoadingSearch(false);
        }
      }
    };

    loadSearchArticles();
  }, [isSearchModalOpen, searchResults.length]);

  // Filter search results client-side
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const query = searchQuery.toLowerCase().trim();
    return searchResults.filter((article) => {
      const titleMatch = article.title?.toLowerCase().includes(query);
      const descriptionMatch = article.description?.toLowerCase().includes(query);
      const subtitleMatch = article.subtitle?.toLowerCase().includes(query);
      const categoryMatch = article.category?.toLowerCase().includes(query);
      const authorMatch = article.author?.toLowerCase().includes(query);
      const tagsMatch = article.tags?.some((tag) => tag.toLowerCase().includes(query));

      return titleMatch || descriptionMatch || subtitleMatch || categoryMatch || authorMatch || tagsMatch;
    });
  }, [searchResults, searchQuery]);

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

  const handleArticleClick = useCallback((slug: string) => {
    window.location.href = `/article/${slug}`;
  }, []);

  // Calculate total pages (subtract 1 for featured article)
  const totalPages = Math.max(1, Math.ceil((totalArticles - 1) / ARTICLES_PER_PAGE));

  // Ref pour la section des articles
  const articlesSectionRef = useRef<HTMLDivElement>(null);

  // Scroll vers la section des articles lors du changement de page
  useEffect(() => {
    if (articlesSectionRef.current) {
      articlesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

  // Gérer la sélection de catégorie
  const handleCategoryClick = useCallback((category: string) => {
    if (selectedCategory === category) {
      // Clic sur la même catégorie = désélectionner (afficher tout)
      setSelectedCategory('');
    } else {
      setSelectedCategory(category);
    }
    setCurrentPage(1); // Reset à la page 1 lors du changement de filtre
  }, [selectedCategory]);

  // Afficher toutes les catégories
  const handleShowAll = useCallback(() => {
    setSelectedCategory('');
    setCurrentPage(1);
  }, []);

  if (isLoadingArticles) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="flex gap-8">
          {/* Articles content */}
          <div className="flex-1 min-w-0">
            <div className="space-y-12">
              {/* Barre de recherche */}
              <div className="mb-8 mt-3">
                <button
                  onClick={() => setIsSearchModalOpen(true)}
                  className="w-full max-w-md flex items-center justify-center gap-3 px-4 py-3 bg-bg-secondary/50 border border-border-primary/50 rounded-xl text-left text-text-secondary hover:border-border-primary hover:bg-bg-secondary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
                  <span className="text-sm">{t('pages_detail.articles.search.placeholder_article')}</span>
                  <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-text-muted bg-bg-tertiary border border-border-primary/50 rounded">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </button>
              </div>

              {/* Article Featured (le plus récent) - TOUJOURS AFFICHÉ */}
              {featuredArticle && (
                <FeaturedArticleCard
                  article={featuredArticle}
                  onClick={handleArticleClick}
                />
              )}

              {/* Barre de catégories - TOUJOURS AFFICHÉE */}
              <div className="mb-6">
                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-semibold text-text-primary">Catégories</h3>
                  <div className="flex flex-wrap gap-2">
                    {/* Bouton "Tout" */}
                    <button
                      onClick={handleShowAll}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        selectedCategory === ''
                          ? 'bg-accent hover:bg-accent/80 text-white'
                          : 'bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-primary'
                      }`}
                    >
                      Tout
                    </button>

                    {/* Boutons catégories prédéfinies */}
                    {AVAILABLE_CATEGORIES.map((category) => (
                      <button
                        key={category}
                        onClick={() => handleCategoryClick(category)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                          selectedCategory === category
                            ? 'bg-accent hover:bg-accent/80 text-white'
                            : 'bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-primary'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Articles paginés */}
              {articles.length > 0 ? (
                <>
                    <div ref={articlesSectionRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {articles.map((article) => (
                        <ArticleCard
                          key={article.id}
                          article={article}
                          onClick={handleArticleClick}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-8 flex items-center justify-center gap-4">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="px-6 py-2 bg-bg-secondary hover:bg-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-lg font-medium transition-colors border border-border-primary"
                        >
                          ← Précédent
                        </button>

                        <span className="text-text-secondary font-medium">
                          Page {currentPage} sur {totalPages}
                        </span>

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="px-6 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed text-text-inverse rounded-lg font-medium transition-colors"
                        >
                          Suivant →
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-text-secondary text-lg mb-2">
                      Aucun article trouvé
                    </p>
                    <p className="text-text-muted text-sm">
                      Essayez de sélectionner d'autres catégories
                    </p>
                  </div>
                )}
            </div>
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
          <DialogTitle className="sr-only">{t('pages_detail.articles.search.placeholder_article')}</DialogTitle>
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
                    onClick={(slug) => {
                      setIsSearchModalOpen(false);
                      setSearchQuery('');
                      handleArticleClick(slug);
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
