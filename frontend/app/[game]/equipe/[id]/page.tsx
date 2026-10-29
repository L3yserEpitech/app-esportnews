import { Metadata } from 'next';
import { Suspense } from 'react';
import { gameByWiki, slugToWiki } from '../../../lib/gameRegistry';
import { decodeRouteParam } from '../../../lib/gameLinks';
import { DEFAULT_OG_IMAGE } from '../../../lib/seoHelpers';
import { brandTitle } from '../../../lib/seoTitles';
import { TeamJsonLd } from '../../../components/seo/entityJsonLd';
import TeamDetailPageClient from '../../../equipe/_components/TeamDetailPageClient';
import type { EnrichedTeamDetail } from '../../../services/teamService';

function apiBase(): string {
  return process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
}

async function fetchOne(url: string): Promise<EnrichedTeamDetail | null> {
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

// Resolve the enriched team detail server-side. Called by BOTH generateMetadata
// and the page — Next dedupes identical fetch() within a request, so this hits
// the backend once. Template lookups use ?detail=1 (full detail in a single
// call, no by-template → /detail round trip). Liquipedia templates often carry
// a date suffix ("furia 2025", "heroic sep 2024") that doesn't resolve — so we
// retry on the base template, mirroring the client, to keep the SSR pass useful.
async function fetchTeamDetail(wiki: string, id: string): Promise<EnrichedTeamDetail | null> {
  const base = apiBase();
  const numeric = !isNaN(Number(id));

  if (numeric) {
    return fetchOne(`${base}/api/teams/${id}/detail${wiki ? `?wiki=${encodeURIComponent(wiki)}` : ''}`);
  }
  if (!wiki) return null;

  const byTemplate = (tpl: string) =>
    `${base}/api/teams/by-template?template=${encodeURIComponent(tpl)}&wiki=${encodeURIComponent(wiki)}&detail=1`;

  let team = await fetchOne(byTemplate(id));
  if (team) return team;

  const baseTemplate = id
    .replace(/\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}$/i, '')
    .replace(/\s+\d{4}$/i, '')
    .trim();
  if (baseTemplate && baseTemplate !== id) {
    team = await fetchOne(byTemplate(baseTemplate));
  }
  return team;
}

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
