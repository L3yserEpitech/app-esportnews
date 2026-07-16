import { Metadata } from 'next';
import { Suspense } from 'react';
import { slugToWiki } from '../../../lib/gameRegistry';
import { decodeRouteParam } from '../../../lib/gameLinks';
import TeamDetailPageClient from '../../../equipe/_components/TeamDetailPageClient';
import type { EnrichedTeamDetail } from '../../../services/teamService';

function apiBase(): string {
  return process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
}

// Resolve the enriched team detail server-side. Called by BOTH generateMetadata
// and the page — Next dedupes identical fetch() within a request, so this hits
// the backend once. Template lookups use ?detail=1 to get the full detail in a
// single call (no by-template → /detail round trip).
async function fetchTeamDetail(wiki: string, id: string): Promise<EnrichedTeamDetail | null> {
  const base = apiBase();
  let url: string | null = null;
  if (wiki && isNaN(Number(id))) {
    url = `${base}/api/teams/by-template?template=${encodeURIComponent(id)}&wiki=${encodeURIComponent(wiki)}&detail=1`;
  } else if (!isNaN(Number(id))) {
    url = `${base}/api/teams/${id}/detail${wiki ? `?wiki=${encodeURIComponent(wiki)}` : ''}`;
  }
  if (!url) return null;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 1800 },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching team detail (SSR):', error);
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ game: string; id: string }> }
): Promise<Metadata> {
  const { game, id: rawId } = await params;
  const id = decodeRouteParam(rawId);
  const wiki = slugToWiki(game) || '';

  const team = await fetchTeamDetail(wiki, id);
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
}

export default async function TeamDetailPage({ params }: { params: Promise<{ game: string; id: string }> }) {
  const { game, id: rawId } = await params;
  const id = decodeRouteParam(rawId);
  const wiki = slugToWiki(game) || '';
  const initialTeam = await fetchTeamDetail(wiki, id);
  return (
    <Suspense>
      <TeamDetailPageClient teamId={id} wiki={wiki} initialTeam={initialTeam} />
    </Suspense>
  );
}
