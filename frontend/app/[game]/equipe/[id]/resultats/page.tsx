import { Metadata } from 'next';
import { Suspense } from 'react';
import { slugToWiki } from '../../../../lib/gameRegistry';
import ResultatsPageClient from '../../../../equipe/_components/ResultatsPageClient';

export async function generateMetadata(
  { params, searchParams }: { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string>> }
): Promise<Metadata> {
  const { game, id } = await params;
  const sp = await searchParams;
  const name = sp.name || decodeURIComponent(id);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
  const url = `${siteUrl}/${game}/equipe/${encodeURIComponent(id)}/resultats`;

  return {
    title: `${name} — Résultats en tournoi | EsportNews`,
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

export default async function ResultatsPage({ params }: { params: Promise<{ game: string; id: string }> }) {
  const { game, id } = await params;
  const wiki = slugToWiki(game) || '';
  return (
    <Suspense>
      <ResultatsPageClient teamId={id} wiki={wiki} />
    </Suspense>
  );
}
