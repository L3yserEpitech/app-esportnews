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
