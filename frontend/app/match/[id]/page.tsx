import { Metadata } from 'next';
import { matchService } from '../../services/matchService';
import MatchDetailPageClient from './MatchDetailPageClient';

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

  return <MatchDetailPageClient matchId={id} wiki={wiki} />;
}
