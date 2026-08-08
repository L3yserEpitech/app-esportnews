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
  mlbb: 'mobilelegends',
};

export function videogameSlugToWiki(slug?: string | null): string | undefined {
  if (!slug) return undefined;
  return VIDEOGAME_SLUG_TO_WIKI[slug] ?? slug;
}

// Covers verticales du sélecteur de jeux, bundlées (miroir de frontend/public/games/covers).
// Clés = `games.acronym` de l'API. Metro exige des require() littéraux, d'où la table en dur.
const GAME_COVERS: Record<string, number> = {
  valorant: require('../assets/games/covers/valorant.jpg'),
  lol: require('../assets/games/covers/lol.jpg'),
  csgo: require('../assets/games/covers/cs.jpg'),
  dota2: require('../assets/games/covers/dota2.jpg'),
  rl: require('../assets/games/covers/rl.jpg'),
  codmw: require('../assets/games/covers/cod.jpg'),
  r6siege: require('../assets/games/covers/r6.jpg'),
  ow: require('../assets/games/covers/ow.jpg'),
  fifa: require('../assets/games/covers/eafc.jpg'),
  mlbb: require('../assets/games/covers/mlbb.jpg'),
};

export function gameCoverByAcronym(acronym?: string | null): number | undefined {
  return acronym ? GAME_COVERS[acronym] : undefined;
}
