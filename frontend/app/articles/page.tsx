'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AdColumn from '../components/ads/AdColumn';
import { NewsItem, Advertisement } from '../types';
import { articleService } from '../services/articleService';
import { advertisementService } from '../services/advertisementService';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface ArticleCardProps {
  article: NewsItem;
  size: 1 | 2 | 3;
  onClick: (slug: string) => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, size, onClick }) => {
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  const getCardClasses = useMemo(() => {
    const baseClasses = "relative overflow-hidden rounded-lg cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group";

    switch (size) {
      case 1:
        return `${baseClasses} col-span-1`;
      case 2:
        return `${baseClasses} col-span-2`;
      case 3:
        return `${baseClasses} col-span-3`;
      default:
        return `${baseClasses} col-span-1`;
    }
  }, [size]);

  const getImageHeight = useMemo(() => {
    switch (size) {
      case 1:
        return "h-80";
      case 2:
        return "h-96";
      case 3:
        return "h-[28rem]";
      default:
        return "h-80";
    }
  }, [size]);

  const getTitleSize = useMemo(() => {
    switch (size) {
      case 1:
        return "text-lg";
      case 2:
        return "text-xl";
      case 3:
        return "text-2xl md:text-3xl";
      default:
        return "text-lg";
    }
  }, [size]);

  return (
    <article
      className={getCardClasses}
      onClick={() => onClick(article.slug)}
      role="button"
      tabIndex={0}
      aria-label={`Lire l'article: ${article.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(article.slug);
        }
      }}
    >
      <div className="relative h-full">
        <img
          src={article.featuredImage}
          alt={article.title}
          className={`w-full ${getImageHeight} object-cover transition-all duration-300 group-hover:brightness-75`}
          loading="lazy"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

        {/* Title content - positioned at top */}
        <div className="absolute top-4 left-4 right-4">
          <div className="mb-2">
            <span className="bg-pink-500 text-white px-3 py-1 rounded-full text-xs font-medium">
              {article.category}
            </span>
          </div>

          <h2 className={`${getTitleSize} font-bold text-white line-clamp-2 drop-shadow-lg`}>
            {article.title}
          </h2>

          {size >= 2 && article.subtitle && (
            <p className="text-gray-300 text-sm line-clamp-2 mt-2 drop-shadow-lg">
              {article.subtitle}
            </p>
          )}
        </div>

        {/* Additional info - appears at bottom on hover */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
            <div className="flex items-center space-x-2 mb-2 text-xs text-gray-300">
              <span>{formatDate(article.created_at)}</span>
              <span>•</span>
              <span>🕰️ {article.readTime} min</span>
              <span>•</span>
              <span>Par {article.author}</span>
            </div>

            {/* Description - show for all sizes but adjust content */}
            <p className="text-gray-300 text-sm line-clamp-2 mb-2">
              {size === 1
                ? article.subtitle || article.description
                : article.description
              }
            </p>

            {/* Tags - show for all sizes with responsive count */}
            {article.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {article.tags.slice(0, size === 1 ? 2 : size === 2 ? 3 : 4).map((tag, index) => (
                  <span
                    key={index}
                    className="bg-gray-700/80 text-gray-300 px-2 py-1 rounded text-xs"
                  >
                    #{tag}
                  </span>
                ))}
                {article.tags.length > (size === 1 ? 2 : size === 2 ? 3 : 4) && (
                  <span className="text-gray-400 text-xs">
                    +{article.tags.length - (size === 1 ? 2 : size === 2 ? 3 : 4)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default function ArticlesPage() {
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

  // Generate variable grid layout (excluding first article which is featured)
  const generateGridLayout = useMemo(() => {
    if (!articles.length) return [];

    // Skip the first article as it's featured
    const gridArticles = articles.slice(1);

    // Patterns that always fill a row (sum = 3) - favoring 3-card rows
    const rowPatterns = [
      [1, 1, 1],  // Three small cards
      [1, 1, 1],  // Three small cards (repeated for higher frequency)
      [1, 1, 1],  // Three small cards (repeated for higher frequency)
      [2, 1],     // Medium + small
      [1, 2],     // Small + medium
    ];

    const layout: { article: NewsItem; size: 1 | 2 | 3 }[] = [];
    let articleIndex = 0;
    let patternIndex = 0;

    while (articleIndex < gridArticles.length) {
      // Choose pattern based on remaining articles
      const remainingArticles = gridArticles.length - articleIndex;
      let selectedPattern;

      if (remainingArticles >= 3) {
        // We have enough articles, cycle through patterns (no 3-slot cards)
        selectedPattern = rowPatterns[patternIndex % rowPatterns.length];
        patternIndex++;
      } else if (remainingArticles === 2) {
        // Only 2 articles left, use [2, 1] or [1, 2]
        selectedPattern = patternIndex % 2 === 0 ? [2, 1] : [1, 2];
      } else {
        // Only 1 article left, make it a 2-slot card
        selectedPattern = [2];
      }

      for (const size of selectedPattern) {
        if (articleIndex >= gridArticles.length) break;

        layout.push({
          article: gridArticles[articleIndex],
          size: size as 1 | 2 | 3
        });

        articleIndex++;
      }
    }

    return layout;
  }, [articles]);

  // Group layout items by rows (sum = 3 per row)
  const groupedRows = useMemo(() => {
    const rows: { article: NewsItem; size: 1 | 2 | 3 }[][] = [];
    let currentRow: { article: NewsItem; size: 1 | 2 | 3 }[] = [];
    let currentRowSize = 0;

    for (const item of generateGridLayout) {
      if (currentRowSize + item.size <= 3) {
        currentRow.push(item);
        currentRowSize += item.size;

        if (currentRowSize === 3) {
          rows.push(currentRow);
          currentRow = [];
          currentRowSize = 0;
        }
      } else {
        // Démarrer une nouvelle ligne
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [item];
        currentRowSize = item.size;

        if (currentRowSize === 3) {
          rows.push(currentRow);
          currentRow = [];
          currentRowSize = 0;
        }
      }
    }

    // Ajouter la dernière ligne si elle n'est pas vide
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }, [generateGridLayout]);

  if (isLoadingArticles) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="flex gap-8">
          {/* Articles content */}
          <div className="flex-1 min-w-0">

{articles.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg mb-2">
                  📰 Aucun article disponible
                </div>
                <p className="text-gray-500 text-sm">
                  Revenez bientôt pour découvrir les dernières nouvelles de l'esport !
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Featured latest article */}
                {articles[0] && (
                  <div className="mb-10">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                      <span className="bg-pink-500 text-white px-2 py-1 rounded text-sm mr-2">
                        DERNIER ARTICLE
                      </span>
                    </h2>
                    <div
                      className="relative overflow-hidden rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl group"
                      onClick={() => handleArticleClick(articles[0].slug)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Lire l'article: ${articles[0].title}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleArticleClick(articles[0].slug);
                        }
                      }}
                    >
                      <div className="relative h-[32rem]">
                        <img
                          src={articles[0].featuredImage}
                          alt={articles[0].title}
                          className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-75"
                          loading="lazy"
                        />

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

                        {/* Title and category at top */}
                        <div className="absolute top-6 left-6 right-6">
                          <div className="mb-3">
                            <span className="bg-pink-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                              {articles[0].category}
                            </span>
                          </div>

                          <h3 className="text-3xl md:text-4xl font-bold text-white line-clamp-2 mb-4 drop-shadow-lg">
                            {articles[0].title}
                          </h3>

                          {articles[0].subtitle && (
                            <p className="text-gray-300 text-lg line-clamp-2 drop-shadow-lg">
                              {articles[0].subtitle}
                            </p>
                          )}
                        </div>

                        {/* Bottom content area for hover info */}
                        <div className="absolute bottom-0 left-0 right-0 p-6">

                          {/* Additional info on hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                            <div className="flex items-center space-x-3 mb-3 text-sm text-gray-300">
                              <span>{new Date(articles[0].created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })}</span>
                              <span>•</span>
                              <span>🕰️ {articles[0].readTime} min</span>
                              <span>•</span>
                              <span>Par {articles[0].author}</span>
                            </div>

                            <p className="text-gray-300 text-base line-clamp-3 mb-3">
                              {articles[0].description}
                            </p>

                            {articles[0].tags.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {articles[0].tags.slice(0, 5).map((tag, index) => (
                                  <span
                                    key={index}
                                    className="bg-gray-700/80 text-gray-300 px-3 py-1 rounded-full text-sm"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                                {articles[0].tags.length > 5 && (
                                  <span className="text-gray-400 text-sm">
                                    +{articles[0].tags.length - 5}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rest of articles grid */}
                <div className="space-y-6">
                  {groupedRows.map((row, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-3 gap-4">
                      {row.map((item, itemIndex) => (
                        <ArticleCard
                          key={`${rowIndex}-${itemIndex}-${item.article.id}`}
                          article={item.article}
                          size={item.size}
                          onClick={handleArticleClick}
                        />
                      ))}
                    </div>
                  ))}
                </div>
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