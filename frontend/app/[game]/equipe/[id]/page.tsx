import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { gameByWiki, slugToWiki } from '../../../lib/gameRegistry';
import { decodeRouteParam, titleFromSlug } from '../../../lib/gameLinks';
import { failForCrawlers } from '../../../lib/crawlerFailure';
import { DEFAULT_OG_IMAGE, unavailablePageMetadata } from '../../../lib/seoHelpers';
import { brandTitle } from '../../../lib/seoTitles';
import { TeamJsonLd } from '../../../components/seo/entityJsonLd';
import TeamDetailPageClient from '../../../equipe/_components/TeamDetailPageClient';
import { fetchTeamDetail, teamHomePath } from './fetchTeamDetail';

interface TeamPageProps {
  params: Promise<{ game: string; id: string }>;
  searchParams: Promise<Record<string, string>>;
}

export async function generateMetadata({ params, searchParams }: TeamPageProps): Promise<Metadata> {
  const { game, id: rawId } = await params;
  const id = decodeRouteParam(rawId);
  const wiki = slugToWiki(game) || '';
  const { name } = await searchParams;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
  const url = `${siteUrl}/${game}/equipe/${encodeURIComponent(id)}`;

  const lookup = await fetchTeamDetail(wiki, id, name);
  if (lookup.status === 'missing') {
    return name
      ? { title: brandTitle(name), robots: { index: false, follow: true } }
      : { title: 'Équipe non trouvée | Esport News', description: "L'équipe que vous recherchez n'existe pas." };
  }
  if (lookup.status === 'unavailable') {
    const label = isNaN(Number(id)) ? `${titleFromSlug(id)} – Équipe` : 'Équipe';
    const gameLabel = gameByWiki(wiki)?.name || 'esport';
    return unavailablePageMetadata(
      brandTitle(`${label} ${gameLabel}`),
      'Roster, matchs récents et à venir, résultats et palmarès de cette équipe sur Esport News.',
      url,
    );
  }

  const { team } = lookup;
  // Without a URL of its own, the page only stands on what the link says.
  const home = teamHomePath(team, game);
  const canonical = home ? `${siteUrl}${home}` : undefined;
  const gameName = gameByWiki(wiki)?.name;
  const title = `${team.name} – Équipe ${gameName || 'esport'}`;
  const context = [gameName, team.region].filter(Boolean).join(', ');
  const description = `Suivez l'équipe ${team.name}${context ? ` (${context})` : ''} : roster, matchs récents et à venir, résultats, palmarès et statistiques.`;

  return {
    title: brandTitle(title),
    description,
    keywords: `${team.name}, ${team.acronym || ''}, équipe esport, esports, roster, résultats`,
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical ?? url,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title, description, images: [DEFAULT_OG_IMAGE.url] },
    ...(canonical ? { alternates: { canonical } } : { robots: { index: false, follow: true } }),
  };
}

export default async function TeamDetailPage({ params, searchParams }: TeamPageProps) {
  const { game, id: rawId } = await params;
  const id = decodeRouteParam(rawId);
  const wiki = slugToWiki(game) || '';
  const { name } = await searchParams;
  const lookup = await fetchTeamDetail(wiki, id, name);

  // An opponent with no Liquipedia team page still has a link carrying its name:
  // the client shows what it knows, and the metadata keeps that page out of the index.
  if (lookup.status === 'missing' && !name) {
    notFound();
  }
  if (lookup.status === 'unavailable') {
    await failForCrawlers();
  }

  const initialTeam = lookup.status === 'found' ? lookup.team : null;
  const requestedPath = `/${game}/equipe/${encodeURIComponent(id)}`;
  const home = initialTeam && teamHomePath(initialTeam, game);
  if (home && home !== requestedPath) {
    permanentRedirect(home);
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
  return (
    <>
      {initialTeam && home && (
        <TeamJsonLd team={{ ...initialTeam, wiki }} url={`${siteUrl}${home}`} />
      )}
      <Suspense>
        <TeamDetailPageClient teamId={id} wiki={wiki} initialTeam={initialTeam} />
      </Suspense>
    </>
  );
}
