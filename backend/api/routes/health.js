/**
 * Routes de santé (health check)
 */

async function healthRoutes(fastify) {
  fastify.get('/', async (request, reply) => {
    return { message: 'Esport News API is running!' };
  });

  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  fastify.get('/api/test', async (request, reply) => {
    console.log('🚀 Test endpoint called from frontend!');
    return { message: 'Test successful!', timestamp: new Date().toISOString() };
  });
}

module.exports = healthRoutes;
