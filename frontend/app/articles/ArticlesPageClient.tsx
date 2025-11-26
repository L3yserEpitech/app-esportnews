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

export default function ArticlesPageClient() {
  const t = useTranslations();
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const ARTICLES_PER_PAGE = 9; // 3 lignes x 3 colonnes

  // Load all articles
  const loadArticles = useCallback(async () => {
    try {
      setIsLoadingArticles(true);
      const fetchedArticles = await articleService.getAllArticles();
      setArticles(fetchedArticles);
    } catch (error) {
      console.error('Erreur lors du chargement des articles:', error);
    } finally {
      setIsLoadingArticles(false);
    }
  }, []);

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
    loadArticles();
    loadAds();
  }, [loadArticles, loadAds]);

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

  // Article le plus récent (featured) - exclure les articles "Actus"
  const featuredArticle = useMemo(() => {
    if (articles.length === 0) return null;
    const nonActualityArticles = articles.filter(
      article => article.category !== 'Actus'
    );
    if (nonActualityArticles.length === 0) return null;
    return [...nonActualityArticles].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }, [articles]);

  // Filtrer les articles selon la recherche (exclure les articles "Actus")
  const filteredArticles = useMemo(() => {
    // Exclure d'abord les articles "Actus"
    const articlesWithoutActus = articles.filter(
      article => article.category !== 'Actus'
    );

    if (!searchQuery.trim()) {
      return articlesWithoutActus;
    }

    const query = searchQuery.toLowerCase().trim();
    return articlesWithoutActus.filter((article) => {
      const titleMatch = article.title?.toLowerCase().includes(query);
      const descriptionMatch = article.description?.toLowerCase().includes(query);
      const subtitleMatch = article.subtitle?.toLowerCase().includes(query);
      const categoryMatch = article.category?.toLowerCase().includes(query);
      const authorMatch = article.author?.toLowerCase().includes(query);
      const tagsMatch = article.tags?.some((tag) => tag.toLowerCase().includes(query));

      return titleMatch || descriptionMatch || subtitleMatch || categoryMatch || authorMatch || tagsMatch;
    });
  }, [articles, searchQuery]);

  // Obtenir toutes les catégories disponibles (exclure "Actus")
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    articles.forEach(article => {
      if (article.category && article.category !== 'Actus') {
        categories.add(article.category);
      }
    });
    return Array.from(categories).sort();
  }, [articles]);

  // Initialiser les catégories sélectionnées avec toutes les catégories au chargement
  useEffect(() => {
    if (availableCategories.length > 0 && selectedCategories.size === 0) {
      setSelectedCategories(new Set(availableCategories));
    }
  }, [availableCategories, selectedCategories.size]);

  // Filtrer et trier les articles selon les catégories sélectionnées
  const filteredAndSortedArticles = useMemo(() => {
    const articlesWithoutFeatured = articles.filter(
      article => article.id !== featuredArticle?.id && article.category !== 'Actus'
    );

    // Filtrer par catégories sélectionnées
    let filtered = articlesWithoutFeatured;
    if (selectedCategories.size > 0) {
      filtered = articlesWithoutFeatured.filter(article =>
        article.category && selectedCategories.has(article.category)
      );
    }

    // Trier par date (plus récent en premier)
    return filtered.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [articles, featuredArticle, selectedCategories]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedArticles.length / ARTICLES_PER_PAGE);
  const paginatedArticles = useMemo(() => {
    const startIndex = (currentPage - 1) * ARTICLES_PER_PAGE;
    return filteredAndSortedArticles.slice(startIndex, startIndex + ARTICLES_PER_PAGE);
  }, [filteredAndSortedArticles, currentPage]);

  // Ref pour la section des articles
  const articlesSectionRef = useRef<HTMLDivElement>(null);

  // Scroll vers la section des articles lors du changement de page
  useEffect(() => {
    if (articlesSectionRef.current) {
      articlesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

  // Gérer la sélection/désélection des catégories
  const toggleCategory = useCallback((category: string) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
    setCurrentPage(1); // Reset à la page 1 lors du changement de filtre
  }, []);

  // Sélectionner/désélectionner toutes les catégories
  const toggleAllCategories = useCallback(() => {
    if (selectedCategories.size === availableCategories.length) {
      setSelectedCategories(new Set());
    } else {
      setSelectedCategories(new Set(availableCategories));
    }
    setCurrentPage(1);
  }, [selectedCategories.size, availableCategories]);

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
            {articles.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-text-secondary text-lg mb-2">
                  📰 {t('pages_detail.articles.aucun_article')}
                </div>
                <p className="text-text-muted text-sm">
                  {t('pages_detail.articles.revenez_decouvrir')}
                </p>
              </div>
            ) : (
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

                {/* Article Featured (le plus récent) */}
                {featuredArticle && (
                  <FeaturedArticleCard
                    article={featuredArticle}
                    onClick={handleArticleClick}
                  />
                )}

                {/* Filtres de catégories */}
                {availableCategories.length > 0 && (
                  <div className="mb-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-text-primary">Filtrer par catégorie</h3>
                        <button
                          onClick={toggleAllCategories}
                          className="text-sm text-accent hover:text-accent/80 transition-colors"
                        >
                          {selectedCategories.size === availableCategories.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableCategories.map((category) => (
                          <button
                            key={category}
                            onClick={() => toggleCategory(category)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                              selectedCategories.has(category)
                                ? 'bg-pink-600 hover:bg-pink-700 text-white'
                                : 'bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-primary'
                            }`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Articles paginés */}
                {filteredAndSortedArticles.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {paginatedArticles.map((article) => (
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
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] max-h-[90vh] p-0 gap-0 bg-bg-primary border-border-primary/50 flex flex-col [&>button]:hidden">
          <DialogTitle className="sr-only">{t('pages_detail.articles.search.placeholder_article')}</DialogTitle>
          {/* Header de la modale avec barre de recherche */}
          <div className="p-6 border-b border-border-primary/50">
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
          <div className="flex-1 overflow-y-auto p-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
