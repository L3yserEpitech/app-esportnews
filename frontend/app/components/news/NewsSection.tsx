'use client';

import { useCallback, useMemo } from 'react';
import { NewsItem } from '../../types';
import Card from '../ui/Card';
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
    // Navigation vers l'article (sera implémenté avec Next.js router)
    window.location.href = `/news/${slug}`;
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
          Actualités
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleViewAllClick}
          className="text-pink-400 hover:text-pink-300"
        >
          Voir tout →
        </Button>
      </div>

      {/* Article en vedette */}
      {isLoading ? (
        <NewsSkeleton variant="featured" className="w-full" />
      ) : memoizedFeaturedNews ? (
        <Card
          variant="elevated"
          padding="none"
          className="overflow-hidden cursor-pointer hover:border-pink-500/50 transition-all group"
          onClick={() => handleNewsClick(memoizedFeaturedNews.slug)}
          role="button"
          tabIndex={0}
          aria-label={`Lire l'article: ${memoizedFeaturedNews.title}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleNewsClick(memoizedFeaturedNews.slug);
            }
          }}
        >
          <div className="relative">
            <img
              src={memoizedFeaturedNews.featuredImage}
              alt={memoizedFeaturedNews.title}
              className="w-full h-48 md:h-64 object-cover transition-all duration-300 group-hover:brightness-75"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Overlay d'assombrissement au hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

            <div className="absolute bottom-0 left-0 right-0 p-6">
              {/* Catégorie et titre - remontent au hover */}
              <div className="transition-transform duration-300 group-hover:-translate-y-8">
                {/* Catégorie */}
                <div className="mb-2">
                  <span className="bg-pink-500 text-white px-2 py-1 rounded text-xs font-medium">
                    {memoizedFeaturedNews.category}
                  </span>
                </div>

                {/* Titre */}
                <h3 className="text-xl md:text-2xl font-bold text-white line-clamp-2">
                  {memoizedFeaturedNews.title}
                </h3>
              </div>

              {/* Informations supplémentaires - visibles au hover, apparaissent en dessous du titre */}
              <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 mt-2">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-gray-300 text-xs">
                    {formatDate(memoizedFeaturedNews.created_at)}
                  </span>
                  <span className="text-gray-400 text-xs">
                    🕰️ {memoizedFeaturedNews.readTime} min
                  </span>
                  <span className="text-gray-400 text-xs">
                    Par {memoizedFeaturedNews.author}
                  </span>
                </div>

                {memoizedFeaturedNews.subtitle && (
                  <p className="text-gray-300 text-sm line-clamp-2">
                    {memoizedFeaturedNews.subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Liste des actualités */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {memoizedNewsList.map((news) => (
          <Card
            key={news.id}
            variant="elevated"
            padding="none"
            className="overflow-hidden cursor-pointer hover:border-pink-500/50 transition-all group"
            onClick={() => handleNewsClick(news.slug)}
            role="button"
            tabIndex={0}
            aria-label={`Lire l'article: ${news.title}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNewsClick(news.slug);
              }
            }}
          >
            <div className="relative">
              <img
                src={news.featuredImage}
                alt={news.title}
                className="w-full h-64 md:h-72 object-cover transition-all duration-300 group-hover:brightness-75"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Overlay d'assombrissement au hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

              {/* Catégorie et titre - en haut de l'image */}
              <div className="absolute top-4 left-4 right-4">
                {/* Catégorie */}
                <div className="mb-2">
                  <span className="bg-pink-500 text-white px-2 py-1 rounded text-xs font-medium">
                    {news.category}
                  </span>
                </div>

                {/* Titre */}
                <h4 className="text-lg md:text-xl font-bold text-white line-clamp-2 drop-shadow-lg">
                  {news.title}
                </h4>
              </div>

              {/* Informations supplémentaires - en bas, visibles au hover */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-gray-300 text-xs">
                      {formatDate(news.created_at)}
                    </span>
                    <span className="text-gray-400 text-xs">
                      🕰️ {news.readTime} min
                    </span>
                    <span className="text-gray-400 text-xs">
                      Par {news.author}
                    </span>
                  </div>

                  {news.subtitle && (
                    <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                      {news.subtitle}
                    </p>
                  )}

                  <p className="text-gray-300 text-xs line-clamp-2">
                    {truncateText(news.description, 120)}
                  </p>

                  {news.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {news.tags.slice(0, 2).map((tag, index) => (
                        <span
                          key={index}
                          className="bg-gray-700/80 text-gray-300 px-2 py-1 rounded text-xs"
                        >
                          #{tag}
                        </span>
                      ))}
                      {news.tags.length > 2 && (
                        <span className="text-gray-400 text-xs">+{news.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!hasNews && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">
            📰 Aucune actualité disponible
          </div>
          <p className="text-gray-500 text-sm">
            Revenez bientôt pour découvrir les dernières nouvelles de l'esport !
          </p>
        </div>
      )}
    </section>
  );
};

export default NewsSection;
