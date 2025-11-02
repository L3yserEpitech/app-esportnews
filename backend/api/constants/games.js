/**
 * Constantes pour les jeux et configurations API
 */

const ALL_GAMES = [
  'valorant',
  'fifa',
  'lol-wild-rift',
  'dota2',
  'overwatch',
  'cod-mw',
  'lol',
  'rainbow-six-siege',
  'rocket-league',
  'csgo'
];

const TIERS = ['s', 'a', 'b', 'c', 'd'];

const TIER_PRIORITY = {
  's': 5,
  'a': 4,
  'b': 3,
  'c': 2,
  'd': 1,
  'unranked': 0
};

const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

const PANDASCORE_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'EsportNews/1.0'
};

const ALLOWED_GAME_SLUGS = [
  'cs-go',
  'csgo',
  'cs2',
  'valorant',
  'league-of-legends',
  'lol',
  'dota2',
  'dota-2',
  'rl',
  'rocket-league',
  'cod-mw',
  'codmw',
  'r6-siege',
  'r6siege',
  'rainbow-six-siege',
  'ow',
  'overwatch',
  'fifa',
  'lol-wild-rift'
];

module.exports = {
  ALL_GAMES,
  TIERS,
  TIER_PRIORITY,
  PANDASCORE_BASE_URL,
  PANDASCORE_HEADERS,
  ALLOWED_GAME_SLUGS
};
