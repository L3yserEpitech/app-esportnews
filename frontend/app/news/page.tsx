import { Metadata } from 'next';
import NewsPageClient from './NewsPageClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

export const metadata: Metadata = {
  title: 'Actualités | EsportNews - Dernières Actu Esport',
  description: 'Découvrez les dernières actualités esport. Toutes les infos, analyses et brèves des meilleures équipes et compétitions.',
  keywords: 'actualités esport, news esport, brèves esport',
  openGraph: {
    title: 'Actualités | EsportNews',
    description: 'Découvrez les dernières actualités esport.',
    url: `${SITE_URL}/news`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Actualités Esport | EsportNews',
    description: 'Les dernières actualités de l\'esport.',
  },
  alternates: {
    canonical: `${SITE_URL}/news`,
  },
};

export default function NewsPage() {
  return <NewsPageClient />;
}
