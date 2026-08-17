import { Metadata } from 'next';
import TournamentsPageClient from './TournamentsPageClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

export const metadata: Metadata = {
  title: 'Tournois | EsportNews - Toutes les Compétitions Esport',
  description: 'Découvrez tous les tournois esport. Consultez les classements, résultats et détails des plus grandes compétitions.',
  keywords: 'tournois esport, compétitions esport, ligues esport',
  openGraph: {
    title: 'Tournois | EsportNews',
    description: 'Découvrez tous les tournois esport.',
    url: `${SITE_URL}/tournois`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tournois Esport | EsportNews',
    description: 'Tous les tournois esport en un seul endroit.',
  },
  alternates: {
    canonical: `${SITE_URL}/tournois`,
  },
};

export default function TournamentsPage() {
  return <TournamentsPageClient />;
}
