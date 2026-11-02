import { wikiToSlug } from './gameRegistry';

// Next App Router route params arrive percent-encoded. Decode until stable
// (bounded) so already double-encoded URLs in the wild resolve too.
export function decodeRouteParam(value: string): string {
  let out = value;
  for (let i = 0; i < 3; i++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(out);
    } catch {
      return out;
    }
    if (decoded === out) return out;
    out = decoded;
  }
  return out;
}

const MAX_TEAM_SLUG = 28;
const MAX_TOURNAMENT_SLUG = 60;

// NFKD leaves these as single letters, so they would vanish from the slug.
const TRANSLITERATIONS: Record<string, string> = {
  æ: 'ae', ð: 'd', đ: 'd', ı: 'i', ł: 'l', ø: 'o', œ: 'oe', ß: 'ss', þ: 'th',
};

function slugifyTitle(title: string | null | undefined): string {
  return (title ?? '')
    .toLowerCase()
    .replace(/[æðđıłøœßþ]/g, (letter) => TRANSLITERATIONS[letter])
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function capSlug(slug: string, max: number): string {
  if (slug.length <= max) return slug;
  const lastWordEnd = slug.lastIndexOf('-', max);
  return lastWordEnd > 0 ? slug.slice(0, lastWordEnd) : slug.slice(0, max);
}

// Narrow structural inputs — decoupled from the full Panda* types so these
// helpers stay trivially testable. Any object carrying these fields works.
export interface MatchLinkInput {
  wiki?: string | null;
  match2id?: string | null;
  id: number | string;
  opponents?: Array<{ opponent?: { name?: string | null } | null }> | null;
}
export interface TournamentLinkInput {
  wiki?: string | null;
  id: number | string;
  name?: string | null;
}

// Every observed match2id is a 10-character bracket id, then "_", then a match
// id that may hold hyphens (dfuZ0CbS5V_R01-M010). The "_", which a title slug
// never contains, is what makes the id readable back out of the URL segment.
const MATCH2ID = /^[A-Za-z0-9]{10}_[A-Za-z0-9-]+$/;
const TITLED_MATCH_SEGMENT = /^[a-z0-9-]+-([A-Za-z0-9]{10}_[A-Za-z0-9-]+)$/;

function teamSlug(name: string | null | undefined): string {
  if (name?.trim().toUpperCase() === 'TBD') return '';
  return capSlug(slugifyTitle(name), MAX_TEAM_SLUG);
}

// matchSegment is "<home>-vs-<away>-<match2id>", or the bare id when the title
// is unknown or the id could not be read back. The title is decorative: pages
// resolve the id alone and 308 any other title to this one.
export function matchSegment(match: MatchLinkInput): string {
  const id = match.match2id || String(match.id);
  const home = teamSlug(match.opponents?.[0]?.opponent?.name);
  const away = teamSlug(match.opponents?.[1]?.opponent?.name);
  return home && away && MATCH2ID.test(id) ? `${home}-vs-${away}-${id}` : id;
}

export function matchIdFromSegment(segment: string): string {
  return TITLED_MATCH_SEGMENT.exec(segment)?.[1] ?? segment;
}

// matchHref builds the game-first /<slug>/match/<segment>. Falls back to the
// legacy /match/<id> when the game can't be resolved, so links never break.
export function matchHref(match: MatchLinkInput): string {
  const slug = match.wiki ? wikiToSlug(match.wiki) : undefined;
  return slug
    ? `/${slug}/match/${matchSegment(match)}`
    : `/match/${match.match2id || String(match.id)}`;
}

// The readable part of a segment, for when the backend could not say what the
// page holds. Lossy (lowercase, ASCII) but it comes from the URL, nothing invented.
export function titleFromSlug(slug: string): string {
  return slug
    .split(/[-\s_]+/)
    .filter(Boolean)
    .map((word) => (word === 'vs' ? word : word[0].toUpperCase() + word.slice(1)))
    .join(' ');
}

export function matchTitleFromSegment(segment: string): string | null {
  const id = matchIdFromSegment(segment);
  return id === segment ? null : titleFromSlug(segment.slice(0, -(id.length + 1)));
}

const isPageId = (id: number | string) => /^\d+$/.test(String(id));

// tournamentSegment is "<name>-<pageid>". The id may instead be a Liquipedia
// pagename ("Project_Blender/2025/Phase_4") — its slashes must stay inside the
// single [id] segment, hence the encoding, and it gets no title.
export function tournamentSegment(t: TournamentLinkInput): string {
  if (!isPageId(t.id)) return encodeURIComponent(String(t.id));
  const name = capSlug(slugifyTitle(t.name), MAX_TOURNAMENT_SLUG);
  return name ? `${name}-${t.id}` : String(t.id);
}

// Lowercase and hyphens only, so a pagename ("Foo/2026-27/Winter") or an older
// slug (foo_bar_2026) is left whole for the backend to resolve.
export function tournamentIdFromSegment(segment: string): string {
  return /^[a-z0-9-]+-(\d+)$/.exec(segment)?.[1] ?? segment;
}

export function tournamentTitleFromSegment(segment: string): string | null {
  const id = tournamentIdFromSegment(segment);
  return id === segment ? null : titleFromSlug(segment.slice(0, -(id.length + 1)));
}

// tournamentHref builds the game-first /<slug>/tournois/<segment>, same fallback.
export function tournamentHref(t: TournamentLinkInput): string {
  const slug = t.wiki ? wikiToSlug(t.wiki) : undefined;
  return slug
    ? `/${slug}/tournois/${tournamentSegment(t)}`
    : `/tournois/${encodeURIComponent(String(t.id))}`;
}

export interface PlacementLinkInput {
  tournament?: string | null;
  tournament_id?: number;
  tournament_page: string;
  tournament_missing?: boolean;
}

// placementHref is null when Liquipedia has no tournament on that page: our page
// would 404. A pageid is only unique within its wiki, so pass the placements' wiki.
export function placementHref(wiki: string | null | undefined, p: PlacementLinkInput): string | null {
  if (p.tournament_missing) return null;
  return tournamentHref({ wiki, id: p.tournament_id || p.tournament_page, name: p.tournament });
}

export interface TeamLinkInput {
  wiki?: string | null;
  template?: string | null;
  id?: number | string;
  name?: string | null;
  acronym?: string | null;
  image_url?: string | null;
}

// teamHref builds the game-first /<slug>/equipe/<template>, carrying name/acronym/
// logo as prefill query params. When the game can't be resolved it falls back to
// the legacy /equipe/<template> and keeps wiki in the query.
export function teamHref(team: TeamLinkInput): string {
  const idSeg = team.template || (team.id != null ? String(team.id) : '');
  const slug = team.wiki ? wikiToSlug(team.wiki) : undefined;
  const base = slug
    ? `/${slug}/equipe/${encodeURIComponent(idSeg)}`
    : `/equipe/${encodeURIComponent(idSeg)}`;

  const q = new URLSearchParams();
  if (!slug && team.wiki) q.set('wiki', team.wiki); // legacy fallback keeps wiki
  if (team.name) q.set('name', team.name);
  if (team.acronym) q.set('acronym', team.acronym);
  if (team.image_url) q.set('logo', team.image_url);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

// teamResultatsHref builds the game-first /<slug>/equipe/<template>/resultats.
export function teamResultatsHref(team: TeamLinkInput): string {
  const idSeg = team.template || (team.id != null ? String(team.id) : '');
  const slug = team.wiki ? wikiToSlug(team.wiki) : undefined;
  const base = slug
    ? `/${slug}/equipe/${encodeURIComponent(idSeg)}/resultats`
    : `/equipe/${encodeURIComponent(idSeg)}/resultats`;

  const q = new URLSearchParams();
  if (!slug && team.wiki) q.set('wiki', team.wiki);
  if (team.name) q.set('name', team.name);
  if (team.acronym) q.set('acronym', team.acronym);
  if (team.image_url) q.set('logo', team.image_url);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

export interface PlayerLinkInput {
  wiki?: string | null;
  pagename?: string | null;
  id?: number | string;
}

// playerHref builds the game-first /<slug>/joueur/<pagename>, legacy fallback
// /joueur/<pagename>. (The player page is a routing scaffold for now.)
export function playerHref(p: PlayerLinkInput): string {
  const idSeg = p.pagename || (p.id != null ? String(p.id) : '');
  const slug = p.wiki ? wikiToSlug(p.wiki) : undefined;
  return slug
    ? `/${slug}/joueur/${encodeURIComponent(idSeg)}`
    : `/joueur/${encodeURIComponent(idSeg)}`;
}
