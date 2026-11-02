import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getApiBaseUrl } from '../../../lib/apiConfig';
import { slugToWiki } from '../../../lib/gameRegistry';
import { decodeRouteParam, matchIdFromSegment, matchSegment, matchTitleFromSegment } from '../../../lib/gameLinks';
import { failForCrawlers } from '../../../lib/crawlerFailure';
import { DEFAULT_OG_IMAGE, unavailablePageMetadata } from '../../../lib/seoHelpers';
import { brandTitle, matchDescription, matchTitle } from '../../../lib/seoTitles';
import MatchDetailPageClient from '../../../match/_components/MatchDetailPageClient';
import { MatchJsonLd } from '../../../components/seo/entityJsonLd';

interface MatchPageProps {
  params: Promise<{ game: string; id: string }>;
}

// Not through Next's data cache: past its revalidate time it hands its old copy to
// the first visitor, so a live page opened after a quiet hour showed that hour's score.
async function fetchMatch(wiki: string, id: string): Promise<Response | undefined> {
  try {
    return await fetch(
      `${getApiBaseUrl()}/api/matches/${encodeURIComponent(id)}?wiki=${encodeURIComponent(wiki)}`,
      { cache: 'no-store' }
    );
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { game, id: rawSegment } = await params;
  const segment = decodeRouteParam(rawSegment);
  const id = matchIdFromSegment(segment);
  const wiki = slugToWiki(game);
  if (!wiki) {
    return { title: 'Match | Esport News', description: 'Détails du match en direct' };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
  const unavailable = unavailablePageMetadata(
    brandTitle(matchTitleFromSegment(segment) ?? 'Match'),
    'Détails du match en direct',
    `${siteUrl}/${game}/match/${encodeURIComponent(segment)}`,
  );

  const response = await fetchMatch(wiki, id);
  if (response?.status === 404) {
    return {
      title: 'Match non trouvé',
      description: 'Le match que vous recherchez n\'existe pas.',
    };
  }
  if (!response?.ok) {
    return unavailable;
  }

  try {
    const match = await response.json();
    const seo = {
      home: match.opponents?.[0]?.opponent?.name,
      away: match.opponents?.[1]?.opponent?.name,
      tournament: match.league?.name || match.tournament?.name,
      game: match.videogame?.name,
      beginAt: match.begin_at,
    };
    const title = matchTitle(seo);
    const stream = match.streams_list?.find((s: { main?: boolean }) => s.main) ?? match.streams_list?.[0];
    const description = matchDescription({
      ...seo,
      stage: match.section,
      bestOf: match.number_of_games,
      streamUrl: stream?.raw_url,
    });
    const matchUrl = `${siteUrl}/${game}/match/${matchSegment(match)}`;

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
    return unavailable;
  }
}

export default async function MatchDetailPage({ params }: MatchPageProps) {
  const { game, id: rawSegment } = await params;
  const segment = decodeRouteParam(rawSegment);
  const id = matchIdFromSegment(segment);
  // [game] validity is enforced by app/[game]/layout.tsx.
  const wiki = slugToWiki(game);
  if (!wiki) {
    notFound();
  }

  const response = await fetchMatch(wiki, id);

  // 404 only on an explicit backend 404: transient errors let the client retry.
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

  if (!initialMatch) {
    await failForCrawlers();
  }

  const canonicalSegment = initialMatch ? matchSegment(initialMatch) : segment;
  if (initialMatch?.match2id && canonicalSegment !== segment) {
    permanentRedirect(`/${game}/match/${canonicalSegment}`);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

  return (
    <>
      {initialMatch && <MatchJsonLd match={initialMatch} url={`${siteUrl}/${game}/match/${canonicalSegment}`} />}
      <MatchDetailPageClient matchId={id} wiki={wiki} initialMatch={initialMatch} />
    </>
  );
}
