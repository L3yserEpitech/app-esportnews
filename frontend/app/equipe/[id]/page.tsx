import { Metadata, ResolvingMetadata } from 'next';
import { Suspense } from 'react';
import TeamDetailPageClient from './TeamDetailPageClient';

export async function generateMetadata(
  { params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const baseUrl_api = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const { id } = await params;
  const sp = await searchParams;
  const wiki = sp.wiki || '';

  try {
    let team: { id: number; name: string; acronym?: string } | null = null;

    if (wiki && isNaN(Number(id))) {
      // id is a template name — use by-template endpoint
      const response = await fetch(
        `${baseUrl_api}/api/teams/by-template?template=${encodeURIComponent(id)}&wiki=${encodeURIComponent(wiki)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' }, next: { revalidate: 1800 } }
      );
      if (response.ok) team = await response.json();
    } else if (!isNaN(Number(id))) {
      // Numeric pageid
      const response = await fetch(
        `${baseUrl_api}/api/teams/${id}/detail`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' }, next: { revalidate: 1800 } }
      );
      if (response.ok) team = await response.json();
    }

    if (!team) {
      return { title: 'Équipe non trouvée | EsportNews', description: "L'équipe que vous recherchez n'existe pas." };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
    const url = `${siteUrl}/equipe/${encodeURIComponent(id)}${wiki ? `?wiki=${wiki}` : ''}`;

    return {
      title: `${team.name} | Équipe Esport | EsportNews`,
      description: `Suivez l'équipe ${team.name}. Roster, matchs récents et à venir, résultats et statistiques.`,
      keywords: `${team.name}, ${team.acronym || ''}, équipe esport, esports, roster, résultats`,
      openGraph: {
        title: team.name,
        description: `Suivez l'équipe ${team.name}. Roster, matchs récents et à venir.`,
        type: 'website',
        url,
      },
      twitter: {
        card: 'summary_large_image',
        title: team.name,
        description: `Suivez l'équipe ${team.name}`,
      },
      alternates: { canonical: url },
    };
  } catch (error) {
    console.error('Error generating metadata for team:', error);
    return { title: 'Équipe | EsportNews', description: 'Consultez les équipes esport sur EsportNews' };
  }
}

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <TeamDetailPageClient teamId={id} />
    </Suspense>
  );
}
