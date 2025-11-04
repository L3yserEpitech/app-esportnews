'use client';

import { useState, useEffect } from 'react';
import { Article, NewsItem, Advertisement } from '@/app/types';
import { articleService } from '@/app/services/articleService';
import { advertisementService } from '@/app/services/advertisementService';
import AdColumn from '@/app/components/ads/AdColumn';
import LoadingSpinner from '@/app/components/ui/LoadingSpinner';
import ArticleContent from '@/app/components/article/ArticleContent';
import ArticleCover from '@/app/components/article/ArticleCover';
import ArticleCard from '@/app/components/article/ArticleCard';
import { ArticleSchema } from '@/app/components/seo/StructuredData';
import Link from 'next/link';

interface ArticlePageClientProps {
  slug: string;
}

export default function ArticlePageClient({ slug }: ArticlePageClientProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [similarArticles, setSimilarArticles] = useState<NewsItem[]>([]);
  const [recentArticles, setRecentArticles] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingArticle, setIsLoadingArticle] = useState(true);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);

  useEffect(() => {
    const loadArticle = async () => {
      try {
        setIsLoadingArticle(true);
        const fetchedArticle = await articleService.getArticleBySlug(slug);
        setArticle(fetchedArticle);

        if (fetchedArticle) {
          const similar = await articleService.getSimilarArticles(
            fetchedArticle.tags,
            fetchedArticle.slug,
            3
          );
          setSimilarArticles(similar);

          // Charger les articles récents
          const allArticles = await articleService.getAllArticles();
          const recent = allArticles
            .filter(a => a.slug !== fetchedArticle.slug)
            .slice(0, 3);
          setRecentArticles(recent);
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l\'article:', error);
      } finally {
        setIsLoadingArticle(false);
      }
    };

    const loadAds = async () => {
      try {
        setIsLoadingAds(true);
        const fetchedAds = await advertisementService.getActiveAdvertisements();
        setAds(fetchedAds);
      } catch (error) {
        console.error('Erreur lors du chargement des publicités:', error);
      } finally {
        setIsLoadingAds(false);
      }
    };

    if (slug) {
      loadArticle();
      loadAds();
    }
  }, [slug]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (isLoadingArticle) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Article non trouvé</h1>
          <p className="text-gray-400 mb-6">L'article que vous recherchez n'existe pas ou a été supprimé.</p>
          <Link
            href="/articles"
            className="inline-block bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Retour aux articles
          </Link>
        </div>
      </div>
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
  const articleUrl = `${siteUrl}/article/${article?.slug}`;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Structured Data pour SEO */}
      {article && (
        <ArticleSchema
          title={article.title}
          description={article.description || article.subtitle || ''}
          content={article.content || ''}
          image={article.featuredImage}
          datePublished={article.created_at}
          author={article.author}
          url={articleUrl}
        />
      )}

      <main className="container mx-auto md:px-4 md:py-8 pt-20 md:pt-24">
        <div className="flex gap-8 mt-3">
          {/* Article content */}
          <div className="flex-1 min-w-0">

            {/* Article header */}
            <article className="bg-gray-900 md:rounded-xl overflow-hidden">
              {/* Featured image or video */}
              <div className="relative w-full">
                <ArticleCover
                  featuredImage={article.featuredImage}
                  title={article.title}
                  className="w-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
              </div>

              {/* Article meta and content */}
              <div className="px-4 md:px-8 py-6">
                {/* Category badge */}
                <div className="mb-4">
                  <span className="bg-pink-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                    {article.category}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                  {article.title}
                </h1>

                {/* Subtitle */}
                {article.subtitle && (
                  <h2 className="text-xl text-gray-300 mb-6">
                    {article.subtitle}
                  </h2>
                )}

                {/* Meta info */}
                <div className="flex items-center space-x-4 text-gray-400 mb-6 pb-6 border-b border-gray-800">
                  <div className="flex items-center space-x-2">
                    <span>Par</span>
                    <span className="text-white font-medium">{article.author}</span>
                  </div>
                  <span>•</span>
                  <span>{formatDate(article.created_at)}</span>
                  <span>•</span>
                  <span>{article.readTime} min de lecture</span>
                </div>

                {/* Tags */}
                {article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-8">
                    {article.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm hover:bg-gray-700 transition-colors"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Article content */}
                <div className="mb-8">
                  <ArticleContent content={article.content_black || article.content} />
                </div>

              </div>
            </article>

            {/* Similar articles section */}
            {similarArticles.length > 0 && (
              <div className="mt-12 px-4 md:px-0">
                <h2 className="text-2xl font-bold text-white mb-6">Voir aussi</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {similarArticles.map((similarArticle) => (
                    <ArticleCard key={similarArticle.id} article={similarArticle} />
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
