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
export async function fetchTeamDetail(wiki: string, id: string): Promise<EnrichedTeamDetail | null> {
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
