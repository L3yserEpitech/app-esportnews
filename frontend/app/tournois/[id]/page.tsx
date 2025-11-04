import { Metadata, ResolvingMetadata } from 'next';
import TournamentDetailPageClient from './TournamentDetailPageClient';

// Générer les métadonnées dynamiques pour chaque tournoi
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const baseUrl_api = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
  const { id } = await params;

  try {
    // Récupérer le tournoi
    const response = await fetch(`${baseUrl_api}/api/tournaments/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return {
        title: 'Tournoi non trouvé | EsportNews',
        description: 'Le tournoi que vous recherchez n\'existe pas.',
      };
    }

    const tournament = await response.json();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
    const url = `${siteUrl}/tournois/${tournament.id}`;

    return {
      title: `${tournament.name} | Tournoi Esport | EsportNews`,
      description: `Suivez le tournoi ${tournament.name}. Résultats, matchs, équipes, calendrier et classements en direct.`,
      keywords: `${tournament.name}, tournoi esport, esports, résultats, classements`,
      openGraph: {
        title: tournament.name,
        description: `Suivez le tournoi ${tournament.name}. Résultats, matchs, équipes, calendrier et classements en direct.`,
        type: 'website',
        url,
      },
      twitter: {
        card: 'summary_large_image',
        title: tournament.name,
        description: `Suivez le tournoi ${tournament.name}`,
      },
      alternates: {
        canonical: url,
      },
    };
  } catch (error) {
    console.error('Error generating metadata for tournament:', error);
    return {
      title: 'Tournoi | EsportNews',
      description: 'Consultez les tournois esport sur EsportNews',
    };
  }
}

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TournamentDetailPageClient tournamentId={id} />;
}
