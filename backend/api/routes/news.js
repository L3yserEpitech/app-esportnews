/**
 * Routes pour les actualités
 */

const { handleError } = require('../utils/errorHandler');

async function newsRoutes(fastify) {
  // GET /api/news - Actualités
  fastify.get('/api/news', async (request, reply) => {
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
        console.log(`⚠️ SportDevs API returned: HTTP ${response.status}`);
        return handleError(reply, response.status, 'Failed to fetch news');
      }

      const data = await response.json();
      console.log('✅ News fetched successfully from SportDevs');
      return data;
    } catch (error) {
      console.error('Error fetching news:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });
}

module.exports = newsRoutes;
