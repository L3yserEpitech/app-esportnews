import { Metadata } from 'next';
import TournamentsPageClient from './TournamentsPageClient';
import { DEFAULT_OG_IMAGE } from '@/app/lib/seoHelpers';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

export const metadata: Metadata = {
  title: 'Tournois | Esport News - Toutes les Compétitions Esport',
  description: 'Tous les tournois esport en cours et à venir : CS2, Valorant, LoL, Dota 2, Rocket League… Bracket, résultats, équipes et classements de chaque compétition.',
  keywords: 'tournois esport, compétitions esport, ligues esport',
  openGraph: {
    title: 'Tournois | Esport News',
    description: 'Découvrez tous les tournois esport.',
    url: `${SITE_URL}/tournois`,
    type: 'website',
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tournois Esport | Esport News',
    description: 'Tous les tournois esport en un seul endroit.',
    images: [DEFAULT_OG_IMAGE.url],
  },
  alternates: {
    canonical: `${SITE_URL}/tournois`,
  },
};

export default function TournamentsPage() {
  return <TournamentsPageClient />;
}
