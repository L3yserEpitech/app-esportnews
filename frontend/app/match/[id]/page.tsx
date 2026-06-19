import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getApiBaseUrl } from '../../lib/apiConfig';
import { matchService } from '../../services/matchService';
import MatchDetailPageClient from '../_components/MatchDetailPageClient';

interface MatchPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ wiki?: string }>;
}

export async function generateMetadata({ params, searchParams }: MatchPageProps): Promise<Metadata> {
  const { id } = await params;
  const { wiki } = await searchParams;

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
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
    const matchUrl = `${siteUrl}/match/${id}`;

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
      alternates: {
        canonical: matchUrl,
      },
    };
  } catch (error) {
    console.error('Error generating metadata for match:', error);
    return {
      title: 'Match | EsportNews',
      description: 'Détails du match en direct',
    };
  }
}

export default async function MatchDetailPage({ params, searchParams }: MatchPageProps) {
  const { id } = await params;
  const { wiki } = await searchParams;

  // Fetch server-side so a genuinely missing match (e.g. a stale PandaScore-era
  // URL still indexed by search engines) returns a real 404 instead of a
  // soft-404 (HTTP 200 with "not found" content). Only 404 on an explicit 404
  // from the backend — transient errors fall through so the client can retry
  // rather than de-indexing a valid match.
  let url = `${getApiBaseUrl()}/api/matches/${encodeURIComponent(id)}`;
  if (wiki) {
    url += `?wiki=${encodeURIComponent(wiki)}`;
  }

  let response: Response | undefined;
  try {
    response = await fetch(url, { next: { revalidate: 60 } });
  } catch {
    // Network/transient error — leave it to the client component.
  }

  if (response?.status === 404) {
    notFound();
  }

  let initialMatch = null;
  if (response?.ok) {
    try {
      initialMatch = await response.json();
    } catch {
      // Malformed body — client component will handle the error state.
    }
  }

  return <MatchDetailPageClient matchId={id} wiki={wiki} initialMatch={initialMatch} />;
}
