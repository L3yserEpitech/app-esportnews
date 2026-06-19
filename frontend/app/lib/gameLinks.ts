import { wikiToSlug } from './gameRegistry';

// Narrow structural inputs — decoupled from the full Panda* types so these
// helpers stay trivially testable. Any object carrying these fields works.
export interface MatchLinkInput {
  wiki?: string;
  match2id?: string;
  id: number | string;
}
export interface TournamentLinkInput {
  wiki?: string;
  id: number | string;
}

// matchHref builds /match/<slug>/<id>. Falls back to the legacy /match/<id>
// when the game can't be resolved, so links never break during migration.
export function matchHref(match: MatchLinkInput): string {
  const id = match.match2id || String(match.id);
  const slug = match.wiki ? wikiToSlug(match.wiki) : undefined;
  return slug ? `/match/${slug}/${id}` : `/match/${id}`;
}

// tournamentHref builds /tournois/<slug>/<id>, with the same legacy fallback.
export function tournamentHref(t: TournamentLinkInput): string {
  const slug = t.wiki ? wikiToSlug(t.wiki) : undefined;
  return slug ? `/tournois/${slug}/${t.id}` : `/tournois/${t.id}`;
}
