'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

  // Grouper les articles par catégorie et trier par date (plus récent au plus vieux)
  // Exclure l'article featured et les articles de la catégorie "Actus"
  const articlesByCategory = useMemo(() => {
    const articlesWithoutFeatured = articles.filter(
      article => article.id !== featuredArticle?.id
    );

    // Filtrer les articles (exclure la catégorie "Actus")
    const filteredArticles = articlesWithoutFeatured.filter(
      article => article.category !== 'Actus'
    );

    // Grouper par catégorie
    const grouped = filteredArticles.reduce((acc, article) => {
      const category = article.category || 'Non catégorisé';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(article);
      return acc;
    }, {} as Record<string, NewsItem[]>);

    // Trier chaque catégorie par date (plus récent en premier)
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    // Trier les catégories par le nombre d'articles (décroissant)
    return Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);
  }, [articles, featuredArticle]);

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

                {/* Articles groupés par catégorie */}
                {articlesByCategory.map(([category, categoryArticles]) => (
                  <section key={category} className="space-y-6">
                    {/* Divider de catégorie */}
                    <div className="relative">
                      <div className="bg-gradient-to-r from-bg-tertiary/80 to-bg-secondary/40 rounded-xl border border-border-primary/50 overflow-hidden">
                        <div className="px-6 py-4 flex items-center gap-4">
                          <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-text-primary">
                              {category}
                            </h2>
                            <span className="bg-accent/20 text-accent px-2.5 py-1 rounded-full text-xs font-medium">
                              {categoryArticles.length}
                            </span>
                          </div>
                          <div className="flex-1 h-px bg-gradient-to-r from-border-muted/50 to-transparent"></div>
                        </div>
                      </div>
                    </div>

                    {/* Articles de la catégorie */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {categoryArticles.map((article) => (
                        <ArticleCard
                          key={article.id}
                          article={article}
                          onClick={handleArticleClick}
                        />
                      ))}
                    </div>
                  </section>
                ))}
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
