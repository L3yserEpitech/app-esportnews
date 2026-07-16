// Maps the backend's internal `current_videogame.slug` (cs2, codmw, r6siege…) to
// the Liquipedia wiki. Team search results (`NormalizedTeam`) carry this internal
// slug but NOT the raw wiki, so navigating to team detail needs this to supply a
// hint the backend's team-detail lookup can actually use (a wrong/absent hint
// forces a 10-wiki fan-out). Values mirror `videogameSlugMap` in
// backend-go/internal/models/liquipedia_tournament.go. Unknown → passthrough
// (covers cases where the value is already a wiki name, e.g. easportsfc).
const VIDEOGAME_SLUG_TO_WIKI: Record<string, string> = {
  valorant: 'valorant',
  cs2: 'counterstrike',
  lol: 'leagueoflegends',
  dota2: 'dota2',
  rl: 'rocketleague',
  codmw: 'callofduty',
  r6siege: 'rainbowsix',
  ow: 'overwatch',
  fifa: 'easportsfc',
  easportsfc: 'easportsfc',
  smash: 'smash',
};

export function videogameSlugToWiki(slug?: string | null): string | undefined {
  if (!slug) return undefined;
  return VIDEOGAME_SLUG_TO_WIKI[slug] ?? slug;
}
