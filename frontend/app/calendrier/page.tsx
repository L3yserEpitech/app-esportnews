import { Metadata } from 'next';
import CalendrierPageClient from './CalendrierPageClient';

export const metadata: Metadata = {
  title: 'Calendrier | EsportNews - Tournois et Matchs Esport',
  description: 'Consultez le calendrier complet des tournois et matchs esport. Dates, horaires et compétitions à venir.',
  keywords: 'calendrier esport, tournois esport, matchs à venir',
  openGraph: {
    title: 'Calendrier | EsportNews',
    description: 'Consultez le calendrier complet des tournois et matchs esport.',
    url: 'https://esportnews.fr/calendrier',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calendrier Esport | EsportNews',
    description: 'Tournois et matchs à venir.',
  },
  alternates: {
    canonical: 'https://esportnews.fr/calendrier',
  },
};

export default function CalendrierPage() {
  return <CalendrierPageClient />;
}
