import { wikiToSlug } from './gameRegistry';

// Narrow structural inputs — decoupled from the full Panda* types so these
// helpers stay trivially testable. Any object carrying these fields works.
export interface MatchLinkInput {
  wiki?: string | null;
  match2id?: string | null;
  id: number | string;
}
export interface TournamentLinkInput {
  wiki?: string | null;
  id: number | string;
}

// matchHref builds the game-first /<slug>/match/<id>. Falls back to the legacy
// /match/<id> when the game can't be resolved, so links never break.
export function matchHref(match: MatchLinkInput): string {
  const id = match.match2id || String(match.id);
  const slug = match.wiki ? wikiToSlug(match.wiki) : undefined;
  return slug ? `/${slug}/match/${id}` : `/match/${id}`;
}

// tournamentHref builds the game-first /<slug>/tournois/<id>, same fallback.
export function tournamentHref(t: TournamentLinkInput): string {
  const slug = t.wiki ? wikiToSlug(t.wiki) : undefined;
  return slug ? `/${slug}/tournois/${t.id}` : `/tournois/${t.id}`;
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
