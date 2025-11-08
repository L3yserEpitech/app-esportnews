'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { NewsItem } from '../../types';
import ArticleCard from '../article/ArticleCard';
import FeaturedArticleCard from '../article/FeaturedArticleCard';
import Button from '../ui/Button';
import NewsSkeleton from '../ui/NewsSkeleton';

interface NewsSectionProps {
  featuredNews?: NewsItem | null;
  newsList: NewsItem[];
  isLoading?: boolean;
  className?: string;
}

const NewsSection: React.FC<NewsSectionProps> = ({
  featuredNews,
  newsList,
  isLoading = false,
  className = ''
}) => {
  const t = useTranslations();
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  const truncateText = useCallback((text: string, maxLength: number) => {
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  }, []);

  const handleNewsClick = useCallback((slug: string) => {
    window.location.href = `/article/${slug}`;
  }, []);

  const handleViewAllClick = useCallback(() => {
    window.location.href = '/articles';
  }, []);

  // Mémorisation pour éviter les recalculs
  const hasNews = useMemo(() => newsList.length > 0 || !!featuredNews, [newsList.length, featuredNews]);
  const memoizedNewsList = useMemo(() => newsList, [newsList]);
  const memoizedFeaturedNews = useMemo(() => featuredNews, [featuredNews]);

  return (
    <section className={`space-y-6 ${className}`} aria-labelledby="news-section">
      <div className="flex items-center justify-between">
        <h2 id="news-section" className="text-2xl font-bold text-white">
          {t('pages.home.news.title')}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleViewAllClick}
          className="text-pink-400 hover:text-pink-300"
        >
          {t('pages.home.news.view_all_button')}
        </Button>
      </div>

      {/* Article en vedette */}
      {isLoading ? (
        <NewsSkeleton variant="featured" className="w-full" />
      ) : memoizedFeaturedNews ? (
        <FeaturedArticleCard
          article={memoizedFeaturedNews}
          onClick={handleNewsClick}
        />
      ) : null}

      {/* Liste des actualités */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {memoizedNewsList.map((news) => (
          <ArticleCard
            key={news.id}
            article={news}
            onClick={handleNewsClick}
          />
        ))}
      </div>

      {!hasNews && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">
            {t('pages.home.news.no_news')}
          </div>
          <p className="text-gray-500 text-sm">
            {t('pages.home.news.no_news_subtitle')}
          </p>
        </div>
      )}
    </section>
  );
};

export default NewsSection;
