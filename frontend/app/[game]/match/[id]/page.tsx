import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getApiBaseUrl } from '../../../lib/apiConfig';
import { matchService } from '../../../services/matchService';
import { slugToWiki } from '../../../lib/gameRegistry';
import { DEFAULT_OG_IMAGE } from '../../../lib/seoHelpers';
import { brandTitle, matchDescription, matchTitle } from '../../../lib/seoTitles';
import MatchDetailPageClient from '../../../match/_components/MatchDetailPageClient';
import { MatchJsonLd } from '../../../components/seo/entityJsonLd';

interface MatchPageProps {
  params: Promise<{ game: string; id: string }>;
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { game, id } = await params;
  const wiki = slugToWiki(game);
  if (!wiki) {
    return { title: 'Match | Esport News', description: 'Détails du match en direct' };
  }

  try {
    const match = await matchService.getMatchById(id, wiki);
    if (!match) {
      return {
        title: 'Match non trouvé',
        description: 'Le match que vous recherchez n\'existe pas.',
      };
    }

    const seo = {
      home: match.opponents?.[0]?.opponent?.name,
      away: match.opponents?.[1]?.opponent?.name,
      tournament: match.league?.name || match.tournament?.name,
      game: match.videogame?.name,
      beginAt: match.begin_at,
    };
    const title = matchTitle(seo);
    const stream = match.streams_list?.find((s) => s.main) ?? match.streams_list?.[0];
    const description = matchDescription({
      ...seo,
      stage: match.section,
      bestOf: match.number_of_games,
      streamUrl: stream?.raw_url,
    });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
    const matchUrl = `${siteUrl}/${game}/match/${id}`;

    // The branded 1200×630 card, not a team logo: Liquipedia logo URLs are
    // hotlinks that social crawlers cannot fetch, and a 200 px logo renders
    // as a thumbnail anyway.
    return {
      title: brandTitle(title),
      description,
      openGraph: {
        title,
        description,
        url: matchUrl,
        type: 'website',
        images: [DEFAULT_OG_IMAGE],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [DEFAULT_OG_IMAGE.url],
      },
      alternates: { canonical: matchUrl },
    };
  } catch (error) {
    console.error('Error generating metadata for match:', error);
    return { title: 'Match | Esport News', description: 'Détails du match en direct' };
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

  return (
    <>
      {initialMatch && <MatchJsonLd match={initialMatch} url={`${siteUrl}/${game}/match/${id}`} />}
      <MatchDetailPageClient matchId={id} wiki={wiki} initialMatch={initialMatch} />
    </>
  );
}
