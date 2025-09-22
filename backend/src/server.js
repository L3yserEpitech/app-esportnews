const fastify = require('fastify')({ logger: true });

fastify.register(require('@fastify/cors'), {
  origin: true
});

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

fastify.get('/api/news', async (request, reply) => {
  return {
    news: [
      {
        id: 1,
        title: 'Latest Esport Tournament Results',
        content: 'Amazing matches happened today...',
        date: new Date().toISOString()
      },
      {
        id: 2,
        title: 'New Gaming Championship Announced',
        content: 'The biggest tournament of the year...',
        date: new Date().toISOString()
      }
    ]
  };
});

fastify.get('/api/live-matches', async (request, reply) => {
  try {
    const response = await fetch('https://esports.sportdevs.com/matches-live', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer 7KwP-8CB10mnytro5OinZA',
      },
    });

    if (!response.ok) {
      reply.code(response.status);
      return { error: 'Failed to fetch live matches' };
    }

    const data = await response.json();
    console.log('Live matches fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('Error fetching live matches:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 4343, host: '0.0.0.0' });
    console.log('Server is running on http://localhost:4343');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();