/**
 * Routes pour les jeux
 */

const { supabase } = require('../../src/config/supabase');
const { handleDatabaseError, handleError } = require('../utils/errorHandler');

async function gameRoutes(fastify) {
  // GET /api/games - Récupérer tous les jeux
  fastify.get('/api/games', async (_request, reply) => {
    try {
      console.log('🎮 Fetching games from Supabase');

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('❌ Error fetching games:', error);
        return handleError(reply, 500, 'Failed to fetch games');
      }

      console.log(`✅ Successfully fetched ${data.length} games`);
      return data;
    } catch (error) {
      console.error('❌ Error in /api/games:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/games/:id - Récupérer un jeu par ID
  fastify.get('/api/games/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      console.log(`🎮 Fetching game with id: ${id}`);

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error(`❌ Error fetching game ${id}:`, error);
        const { statusCode, message } = handleDatabaseError(error);
        return handleError(reply, statusCode, message);
      }

      console.log(`✅ Successfully fetched game: ${data.name}`);
      return data;
    } catch (error) {
      console.error('❌ Error in /api/games/:id:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/games/acronym/:acronym - Récupérer un jeu par acronyme
  fastify.get('/api/games/acronym/:acronym', async (request, reply) => {
    try {
      const { acronym } = request.params;
      console.log(`🎮 Fetching game with acronym: ${acronym}`);

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('acronym', acronym)
        .single();

      if (error) {
        console.error(`❌ Error fetching game with acronym ${acronym}:`, error);
        const { statusCode, message } = handleDatabaseError(error);
        return handleError(reply, statusCode, message);
      }

      console.log(`✅ Successfully fetched game: ${data.name}`);
      return data;
    } catch (error) {
      console.error('❌ Error in /api/games/acronym/:acronym:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });
}

module.exports = gameRoutes;
