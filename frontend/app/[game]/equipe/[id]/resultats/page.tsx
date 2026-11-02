import { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { slugToWiki } from '../../../../lib/gameRegistry';
import { decodeRouteParam } from '../../../../lib/gameLinks';
import { failForCrawlers } from '../../../../lib/crawlerFailure';
import ResultatsPageClient from '../../../../equipe/_components/ResultatsPageClient';
import { fetchTeamDetail, teamHomePath } from '../fetchTeamDetail';

export async function generateMetadata(
  { params, searchParams }: { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string>> }
): Promise<Metadata> {
  const { game, id: rawId } = await params;
  const id = decodeRouteParam(rawId);
  const sp = await searchParams;
  // The name in the URL proves nothing: the record's comes first, and a page only
  // the URL vouches for stays out of the index.
  const lookup = await fetchTeamDetail(slugToWiki(game) || '', id, sp.name);
  const team = lookup.status === 'found' ? lookup.team : null;
  const name = team?.name || sp.name || id;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
  const home = team && teamHomePath(team, game);
  const url = `${siteUrl}${home ?? `/${game}/equipe/${encodeURIComponent(id)}`}/resultats`;
  const robots = lookup.status === 'missing' || (team && !home) ? { index: false, follow: true } : undefined;

  return {
    title: `${name} — Résultats en tournoi | Esport News`,
    description: `Tous les résultats en tournoi de ${name}. Historique complet des placements, gains et performances.`,
    keywords: `${name}, résultats, tournois, esport, placements, gains`,
    openGraph: {
      title: `${name} — Résultats en tournoi`,
      description: `Historique complet des résultats en tournoi de ${name}.`,
      type: 'website',
      url,
    },
    alternates: { canonical: url },
    ...(robots && { robots }),
  };
}

export default async function ResultatsPage(
  { params, searchParams }: { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string>> }
) {
  const { game, id: rawId } = await params;
  const id = decodeRouteParam(rawId);
  const wiki = slugToWiki(game) || '';
  const sp = await searchParams;
  // The canonical URL carries no ?name=, and the template is not the name Liquipedia matches placements on.
  const lookup = await fetchTeamDetail(wiki, id, sp.name);
  if (lookup.status === 'missing' && !sp.name) {
    notFound();
  }
  if (lookup.status === 'unavailable') {
    await failForCrawlers();
  }
  const team = lookup.status === 'found' ? lookup.team : null;
  const home = team && teamHomePath(team, game);
  if (home && home !== `/${game}/equipe/${encodeURIComponent(id)}`) {
    permanentRedirect(`${home}/resultats`);
  }
  return (
    <Suspense>
      <ResultatsPageClient teamId={id} wiki={wiki} team={team} />
    </Suspense>
  );
}
