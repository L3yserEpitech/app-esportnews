import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getApiBaseUrl } from '../../../lib/apiConfig';
import { slugToWiki } from '../../../lib/gameRegistry';
import TournamentDetailPageClient from '../../../tournois/_components/TournamentDetailPageClient';

interface TournamentPageProps {
  params: Promise<{ game: string; id: string }>;
}

async function fetchTournament(game: string, id: string): Promise<Response | undefined> {
  const wiki = slugToWiki(game);
  if (!wiki) return undefined;
  try {
    return await fetch(
      `${getApiBaseUrl()}/api/tournaments/${encodeURIComponent(id)}?wiki=${encodeURIComponent(wiki)}`,
      { next: { revalidate: 600 } }
    );
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: TournamentPageProps): Promise<Metadata> {
  const { game, id } = await params;

  const fallback = { title: 'Tournoi | EsportNews', description: 'Consultez les tournois esport sur EsportNews' };
  const response = await fetchTournament(game, id);
  if (!response?.ok) {
    return response?.status === 404
      ? { title: 'Tournoi non trouvé | EsportNews', description: 'Le tournoi que vous recherchez n\'existe pas.' }
      : fallback;
  }

  try {
    const tournament = await response.json();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
    const url = `${siteUrl}/${game}/tournois/${tournament.id}`;
    const description = `Suivez le tournoi ${tournament.name}. Résultats, matchs, équipes, calendrier et classements en direct.`;

    return {
      title: `${tournament.name} | Tournoi Esport | EsportNews`,
      description,
      keywords: `${tournament.name}, tournoi esport, esports, résultats, classements`,
      openGraph: {
        title: tournament.name,
        description,
        type: 'website',
        url,
      },
      twitter: {
        card: 'summary_large_image',
        title: tournament.name,
        description: `Suivez le tournoi ${tournament.name}`,
      },
      alternates: { canonical: url },
    };
  } catch {
    return fallback;
  }
}

export default async function TournamentDetailPage({ params }: TournamentPageProps) {
  const { game, id } = await params;
  // [game] validity is enforced by app/[game]/layout.tsx.
  const wiki = slugToWiki(game);
  if (!wiki) {
    notFound();
  }

  const response = await fetchTournament(game, id);

  // 404 only on an explicit backend 404 — transient errors (503) let the
  // client retry so a valid tournament isn't de-indexed.
  if (response?.status === 404) {
    notFound();
  }

  let initialTournament = null;
  if (response?.ok) {
    try {
      initialTournament = await response.json();
    } catch {
      // Malformed body — client handles the error state.
    }
  }

  return <TournamentDetailPageClient tournamentId={id} wiki={wiki} initialTournament={initialTournament} />;
}
