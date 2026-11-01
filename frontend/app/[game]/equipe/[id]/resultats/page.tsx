import { Metadata } from 'next';
import { Suspense } from 'react';
import { slugToWiki } from '../../../../lib/gameRegistry';
import { decodeRouteParam } from '../../../../lib/gameLinks';
import ResultatsPageClient from '../../../../equipe/_components/ResultatsPageClient';
import { fetchTeamDetail } from '../fetchTeamDetail';

export async function generateMetadata(
  { params, searchParams }: { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string>> }
): Promise<Metadata> {
  const { game, id: rawId } = await params;
  const id = decodeRouteParam(rawId);
  const sp = await searchParams;
  const team = sp.name ? null : await fetchTeamDetail(slugToWiki(game) || '', id);
  const name = sp.name || team?.name || id;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
  const url = `${siteUrl}/${game}/equipe/${encodeURIComponent(id)}/resultats`;

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
  const team = sp.name ? null : await fetchTeamDetail(wiki, id);
  return (
    <Suspense>
      <ResultatsPageClient teamId={id} wiki={wiki} team={team} />
    </Suspense>
  );
}
