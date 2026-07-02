import { Metadata } from 'next';
import { Suspense } from 'react';
import { slugToWiki } from '../../../lib/gameRegistry';
import TeamDetailPageClient from '../../../equipe/_components/TeamDetailPageClient';

export async function generateMetadata(
  { params }: { params: Promise<{ game: string; id: string }> }
): Promise<Metadata> {
  const baseUrl_api =
    process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const { game, id } = await params;
  const wiki = slugToWiki(game) || '';

  try {
    let team: { id: number; name: string; acronym?: string } | null = null;

    if (wiki && isNaN(Number(id))) {
      const response = await fetch(
        `${baseUrl_api}/api/teams/by-template?template=${encodeURIComponent(id)}&wiki=${encodeURIComponent(wiki)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' }, next: { revalidate: 1800 } }
      );
      if (response.ok) team = await response.json();
    } else if (!isNaN(Number(id))) {
      const response = await fetch(
        `${baseUrl_api}/api/teams/${id}/detail${wiki ? `?wiki=${encodeURIComponent(wiki)}` : ''}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' }, next: { revalidate: 1800 } }
      );
      if (response.ok) team = await response.json();
    }

    if (!team) {
      return { title: 'Équipe non trouvée | EsportNews', description: "L'équipe que vous recherchez n'existe pas." };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
    const url = `${siteUrl}/${game}/equipe/${encodeURIComponent(id)}`;

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
      twitter: { card: 'summary_large_image', title: team.name, description: `Suivez l'équipe ${team.name}` },
      alternates: { canonical: url },
    };
  } catch (error) {
    console.error('Error generating metadata for team:', error);
    return { title: 'Équipe | EsportNews', description: 'Consultez les équipes esport sur EsportNews' };
  }
}

export default async function TeamDetailPage({ params }: { params: Promise<{ game: string; id: string }> }) {
  const { game, id } = await params;
  const wiki = slugToWiki(game) || '';
  return (
    <Suspense>
      <TeamDetailPageClient teamId={id} wiki={wiki} />
    </Suspense>
  );
}
