import { Metadata } from 'next';
import { Suspense } from 'react';
import { gameByWiki, slugToWiki } from '../../../lib/gameRegistry';
import { decodeRouteParam } from '../../../lib/gameLinks';
import { DEFAULT_OG_IMAGE } from '../../../lib/seoHelpers';
import { brandTitle } from '../../../lib/seoTitles';
import { TeamJsonLd } from '../../../components/seo/entityJsonLd';
import TeamDetailPageClient from '../../../equipe/_components/TeamDetailPageClient';
import { fetchTeamDetail } from './fetchTeamDetail';

export async function generateMetadata(
  { params }: { params: Promise<{ game: string; id: string }> }
): Promise<Metadata> {
  const { game, id: rawId } = await params;
  const id = decodeRouteParam(rawId);
  const wiki = slugToWiki(game) || '';

  const team = await fetchTeamDetail(wiki, id);
  if (!team) {
    return { title: 'Équipe non trouvée | Esport News', description: "L'équipe que vous recherchez n'existe pas." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
  const url = `${siteUrl}/${game}/equipe/${encodeURIComponent(id)}`;
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
      url,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title, description, images: [DEFAULT_OG_IMAGE.url] },
    alternates: { canonical: url },
  };
}

export default async function TeamDetailPage({ params }: { params: Promise<{ game: string; id: string }> }) {
  const { game, id: rawId } = await params;
  const id = decodeRouteParam(rawId);
  const wiki = slugToWiki(game) || '';
  const initialTeam = await fetchTeamDetail(wiki, id);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
  return (
    <>
      {initialTeam && (
        <TeamJsonLd team={{ ...initialTeam, wiki }} url={`${siteUrl}/${game}/equipe/${encodeURIComponent(id)}`} />
      )}
      <Suspense>
        <TeamDetailPageClient teamId={id} wiki={wiki} initialTeam={initialTeam} />
      </Suspense>
    </>
  );
}
