// Single source of truth for the URL game slug ↔ Liquipedia wiki ↔ internal
// acronym mapping. The URL slug is the SEO-facing identifier in /match/[game]/...
// and is intentionally distinct from the internal videogame.slug (cs2, codmw…).
export interface GameEntry {
  slug: string; // URL slug (SEO) — immutable once indexed
  wiki: string; // Liquipedia wiki name
  acronym: string; // internal acronym (matches backend GameWikiMapping / games.acronym)
  name: string; // display name
}

export const GAMES: readonly GameEntry[] = [
  { slug: 'valorant', wiki: 'valorant', acronym: 'valorant', name: 'Valorant' },
  { slug: 'lol', wiki: 'leagueoflegends', acronym: 'lol', name: 'League of Legends' },
  { slug: 'cs', wiki: 'counterstrike', acronym: 'csgo', name: 'Counter-Strike 2' },
  { slug: 'dota2', wiki: 'dota2', acronym: 'dota2', name: 'Dota 2' },
  { slug: 'rl', wiki: 'rocketleague', acronym: 'rl', name: 'Rocket League' },
  { slug: 'cod', wiki: 'callofduty', acronym: 'codmw', name: 'Call of Duty' },
  { slug: 'r6', wiki: 'rainbowsix', acronym: 'r6siege', name: 'Rainbow Six Siege' },
  { slug: 'ow', wiki: 'overwatch', acronym: 'ow', name: 'Overwatch' },
  { slug: 'eafc', wiki: 'easportsfc', acronym: 'fifa', name: 'EA Sports FC' },
  { slug: 'smash', wiki: 'smash', acronym: 'smash', name: 'Super Smash Bros. Ultimate' },
] as const;

const BY_SLUG = new Map<string, GameEntry>(GAMES.map((g) => [g.slug, g]));
const BY_WIKI = new Map<string, GameEntry>(GAMES.map((g) => [g.wiki, g]));
const BY_ACRONYM = new Map<string, GameEntry>(GAMES.map((g) => [g.acronym, g]));

export function gameBySlug(slug: string): GameEntry | undefined {
  return BY_SLUG.get(slug);
}
export function gameByWiki(wiki: string): GameEntry | undefined {
  return BY_WIKI.get(wiki);
}
export function isValidSlug(slug: string): boolean {
  return BY_SLUG.has(slug);
}
export function slugToWiki(slug: string): string | undefined {
  return BY_SLUG.get(slug)?.wiki;
}
export function wikiToSlug(wiki: string): string | undefined {
  return BY_WIKI.get(wiki)?.slug;
}

// Icône du jeu, self-hostée sous public/games/<slug>.svg. Pas de hotlink : les
// images Liquipedia sont rate-limitées et aucun CDN d'icônes ne couvre les 10 jeux.
export function gameIconByWiki(wiki?: string | null): string | undefined {
  if (!wiki) return undefined;
  const slug = BY_WIKI.get(wiki)?.slug;
  return slug ? `/games/${slug}.svg` : undefined;
}

// Cover verticale 400x600 du sélecteur de jeux, self-hostée. Une seule variante :
// l'état non sélectionné est désaturé en CSS, pas par un second fichier.
export function gameCoverByAcronym(acronym?: string | null): string | undefined {
  if (!acronym) return undefined;
  const slug = BY_ACRONYM.get(acronym)?.slug;
  return slug ? `/games/covers/${slug}.jpg` : undefined;
}
