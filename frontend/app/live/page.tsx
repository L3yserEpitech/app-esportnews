import { Metadata } from 'next';
import LivePageClient from './LivePageClient';

export const metadata: Metadata = {
  title: 'Direct | EsportNews - Matchs en Direct',
  description: 'Regardez les matchs esport en direct. Tous les matchs live des meilleures compétitions (Valorant, League of Legends, Counter-Strike 2, etc.).',
  keywords: 'matchs esport en direct, live esport, streaming esport',
  openGraph: {
    title: 'Direct | EsportNews - Matchs en Direct',
    description: 'Regardez les matchs esport en direct. Tous les matchs live des meilleures compétitions.',
    url: 'https://esportnews.fr/live',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Matchs en Direct | EsportNews',
    description: 'Regardez les matchs esport en direct.',
  },
  alternates: {
    canonical: 'https://esportnews.fr/live',
  },
};

export default function LivePage() {
  return <LivePageClient />;
}
