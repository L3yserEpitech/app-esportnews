import { Metadata } from 'next';
import { generateListingMetadata } from '@/app/lib/seoHelpers';
import ArticlesPageClient from './ArticlesPageClient';
import { fetchArticlesServer } from '@/app/lib/serverArticles';

// Métadonnées statiques pour la page articles (listing)
export const metadata: Metadata = generateListingMetadata(
  'Tous les Articles Esport',
  'Découvrez toutes les actualités, analyses et interviews du monde de l\'esport. News en direct, analyses d\'équipes et tendances.',
  '/articles',
  'articles, actualités, esport, news, analyses'
);

export default async function ArticlesPage() {
  // Première page (sans catégorie) lue côté serveur : les articles sont dans le HTML initial.
  const [featured, grid] = await Promise.all([
    fetchArticlesServer({ limit: 1, excludeNews: true }),
    fetchArticlesServer({ limit: 9, offset: 1, excludeNews: true }),
  ]);
  const initialData =
    featured && grid
      ? { featured: featured.articles[0] ?? null, articles: grid.articles, total: grid.total }
      : undefined;
  return <ArticlesPageClient initialData={initialData} />;
}
