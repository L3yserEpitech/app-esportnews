'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Head from 'next/head';
import { Article, NewsItem, Advertisement } from '@/app/types';
import { articleService } from '@/app/services/articleService';
import { advertisementService } from '@/app/services/advertisementService';
import AdColumn from '@/app/components/ads/AdColumn';
import LoadingSpinner from '@/app/components/ui/LoadingSpinner';
import ArticleContent from '@/app/components/article/ArticleContent';
import Link from 'next/link';

export default function ArticlePage() {
  const params = useParams();
  const slug = params.slug as string;

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

  return (
    <>
      <Head>
        <title>{article.title} | EsportNews</title>
        <meta name="description" content={article.description} />
        <meta name="keywords" content={article.tags.join(', ')} />
        <meta name="author" content={article.author} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.description} />
        <meta property="og:image" content={article.featuredImage} />
        <meta property="article:published_time" content={article.created_at} />
        <meta property="article:author" content={article.author} />
        <meta property="article:section" content={article.category} />
        {article.tags.map(tag => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={article.description} />
        <meta name="twitter:image" content={article.featuredImage} />
      </Head>

      <div className="min-h-screen bg-gray-950">
        <main className="container mx-auto md:px-4 md:py-8 pt-20 md:pt-24">
          <div className="flex gap-8">
            {/* Article content */}
            <div className="flex-1 min-w-0">
              {/* Breadcrumb */}
              <nav className="hidden md:block mb-6 text-sm" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-2 text-gray-400">
                  <li>
                    <Link href="/" className="hover:text-pink-500 transition-colors">
                      Accueil
                    </Link>
                  </li>
                  <li>/</li>
                  <li>
                    <Link href="/articles" className="hover:text-pink-500 transition-colors">
                      Articles
                    </Link>
                  </li>
                  <li>/</li>
                  <li className="text-gray-500 truncate">{article.title}</li>
                </ol>
              </nav>

              {/* Article header */}
              <article className="bg-gray-900 md:rounded-xl overflow-hidden">
                {/* Featured image */}
                <div className="relative w-full">
                  <img
                    src={article.featuredImage}
                    alt={article.title}
                    className="w-full h-auto object-contain"
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
                    <span>🕰️ {article.readTime} min de lecture</span>
                    <span>•</span>
                    <span>👁️ {article.views} vues</span>
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

              {/* Recent articles section */}
              {recentArticles.length > 0 && (
                <div className="mt-12 px-4 md:px-0">
                  <h2 className="text-2xl font-bold text-white mb-6">Articles récents</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {recentArticles.map((recentArticle) => (
                      <article
                        key={recentArticle.id}
                        className="relative overflow-hidden rounded-lg cursor-pointer transition-all duration-300 hover:shadow-xl group"
                        onClick={() => window.location.href = `/article/${recentArticle.slug}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Lire l'article: ${recentArticle.title}`}
                      >
                        <div className="relative h-full">
                          <img
                            src={recentArticle.featuredImage}
                            alt={recentArticle.title}
                            className="w-full h-80 object-cover transition-all duration-[500ms] group-hover:scale-102 group-hover:brightness-75"
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
                                {recentArticle.category}
                              </span>
                            </div>

                            <h2 className="text-lg font-bold text-white line-clamp-2 drop-shadow-lg">
                              {recentArticle.title}
                            </h2>
                          </div>

                          {/* Additional info - appears at bottom on hover */}
                          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                            <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                              <div className="flex items-center space-x-2 mb-2 text-xs text-gray-300">
                                <span>{formatDate(recentArticle.created_at)}</span>
                                <span>•</span>
                                <span>🕰️ {recentArticle.readTime} min</span>
                                <span>•</span>
                                <span>Par {recentArticle.author}</span>
                              </div>

                              {/* Description */}
                              <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                                {recentArticle.subtitle || recentArticle.description}
                              </p>

                              {/* Tags */}
                              {recentArticle.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {recentArticle.tags.slice(0, 2).map((tag, index) => (
                                    <span
                                      key={index}
                                      className="bg-gray-700/80 text-gray-300 px-2 py-1 rounded text-xs"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                  {recentArticle.tags.length > 2 && (
                                    <span className="text-gray-400 text-xs">
                                      +{recentArticle.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {/* Similar articles section */}
              {similarArticles.length > 0 && (
                <div className="mt-12 px-4 md:px-0">
                  <h2 className="text-2xl font-bold text-white mb-6">Voir aussi</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {similarArticles.map((similarArticle) => (
                      <article
                        key={similarArticle.id}
                        className="relative overflow-hidden rounded-lg cursor-pointer transition-all duration-300 hover:shadow-xl group"
                        onClick={() => window.location.href = `/article/${similarArticle.slug}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Lire l'article: ${similarArticle.title}`}
                      >
                        <div className="relative h-full">
                          <img
                            src={similarArticle.featuredImage}
                            alt={similarArticle.title}
                            className="w-full h-80 object-cover transition-all duration-[500ms] group-hover:scale-102 group-hover:brightness-75"
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
                                {similarArticle.category}
                              </span>
                            </div>

                            <h2 className="text-lg font-bold text-white line-clamp-2 drop-shadow-lg">
                              {similarArticle.title}
                            </h2>
                          </div>

                          {/* Additional info - appears at bottom on hover */}
                          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                            <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                              <div className="flex items-center space-x-2 mb-2 text-xs text-gray-300">
                                <span>{formatDate(similarArticle.created_at)}</span>
                                <span>•</span>
                                <span>🕰️ {similarArticle.readTime} min</span>
                                <span>•</span>
                                <span>Par {similarArticle.author}</span>
                              </div>

                              {/* Description */}
                              <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                                {similarArticle.subtitle || similarArticle.description}
                              </p>

                              {/* Tags */}
                              {similarArticle.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {similarArticle.tags.slice(0, 2).map((tag, index) => (
                                    <span
                                      key={index}
                                      className="bg-gray-700/80 text-gray-300 px-2 py-1 rounded text-xs"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                  {similarArticle.tags.length > 2 && (
                                    <span className="text-gray-400 text-xs">
                                      +{similarArticle.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
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
    </>
  );
}
