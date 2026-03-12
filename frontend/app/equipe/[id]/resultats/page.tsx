import { Metadata, ResolvingMetadata } from 'next';
import { Suspense } from 'react';
import ResultatsPageClient from './ResultatsPageClient';

export async function generateMetadata(
  { params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const name = sp.name || decodeURIComponent(id);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
  const url = `${siteUrl}/equipe/${encodeURIComponent(id)}/resultats`;

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

export default async function ResultatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ResultatsPageClient teamId={id} />
    </Suspense>
  );
}
