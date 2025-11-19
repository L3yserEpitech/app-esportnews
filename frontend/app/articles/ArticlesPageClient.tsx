'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AdColumn from '../components/ads/AdColumn';
import ArticleCard from '../components/article/ArticleCard';
import FeaturedArticleCard from '../components/article/FeaturedArticleCard';
import { NewsItem, Advertisement } from '../types';
import { articleService } from '../services/articleService';
import { advertisementService } from '../services/advertisementService';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function ArticlesPageClient() {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);

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
                  📰 Aucun article disponible
                </div>
                <p className="text-text-muted text-sm">
                  Revenez bientôt pour découvrir les dernières nouvelles de l'esport !
                </p>
              </div>
            ) : (
              <div className="space-y-12">
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
    </div>
  );
}
