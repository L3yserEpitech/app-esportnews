import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getApiBaseUrl } from '../../../lib/apiConfig';
import { matchService } from '../../../services/matchService';
import { slugToWiki } from '../../../lib/gameRegistry';
import MatchDetailPageClient from '../../../match/_components/MatchDetailPageClient';

interface MatchPageProps {
  params: Promise<{ game: string; id: string }>;
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { game, id } = await params;
  const wiki = slugToWiki(game);
  if (!wiki) {
    return { title: 'Match | EsportNews', description: 'Détails du match en direct' };
  }

  try {
    const match = await matchService.getMatchById(id, wiki);
    if (!match) {
      return {
        title: 'Match non trouvé',
        description: 'Le match que vous recherchez n\'existe pas.',
      };
    }

    const homeTeam = match.opponents?.[0]?.opponent;
    const awayTeam = match.opponents?.[1]?.opponent;
    const title = `${homeTeam?.name || 'Match'} vs ${awayTeam?.name || 'Match'} | ${match.videogame?.name || 'Esport'}`;
    const description = `${title} - ${match.league?.name || ''} - ${match.begin_at ? new Date(match.begin_at).toLocaleDateString('fr-FR') : ''}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
    const matchUrl = `${siteUrl}/${game}/match/${id}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: matchUrl,
        type: 'website',
        images: homeTeam?.image_url ? [{ url: homeTeam.image_url, width: 200, height: 200 }] : [],
      },
      twitter: {
        card: 'summary',
        title,
        description,
        images: homeTeam?.image_url ? [homeTeam.image_url] : [],
      },
      alternates: { canonical: matchUrl },
    };
  } catch (error) {
    console.error('Error generating metadata for match:', error);
    return { title: 'Match | EsportNews', description: 'Détails du match en direct' };
  }
}

export default async function MatchDetailPage({ params }: MatchPageProps) {
  const { game, id } = await params;
  // [game] validity is enforced by app/[game]/layout.tsx.
  const wiki = slugToWiki(game);
  if (!wiki) {
    notFound();
  }

  let response: Response | undefined;
  try {
    response = await fetch(
      `${getApiBaseUrl()}/api/matches/${encodeURIComponent(id)}?wiki=${encodeURIComponent(wiki)}`,
      { next: { revalidate: 60 } }
    );
  } catch {
    // Network/transient error — let the client component retry.
  }

  if (response?.status === 404) {
    notFound();
  }

  let initialMatch = null;
  if (response?.ok) {
    try {
      initialMatch = await response.json();
    } catch {
      // Malformed body — client handles the error state.
    }
  }

  return <MatchDetailPageClient matchId={id} wiki={wiki} initialMatch={initialMatch} />;
}
