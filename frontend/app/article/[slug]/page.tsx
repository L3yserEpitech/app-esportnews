import { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Article, NewsItem, SupabaseArticle } from '@/app/types';
import ArticleCover from '@/app/components/article/ArticleCover';
import ArticleBody from '@/app/components/article/ArticleBody';
import ArticleCard from '@/app/components/article/ArticleCard';
import ArticleSidebar from './ArticleSidebar';
import { ArticleSchema, BreadcrumbSchema } from '@/app/components/seo/StructuredData';
import { generateBreadcrumbs } from '@/app/lib/breadcrumbHelper';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

function calculateReadTime(content: string | undefined): number {
  if (!content) return 0;
  const text = content.replace(/<[^>]*>/g, '');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function toArticle(data: SupabaseArticle): Article {
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    subtitle: data.subtitle,
    description: data.description,
    author: data.author,
    created_at: data.created_at,
    readTime: calculateReadTime(data.content),
    featuredImage: data.featuredImage,
    category: data.category,
    credit: data.credit,
    tags: data.tags || [],
    views: data.views || 0,
    content: data.content,
    content_black: data.content_black,
    content_white: data.content_white,
  };
}

function toNewsItem(data: SupabaseArticle): NewsItem {
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    subtitle: data.subtitle,
    description: data.description,
    author: data.author,
    created_at: data.created_at,
    readTime: calculateReadTime(data.content),
    featuredImage: data.featuredImage,
    category: data.category,
    credit: data.credit,
    tags: data.tags || [],
    views: data.views || 0,
  };
}

// React.cache dedupes the article fetch between generateMetadata and the
// page render so we hit the backend once per request, not twice.
const fetchArticle = cache(async (slug: string): Promise<Article | null> => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/articles/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data: SupabaseArticle = await res.json();
    return toArticle(data);
  } catch (error) {
    console.error('[ArticlePage] Error fetching article:', error);
    return null;
  }
});

async function fetchSimilarArticles(slug: string, limit = 3): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/articles/${slug}/similar?limit=${limit}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const data: SupabaseArticle[] = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(toNewsItem);
  } catch (error) {
    console.error('[ArticlePage] Error fetching similar articles:', error);
    return [];
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticle(slug);

  if (!article) {
    return {
      title: 'Article non trouvé | EsportNews',
      description: "L'article que vous recherchez n'existe pas.",
    };
  }

  const url = `${SITE_URL}/article/${article.slug}`;
  const description =
    article.description || article.subtitle || "Lire l'article complet sur EsportNews";

  return {
    title: `${article.title} | EsportNews`,
    description,
    keywords: article.tags?.join(', '),
    authors: [{ name: article.author || 'EsportNews' }],
    openGraph: {
      title: article.title,
      description,
      type: 'article',
      url,
      images: article.featuredImage
        ? [
            {
              url: article.featuredImage,
              width: 1200,
              height: 630,
              alt: article.title,
            },
          ]
        : [],
      publishedTime: article.created_at,
      authors: [article.author || 'EsportNews'],
      tags: article.tags || [],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      images: article.featuredImage ? [article.featuredImage] : [],
    },
    alternates: {
      canonical: url,
    },
  };
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function ArticlePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) notFound();

  const similarArticles = await fetchSimilarArticles(slug, 3);

  const articleUrl = `${SITE_URL}/article/${article.slug}`;
  const breadcrumbs = generateBreadcrumbs([
    { name: 'Articles', url: `${SITE_URL}/articles` },
    { name: article.title, url: articleUrl },
  ]);

  const contentDark = article.content_black ?? article.content ?? '';
  const contentLight = article.content_white ?? article.content ?? '';

  return (
    <div className="min-h-screen bg-bg-primary">
      <ArticleSchema
        title={article.title}
        description={article.description || article.subtitle || ''}
        image={article.featuredImage}
        datePublished={article.created_at}
        author={article.author}
        url={articleUrl}
      />
      <BreadcrumbSchema items={breadcrumbs} />

      <main className="container mx-auto md:px-4 md:py-8 pt-20 md:pt-24">
        <div className="flex gap-8 mt-3">
          <div className="flex-1 min-w-0">
            <nav
              aria-label="Fil d'Ariane"
              className="px-4 md:px-0 mb-4 text-sm text-text-secondary"
            >
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <Link href="/" className="hover:text-text-primary">Accueil</Link>
                </li>
                <li aria-hidden="true">›</li>
                <li>
                  <Link href="/articles" className="hover:text-text-primary">Articles</Link>
                </li>
                <li aria-hidden="true">›</li>
                <li className="text-text-primary line-clamp-1" aria-current="page">
                  {article.title}
                </li>
              </ol>
            </nav>

            <article className="bg-bg-secondary md:rounded-xl overflow-hidden border border-border-primary">
              <div className="relative w-full">
                <ArticleCover
                  featuredImage={article.featuredImage}
                  title={article.title}
                  className="w-full"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-secondary via-transparent to-transparent" />
              </div>

              <div className="px-4 md:px-8 py-6">
                <div className="mb-4 w-full flex items-center justify-between">
                  <span className="bg-[#F22E62] text-white px-4 py-2 rounded-full text-sm font-medium">
                    {article.category}
                  </span>
                  {article.credit && (
                    <span className="text-text-secondary text-sm italic">
                      {article.credit}
                    </span>
                  )}
                </div>

                <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-4">
                  {article.title}
                </h1>

                {article.subtitle && (
                  <h2 className="text-xl text-text-secondary mb-6">
                    {article.subtitle}
                  </h2>
                )}

                <div className="flex items-center space-x-4 text-text-secondary mb-6 pb-6 border-b border-border-primary">
                  <div className="flex items-center space-x-2">
                    <span>Par</span>
                    <span className="text-text-primary font-medium">{article.author}</span>
                  </div>
                  <span>•</span>
                  <span>{formatDate(article.created_at)}</span>
                  <span>•</span>
                  <span>{article.readTime} min de lecture</span>
                </div>

                <div className="mb-8">
                  <ArticleBody contentDark={contentDark} contentLight={contentLight} />
                </div>

                {article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-8">
                    {article.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-[#F22E62] text-white px-3 py-1 rounded-full text-sm hover:bg-[#F22E62]/80 transition-colors"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>

            {similarArticles.length > 0 && (
              <div className="mt-12 px-4 md:px-0">
                <h2 className="text-2xl font-bold text-text-primary mb-6">
                  À voir aussi
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {similarArticles.map((similar) => (
                    <ArticleCard key={similar.id} article={similar} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <ArticleSidebar />
        </div>
      </main>
    </div>
  );
}
