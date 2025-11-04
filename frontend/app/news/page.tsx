import { Metadata } from 'next';
import NewsPageClient from './NewsPageClient';

export const metadata: Metadata = {
  title: 'Actualités | EsportNews - Dernières Actu Esport',
  description: 'Découvrez les dernières actualités esport. Toutes les infos, analyses et brèves des meilleures équipes et compétitions.',
  keywords: 'actualités esport, news esport, brèves esport',
  openGraph: {
    title: 'Actualités | EsportNews',
    description: 'Découvrez les dernières actualités esport.',
    url: 'https://esportnews.fr/news',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Actualités Esport | EsportNews',
    description: 'Les dernières actualités de l\'esport.',
  },
  alternates: {
    canonical: 'https://esportnews.fr/news',
  },
};

export default function NewsPage() {
  return <NewsPageClient />;
}
