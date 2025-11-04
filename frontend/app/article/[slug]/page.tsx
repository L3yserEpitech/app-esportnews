import { Metadata, ResolvingMetadata } from 'next';
import { articleService } from '@/app/services/articleService';
import ArticlePageClient from './ArticlePageClient';

// Générer les métadonnées dynamiques pour chaque article
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const article = await articleService.getArticleBySlug(slug);

  if (!article) {
    return {
      title: 'Article non trouvé | EsportNews',
      description: 'L\'article que vous recherchez n\'existe pas.',
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
  const url = `${siteUrl}/article/${article.slug}`;

  return {
    title: `${article.title} | EsportNews`,
    description: article.description || article.subtitle || 'Lire l\'article complet sur EsportNews',
    keywords: article.tags?.join(', '),
    authors: [{ name: article.author || 'EsportNews' }],
    openGraph: {
      title: article.title,
      description: article.description || article.subtitle,
      type: 'article',
      url,
      images: article.featuredImage ? [{ url: article.featuredImage }] : [],
      publishedTime: article.created_at,
      authors: [article.author || 'EsportNews'],
      tags: article.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description || article.subtitle,
      images: article.featuredImage ? [article.featuredImage] : [],
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ArticlePageClient slug={slug} />;
}
