import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import TournamentDetailPageClient from './TournamentDetailPageClient';

// Générer les métadonnées dynamiques pour chaque tournoi
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const baseUrl_api = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
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

  // Return a real 404 for a genuinely missing tournament (e.g. a stale
  // PandaScore-era URL still indexed) instead of a soft-404. Only 404 on an
  // explicit backend 404 — transient errors fall through to the client.
  const baseUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  let response: Response | undefined;
  try {
    response = await fetch(`${baseUrl}/api/tournaments/${encodeURIComponent(id)}`, { next: { revalidate: 3600 } });
  } catch {
    // Network/transient error — leave it to the client component.
  }

  if (response?.status === 404) {
    notFound();
  }

  return <TournamentDetailPageClient tournamentId={id} />;
}
