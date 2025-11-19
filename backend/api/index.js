/**
 * Backend API - Point d'entrée principal
 * Structure modulaire avec routes séparées
 */

const fastify = require('fastify')({ logger: true });

// CORS et Rate Limiting
fastify.register(require('@fastify/cors'), {
  origin: true
});

fastify.register(require('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute',
  ban: 10,
  banTimeWindow: '5 minutes'
});

// Import des routes
const healthRoutes = require('./routes/health');
const gameRoutes = require('./routes/games');
const tournamentRoutes = require('./routes/tournaments');
const newsRoutes = require('./routes/news');
const articleRoutes = require('./routes/articles');
const adsRoutes = require('./routes/ads');
const matchesRoutes = require('./routes/matches');
const authRoutes = require('./routes/auth');
const teamsRoutes = require('./routes/teams');
const notificationsRoutes = require('./routes/notifications');

/**
 * Enregistrement de toutes les routes
 */
let initialized = false;

async function registerRoutes() {
  if (initialized) {
    return; // Évite de re-enregistrer les routes
  }

  await healthRoutes(fastify);
  await gameRoutes(fastify);
  await tournamentRoutes(fastify);
  await newsRoutes(fastify);
  await articleRoutes(fastify);
  await adsRoutes(fastify);
  await matchesRoutes(fastify);
  await authRoutes(fastify);
  await teamsRoutes(fastify);
  await notificationsRoutes(fastify);

  initialized = true;
  console.log('✅ All routes registered successfully');
}

// Export pour Vercel
module.exports = async (req, res) => {
  try {
    await registerRoutes();
    await fastify.ready();
    fastify.server.emit('request', req, res);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
};
