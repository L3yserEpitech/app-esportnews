/**
 * Service pour les opérations liées aux tournois (PandaScore)
 */

const { PANDASCORE_BASE_URL, PANDASCORE_HEADERS, TIERS, ALL_GAMES } = require('../constants/games');
const { sortTournaments } = require('../utils/sortTournaments');

const PANDASCORE_TOKEN = process.env.API_PANDASCORE;

/**
 * Récupère les tournois d'un jeu pour un tier donné
 */
const fetchTournamentsForGameAndTier = async (game, tier, endpoint) => {
  const url = `${PANDASCORE_BASE_URL}/${game}/${endpoint}?filter[tier]=${tier}&page[size]=100&token=${PANDASCORE_TOKEN}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: PANDASCORE_HEADERS
    });

    if (!response.ok) {
      console.log(`⚠️ ${endpoint} ${game} tier ${tier}: HTTP ${response.status}`);
      return [];
    }

    const tournaments = await response.json();
    console.log(`✅ ${endpoint} ${game} tier ${tier}: ${tournaments.length} tournaments`);

    // Filtrer les tournois actifs si nécessaire
    const now = new Date();
    let filtered = tournaments;

    if (endpoint === 'tournaments/running') {
      filtered = tournaments.filter(tournament => {
        if (!tournament.end_at) return true;
        const endDate = new Date(tournament.end_at);
        return endDate > now;
      });
    }

    return filtered.map(tournament => ({
      ...tournament,
      tier: tier,
      gameSlug: game
    }));
  } catch (error) {
    console.error(`❌ Error fetching ${endpoint} ${game} tier ${tier}:`, error.message);
    return [];
  }
};

/**
 * Récupère les tournois pour un jeu spécifique avec un statut donné
 */
const fetchTournamentsForGame = async (game, status = 'running') => {
  const endpointMap = {
    'upcoming': 'tournaments/upcoming',
    'finished': 'tournaments/past',
    'running': 'tournaments/running'
  };

  const endpoint = endpointMap[status] || 'tournaments/running';

  console.log(`🎯 Fetching ${status} tournaments for game: ${game}`);

  const tournamentPromises = TIERS.map(tier =>
    fetchTournamentsForGameAndTier(game, tier, endpoint)
  );

  const results = await Promise.allSettled(tournamentPromises);
  const allTournaments = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allTournaments.push(...result.value);
    } else {
      console.error(`Failed to fetch tier ${TIERS[index]}:`, result.reason);
    }
  });

  return sortTournaments(allTournaments, status);
};

/**
 * Récupère les tournois pour tous les jeux avec un statut donné
 */
const fetchTournamentsForAllGames = async (status = 'running') => {
  const endpointMap = {
    'upcoming': 'tournaments/upcoming',
    'finished': 'tournaments/past',
    'running': 'tournaments/running'
  };

  const endpoint = endpointMap[status] || 'tournaments/running';

  console.log(`🌐 Fetching ${status} tournaments for ALL games`);

  const allTournaments = [];

  for (const tier of TIERS) {
    console.log(`🏆 Starting ${status} tier ${tier.toUpperCase()} for all games...`);

    const gamePromises = ALL_GAMES.map(game =>
      fetchTournamentsForGameAndTier(game, tier, endpoint)
    );

    const results = await Promise.allSettled(gamePromises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allTournaments.push(...result.value);
      } else {
        console.error(`Failed ${ALL_GAMES[index]} tier ${tier}:`, result.reason);
      }
    });
  }

  return sortTournaments(allTournaments, status);
};

/**
 * Récupère les tournois filtrés par jeu, statut et tier
 */
const fetchFilteredTournaments = async (game, status = 'running', tierFilter) => {
  const endpointMap = {
    'upcoming': 'tournaments/upcoming',
    'finished': 'tournaments/past',
    'running': 'tournaments/running'
  };

  const endpoint = endpointMap[status] || 'tournaments/running';

  console.log(`🔍 Fetching filtered tournaments: ${JSON.stringify({
    game: game || 'ALL',
    status,
    tierFilter
  })}`);

  const tiersToFetch = tierFilter
    ? (Array.isArray(tierFilter) ? tierFilter : [tierFilter])
    : TIERS;

  const gamesToFetch = game ? [game] : ALL_GAMES;

  const allPromises = [];
  for (const gameSlug of gamesToFetch) {
    for (const tier of tiersToFetch) {
      allPromises.push(fetchTournamentsForGameAndTier(gameSlug, tier, endpoint));
    }
  }

  const results = await Promise.allSettled(allPromises);
  const allTournaments = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allTournaments.push(...result.value);
    }
  });

  return sortTournaments(allTournaments, status);
};

module.exports = {
  fetchTournamentsForGame,
  fetchTournamentsForAllGames,
  fetchFilteredTournaments,
  fetchTournamentsForGameAndTier
};
