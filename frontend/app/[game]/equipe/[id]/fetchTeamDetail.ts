import type { EnrichedTeamDetail } from '../../../services/teamService';

function apiBase(): string {
  return process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
}

// missing: the backend confirmed the team does not exist, the page may answer 404.
// unavailable: it could not be asked (503, network), which says nothing about the team.
export type TeamLookup =
  | { status: 'found'; team: EnrichedTeamDetail }
  | { status: 'missing' }
  | { status: 'unavailable' };

async function fetchOne(url: string): Promise<TeamLookup> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 1800 },
    });
    // 400: not an id the backend can read (Infinity, 20 digits). It never will be.
    if (response.status === 404 || response.status === 400) return { status: 'missing' };
    if (!response.ok) return { status: 'unavailable' };
    return { status: 'found', team: await response.json() };
  } catch (error) {
    console.error('Error fetching team detail (SSR):', error);
    return { status: 'unavailable' };
  }
}

// Resolve the enriched team detail server-side. Called by BOTH generateMetadata
// and the page — Next dedupes identical fetch() within a request, so this hits
// the backend once. Template lookups use ?detail=1 (full detail in a single
// call, no by-template → /detail round trip). Liquipedia templates often carry
// a date suffix ("furia 2025", "heroic sep 2024") that doesn't resolve — so we
// retry on the base template, mirroring the client, to keep the SSR pass useful.
// name comes from links that carry it: the backend also matches a renamed team on it.
export async function fetchTeamDetail(wiki: string, id: string, name?: string): Promise<TeamLookup> {
  const base = apiBase();
  const numeric = !isNaN(Number(id));

  if (numeric) {
    const lookup = await fetchOne(`${base}/api/teams/${id}/detail${wiki ? `?wiki=${encodeURIComponent(wiki)}` : ''}`);
    // A pageid is only unique within its wiki, and the backend scans the others when
    // this one has none: a team from another game is another team, not this page.
    if (lookup.status === 'found' && wiki && lookup.team.wiki && lookup.team.wiki !== wiki) {
      return { status: 'missing' };
    }
    return lookup;
  }
  if (!wiki) return { status: 'missing' };

  const byTemplate = (tpl: string) =>
    `${base}/api/teams/by-template?template=${encodeURIComponent(tpl)}&wiki=${encodeURIComponent(wiki)}&detail=1${name ? `&name=${encodeURIComponent(name)}` : ''}`;

  const lookup = await fetchOne(byTemplate(id));
  if (lookup.status !== 'missing') return lookup;

  const baseTemplate = id
    .replace(/\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}$/i, '')
    .replace(/\s+\d{4}$/i, '')
    .trim();
  return baseTemplate && baseTemplate !== id ? fetchOne(byTemplate(baseTemplate)) : lookup;
}

// A team found under another id (dated template, renamed, forged URL, pageid) has one
// URL: its template, in this game. Null when that URL could not be read back: a
// template a condition cannot hold always answers 404, and a numeric one (1337,
// Infinity) would be read as a pageid.
export function teamHomePath(team: EnrichedTeamDetail, game: string): string | null {
  const { template } = team;
  if (!template || template.length > 255 || !isNaN(Number(template))) return null;
  if (/\[\[|\]\]|\|\||^\s*[!<>]/.test(template)) return null;
  return `/${game}/equipe/${encodeURIComponent(template)}`;
}
