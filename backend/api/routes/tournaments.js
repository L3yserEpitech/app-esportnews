/**
 * Routes pour les tournois (PandaScore)
 */

const {
  fetchTournamentsForGame,
  fetchTournamentsForAllGames,
  fetchFilteredTournaments
} = require('../services/tournamentService');
const { handleError } = require('../utils/errorHandler');

async function tournamentRoutes(fastify) {
  // GET /api/tournaments/filtered - Tournois filtrés
  fastify.get('/api/tournaments/filtered', async (request, reply) => {
    try {
      const { game, status = 'running', 'filter[tier]': tierFilter } = request.query;

      const tournaments = await fetchFilteredTournaments(game, status, tierFilter);

      console.log(`🎊 FILTERED RESULT: ${tournaments.length} tournaments`, {
        game: game || 'ALL',
        status,
        tierFilter: tierFilter || 'ALL'
      });

      return tournaments;
    } catch (error) {
      console.error('Error fetching filtered tournaments:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/tournaments - Tournois pour un jeu spécifique
  fastify.get('/api/tournaments', async (request, reply) => {
    try {
      const { game } = request.query;

      if (!game) {
        return handleError(reply, 400, 'Game acronym is required');
      }

      const tournaments = await fetchTournamentsForGame(game, 'running');

      console.log(`🎯 Final result for ${game}:`, {
        totalTournaments: tournaments.length
      });

      return tournaments;
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/tournaments/all - Tous les tournois
  fastify.get('/api/tournaments/all', async (request, reply) => {
    try {
      const tournaments = await fetchTournamentsForAllGames('running');

      console.log(`🎊 FINAL RESULT: ${tournaments.length} total active tournaments across all games`);

      return tournaments;
    } catch (error) {
      console.error('Error fetching all tournaments:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/tournaments/upcoming - Tournois à venir pour un jeu
  fastify.get('/api/tournaments/upcoming', async (request, reply) => {
    try {
      const { game } = request.query;

      if (!game) {
        return handleError(reply, 400, 'Game acronym is required');
      }

      const tournaments = await fetchTournamentsForGame(game, 'upcoming');

      console.log(`🔮 Final upcoming result for ${game}:`, tournaments.length, 'tournaments');

      return tournaments;
    } catch (error) {
      console.error('Error fetching upcoming tournaments:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/tournaments/upcoming/all - Tous les tournois à venir
  fastify.get('/api/tournaments/upcoming/all', async (request, reply) => {
    try {
      const tournaments = await fetchTournamentsForAllGames('upcoming');

      console.log(`🔮 FINAL UPCOMING RESULT: ${tournaments.length} total upcoming tournaments`);

      return tournaments;
    } catch (error) {
      console.error('Error fetching all upcoming tournaments:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/tournaments/finished - Tournois terminés pour un jeu
  fastify.get('/api/tournaments/finished', async (request, reply) => {
    try {
      const { game } = request.query;

      if (!game) {
        return handleError(reply, 400, 'Game acronym is required');
      }

      const tournaments = await fetchTournamentsForGame(game, 'finished');

      console.log(`📚 Final finished result for ${game}:`, tournaments.length, 'tournaments');

      return tournaments;
    } catch (error) {
      console.error('Error fetching finished tournaments:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/tournaments/finished/all - Tous les tournois terminés
  fastify.get('/api/tournaments/finished/all', async (request, reply) => {
    try {
      const tournaments = await fetchTournamentsForAllGames('finished');

      console.log(`📚 FINAL FINISHED RESULT: ${tournaments.length} total finished tournaments`);

      return tournaments;
    } catch (error) {
      console.error('Error fetching all finished tournaments:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/tournaments/by-date - Tournois par date
  fastify.get('/api/tournaments/by-date', async (request, reply) => {
    try {
      const { date, game } = request.query;

      if (!date) {
        return handleError(reply, 400, 'Date is required (format: YYYY-MM-DD)');
      }

      console.log(`📅 Fetching tournaments for date: ${date}, game: ${game || 'ALL'}`);

      const PANDASCORE_TOKEN = process.env.API_PANDASCORE;
      const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

      const tournamentsEndpoint = game
        ? `${PANDASCORE_BASE_URL}/${encodeURIComponent(game)}/tournaments`
        : `${PANDASCORE_BASE_URL}/tournaments`;

      const url = new URL(tournamentsEndpoint);
      url.searchParams.set('range[begin_at]', `1970-01-01,${date}T23:59:59Z`);
      url.searchParams.set('range[end_at]', `${date}T00:00:00Z,2100-01-01`);
      url.searchParams.set('sort', 'begin_at');
      url.searchParams.set('page[size]', '100');
      url.searchParams.set('token', PANDASCORE_TOKEN);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EsportNews/1.0'
        }
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch tournaments for date ${date}:`, response.status);
        return handleError(reply, response.status, `Failed to fetch tournaments: ${response.status}`);
      }

      const tournaments = await response.json();

      const enrichedTournaments = tournaments.map(tournament => ({
        ...tournament,
        gameSlug: game || tournament.videogame?.slug || 'unknown'
      }));

      return enrichedTournaments;
    } catch (error) {
      console.error('Error fetching tournaments by date:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });
}

module.exports = tournamentRoutes;
