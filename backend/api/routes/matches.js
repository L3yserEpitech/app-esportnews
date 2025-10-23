/**
 * Routes pour les matchs
 */

const { handleError } = require('../utils/errorHandler');

async function matchesRoutes(fastify) {
  // GET /api/live-matches - Matchs en direct
  fastify.get('/api/live-matches', async (request, reply) => {
    try {
      const SPORTDEVS_TOKEN = process.env.API_SPORTDEVS;
      const response = await fetch('https://esports.sportdevs.com/matches-live', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${SPORTDEVS_TOKEN}`
        }
      });

      if (!response.ok) {
        return handleError(reply, response.status, 'Failed to fetch live matches');
      }

      const data = await response.json();
      console.log('✅ Live matches fetched successfully');
      return data;
    } catch (error) {
      console.error('Error fetching live matches:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/matches/by-date - Matchs par date
  fastify.get('/api/matches/by-date', async (request, reply) => {
    try {
      const { date, game } = request.query;

      if (!date) {
        return handleError(reply, 400, 'Date is required (format: YYYY-MM-DD)');
      }

      console.log(`⚔️ Fetching matches for date: ${date}, game: ${game || 'ALL'}`);

      const PANDASCORE_TOKEN = process.env.API_PANDASCORE;
      const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

      const matchesEndpoint = game
        ? `${PANDASCORE_BASE_URL}/${encodeURIComponent(game)}/matches`
        : `${PANDASCORE_BASE_URL}/matches`;

      const url = new URL(matchesEndpoint);
      url.searchParams.set('range[begin_at]', `${date}T00:00:00Z,${date}T23:59:59Z`);
      url.searchParams.set('per_page', '100');
      url.searchParams.set('sort', 'begin_at');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${PANDASCORE_TOKEN}`,
          'User-Agent': 'EsportNews/1.0'
        }
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch matches for date ${date}:`, response.status);
        return handleError(reply, response.status, `Failed to fetch matches: ${response.status}`);
      }

      const matches = await response.json();

      const enrichedMatches = matches.map(match => ({
        ...match,
        gameSlug: game || match.videogame?.slug || 'unknown'
      }));

      return enrichedMatches;
    } catch (error) {
      console.error('Error fetching matches by date:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });
}

module.exports = matchesRoutes;
