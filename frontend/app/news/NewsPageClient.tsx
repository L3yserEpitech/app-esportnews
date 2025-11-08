'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import AdColumn from '../components/ads/AdColumn';
import ArticleCard from '../components/article/ArticleCard';
import FeaturedArticleCard from '../components/article/FeaturedArticleCard';
import { NewsItem, Advertisement } from '../types';
import { articleService } from '../services/articleService';
import { advertisementService } from '../services/advertisementService';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function NewsPage() {
  const t = useTranslations();
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);

  // Load all articles and filter by "Actualité" category
  const loadArticles = useCallback(async () => {
    try {
      setIsLoadingArticles(true);
      const fetchedArticles = await articleService.getAllArticles();
      // Filter only articles with "Actualité" category
      const newsArticles = fetchedArticles.filter(
        article => article.category === 'Actualité'
      );
      setArticles(newsArticles);
    } catch (error) {
      console.error('Erreur lors du chargement des actualités:', error);
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

  // Article le plus récent (featured)
  const featuredArticle = useMemo(() => {
    if (articles.length === 0) return null;
    return [...articles].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }, [articles]);

  // Remaining articles sorted by date (most recent first), excluding featured
  const newsArticles = useMemo(() => {
    const articlesWithoutFeatured = articles.filter(
      article => article.id !== featuredArticle?.id
    );

    return articlesWithoutFeatured.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
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
          {/* News content */}
          <div className="flex-1 min-w-0">
            {articles.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-text-muted text-lg mb-2">
                  {t('pages.home.news.no_news')}
                </div>
                <p className="text-text-muted-alt text-sm">
                  {t('pages.home.news.no_news_subtitle')}
                </p>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Featured article (most recent) */}
                {featuredArticle && (
                  <FeaturedArticleCard
                    article={featuredArticle}
                    onClick={handleArticleClick}
                  />
                )}

                {/* News articles section */}
                {newsArticles.length > 0 && (
                  <section className="space-y-6">
                    {/* Section header */}

                    {/* News articles grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {newsArticles.map((article) => (
                        <ArticleCard
                          key={article.id}
                          article={article}
                          onClick={handleArticleClick}
                        />
                      ))}
                    </div>
                  </section>
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
    </div>
  );
}
