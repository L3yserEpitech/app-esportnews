import { Metadata } from 'next';
import MatchPageClient from './MatchPageClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

export const metadata: Metadata = {
  title: 'Matchs | EsportNews - Matchs Esport Live, À Venir et Passés',
  description: 'Retrouvez tous les matchs esport : en direct, à venir et passés. Suivez les meilleures compétitions (Valorant, League of Legends, Counter-Strike 2, etc.).',
  keywords: 'matchs esport, matchs en direct, matchs à venir, résultats esport, calendrier esport',
  openGraph: {
    title: 'Matchs | EsportNews - Matchs Esport Live, À Venir et Passés',
    description: 'Retrouvez tous les matchs esport : en direct, à venir et passés.',
    url: `${SITE_URL}/match`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Matchs Esport | EsportNews',
    description: 'Matchs en direct, à venir et passés.',
  },
  alternates: {
    canonical: `${SITE_URL}/match`,
  },
};

export default function MatchPage() {
  return <MatchPageClient />;
}
