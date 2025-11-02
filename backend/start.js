/**
 * Development server starter
 * Launches the Fastify app directly
 */

require('dotenv').config();

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
const healthRoutes = require('./api/routes/health');
const gameRoutes = require('./api/routes/games');
const tournamentRoutes = require('./api/routes/tournaments');
const newsRoutes = require('./api/routes/news');
const articleRoutes = require('./api/routes/articles');
const adsRoutes = require('./api/routes/ads');
const matchesRoutes = require('./api/routes/matches');
const authRoutes = require('./api/routes/auth');
const teamsRoutes = require('./api/routes/teams');
const notificationsRoutes = require('./api/routes/notifications');

/**
 * Enregistrement de toutes les routes
 */
async function registerRoutes() {
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

  console.log('✅ All routes registered successfully');
}

async function start() {
  try {
    await registerRoutes();
    await fastify.listen({ port: 4343, host: '0.0.0.0' });
    console.log('🚀 Server running at http://localhost:4343');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
