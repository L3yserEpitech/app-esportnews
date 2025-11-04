import { Metadata } from 'next';
import { generateListingMetadata } from '@/app/lib/seoHelpers';
import ArticlesPageClient from './ArticlesPageClient';

// Métadonnées statiques pour la page articles (listing)
export const metadata: Metadata = generateListingMetadata(
  'Tous les Articles Esport',
  'Découvrez toutes les actualités, analyses et interviews du monde de l\'esport. News en direct, analyses d\'équipes et tendances.',
  '/articles',
  'articles, actualités, esport, news, analyses'
);

export default function ArticlesPage() {
  return <ArticlesPageClient />;
}
