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

// Tournaments route
fastify.get('/api/tournaments', async (request, reply) => {
  try {
    const { game } = request.query;

    if (!game) {
      reply.code(400);
      return { error: 'Game acronym is required' };
    }

    console.log(`🎯 Fetching tournaments for game: ${game}`);

    const PANDASCORE_API_TOKEN = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk';
    const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

    console.log(`✅ Using game acronym directly: ${game}`);

    // Fonction pour récupérer les tournois par tier
    const fetchTournamentsByTier = async (tier) => {
      const url = `${PANDASCORE_BASE_URL}/${game}/tournaments/running?filter[tier]=${tier}&page[size]=50&token=${PANDASCORE_API_TOKEN}`;

      console.log(`🔄 Fetching tournaments for ${game} tier ${tier}`);
      console.log(`📡 FULL URL BEING CALLED:`, url);
      console.log(`🔍 URL BREAKDOWN:`, {
        baseUrl: PANDASCORE_BASE_URL,
        game: game,
        endpoint: 'tournaments/running',
        filters: {
          tier: tier,
          pageSize: 50
        },
        token: PANDASCORE_API_TOKEN ? 'PROVIDED' : 'MISSING'
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EsportNews/1.0',
        },
      });

      console.log(`📊 Response received for ${game} tier ${tier}:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to fetch tier ${tier} for ${game}:`, {
          status: response.status,
          statusText: response.statusText,
          url: url,
          error: errorText
        });
        // Return empty array instead of throwing to continue with other tiers
        return [];
      }

      const tournaments = await response.json();

      console.log(`📊 Tier ${tier.toUpperCase()} for ${game}:`, tournaments.length, 'tournaments');
      if (tournaments.length > 0) {
        console.log(`🏆 Sample tournament (tier ${tier}):`, {
          id: tournaments[0].id,
          name: tournaments[0].name,
          league: tournaments[0].league?.name,
          prizepool: tournaments[0].prizepool,
          teams: tournaments[0].teams?.length || 0,
          matches: tournaments[0].matches?.length || 0
        });
      }

      // Filtrer les tournois en cours et ajouter les infos tier
      const now = new Date();
      const activeTournaments = tournaments.filter(tournament => {
        // Garder seulement les tournois qui ne sont pas encore terminés
        if (!tournament.end_at) return true; // Si pas de date de fin, on garde
        const endDate = new Date(tournament.end_at);
        return endDate > now; // Garder si la date de fin est dans le futur
      });

      console.log(`🔍 Filtered ${game} tier ${tier}: ${tournaments.length} → ${activeTournaments.length} active tournaments`);

      return activeTournaments.map(tournament => ({
        ...tournament,
        tier: tier
      }));
    };

    // Fetch tournaments for all tiers in parallel
    const tiers = ['s', 'a', 'b', 'c', 'd'];
    const tournamentPromises = tiers.map(tier => fetchTournamentsByTier(tier));

    const results = await Promise.allSettled(tournamentPromises);

    // Combine all successful results
    const allTournaments = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allTournaments.push(...result.value);
      } else {
        console.error(`Failed to fetch tier ${tiers[index]}:`, result.reason);
      }
    });

    // Sort tournaments by tier priority (s > a > b > c > d) then by end date (closest ending first)
    const tierPriority = { 's': 5, 'a': 4, 'b': 3, 'c': 2, 'd': 1 };
    allTournaments.sort((a, b) => {
      // D'abord par tier
      const tierDiff = tierPriority[b.tier] - tierPriority[a.tier];
      if (tierDiff !== 0) return tierDiff;

      // Puis par date de fin (les plus proches en premier)
      if (!a.end_at && !b.end_at) return 0; // Si aucune date de fin, égaux
      if (!a.end_at) return 1; // a sans date de fin va à la fin
      if (!b.end_at) return -1; // b sans date de fin va à la fin

      const endDateA = new Date(a.end_at);
      const endDateB = new Date(b.end_at);
      return endDateA - endDateB; // Date la plus proche en premier
    });

    console.log(`🎯 Final result for ${game}:`, {
      totalTournaments: allTournaments.length,
      byTier: {
        s: allTournaments.filter(t => t.tier === 's').length,
        a: allTournaments.filter(t => t.tier === 'a').length,
        b: allTournaments.filter(t => t.tier === 'b').length,
        c: allTournaments.filter(t => t.tier === 'c').length,
        d: allTournaments.filter(t => t.tier === 'd').length,
      }
    });

    if (allTournaments.length > 0) {
      console.log('🔥 First tournament:', {
        name: allTournaments[0].name,
        tier: allTournaments[0].tier,
        league: allTournaments[0].league?.name,
        teams: allTournaments[0].teams?.length,
        matches: allTournaments[0].matches?.length,
        endDate: allTournaments[0].end_at
      });

      // Log des prochains tournois à se terminer pour ce jeu
      console.log(`⏰ Next ${game} tournaments ending:`);
      allTournaments.slice(0, 3).forEach((t, index) => {
        console.log(`   ${index + 1}. ${t.name} - Ends: ${t.end_at || 'No end date'}`);
      });
    }

    return allTournaments;
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Route pour récupérer tous les tournois de tous les jeux
fastify.get('/api/tournaments/all', async (request, reply) => {
  try {
    console.log('🌐 Fetching tournaments for ALL games');

    const PANDASCORE_API_TOKEN = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk';
    const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

    // Liste des jeux à inclure (basée sur CLAUDE.md)
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

    console.log('🎮 Games to fetch:', ALL_GAMES);

    // Fonction pour récupérer les tournois d'un jeu pour un tier donné
    const fetchTournamentsForGameAndTier = async (game, tier) => {
      const url = `${PANDASCORE_BASE_URL}/${game}/tournaments/running?filter[tier]=${tier}&page[size]=50&token=${PANDASCORE_API_TOKEN}`;

      console.log(`🔄 Fetching ${game} tier ${tier}`);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'EsportNews/1.0',
          },
        });

        if (!response.ok) {
          console.log(`⚠️  ${game} tier ${tier}: HTTP ${response.status}`);
          return [];
        }

        const tournaments = await response.json();
        console.log(`✅ ${game} tier ${tier}: ${tournaments.length} tournaments`);

        // Filtrer les tournois en cours et ajouter les infos de jeu et tier
        const now = new Date();
        const activeTournaments = tournaments.filter(tournament => {
          // Garder seulement les tournois qui ne sont pas encore terminés
          if (!tournament.end_at) return true; // Si pas de date de fin, on garde
          const endDate = new Date(tournament.end_at);
          return endDate > now; // Garder si la date de fin est dans le futur
        });

        console.log(`🔍 Filtered ${game} tier ${tier}: ${tournaments.length} → ${activeTournaments.length} active tournaments`);

        return activeTournaments.map(tournament => ({
          ...tournament,
          tier: tier,
          gameSlug: game
        }));
      } catch (error) {
        console.error(`❌ Error fetching ${game} tier ${tier}:`, error.message);
        return [];
      }
    };

    // Fonction pour récupérer tous les tournois d'un tier donné (tous jeux confondus)
    const fetchAllTournamentsForTier = async (tier) => {
      console.log(`🏆 Starting tier ${tier.toUpperCase()} for all games...`);

      const gamePromises = ALL_GAMES.map(game =>
        fetchTournamentsForGameAndTier(game, tier)
      );

      const results = await Promise.allSettled(gamePromises);

      const tierTournaments = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          tierTournaments.push(...result.value);
        } else {
          console.error(`Failed ${ALL_GAMES[index]} tier ${tier}:`, result.reason);
        }
      });

      console.log(`🎯 Tier ${tier.toUpperCase()} total: ${tierTournaments.length} tournaments`);
      return tierTournaments;
    };

    // Récupérer tous les tiers dans l'ordre de priorité
    const tiers = ['s', 'a', 'b', 'c', 'd'];
    const allTournaments = [];

    for (const tier of tiers) {
      const tierTournaments = await fetchAllTournamentsForTier(tier);
      allTournaments.push(...tierTournaments);
    }

    // Tri final : par tier (déjà fait), puis par proximité de fin (les plus proches de se terminer d'abord)
    allTournaments.sort((a, b) => {
      // D'abord par tier (s > a > b > c > d)
      const tierPriority = { 's': 5, 'a': 4, 'b': 3, 'c': 2, 'd': 1 };
      const tierDiff = tierPriority[b.tier] - tierPriority[a.tier];
      if (tierDiff !== 0) return tierDiff;

      // Puis par date de fin (les plus proches en premier)
      if (!a.end_at && !b.end_at) return 0; // Si aucune date de fin, égaux
      if (!a.end_at) return 1; // a sans date de fin va à la fin
      if (!b.end_at) return -1; // b sans date de fin va à la fin

      const endDateA = new Date(a.end_at);
      const endDateB = new Date(b.end_at);
      return endDateA - endDateB; // Date la plus proche en premier
    });

    console.log(`🎊 FINAL RESULT: ${allTournaments.length} total active tournaments across all games`);

    // Statistiques par jeu
    const statsByGame = {};
    ALL_GAMES.forEach(game => {
      statsByGame[game] = allTournaments.filter(t => t.gameSlug === game).length;
    });
    console.log('📊 Active tournaments per game:', statsByGame);

    // Statistiques par tier
    const statsByTier = {};
    tiers.forEach(tier => {
      statsByTier[tier] = allTournaments.filter(t => t.tier === tier).length;
    });
    console.log('🏅 Active tournaments per tier:', statsByTier);

    // Log des prochains tournois à se terminer
    if (allTournaments.length > 0) {
      console.log('⏰ Next tournaments ending:');
      allTournaments.slice(0, 5).forEach((t, index) => {
        console.log(`   ${index + 1}. ${t.name} (${t.gameSlug}) - Ends: ${t.end_at || 'No end date'}`);
      });
    }

    return allTournaments;
  } catch (error) {
    console.error('Error fetching all tournaments:', error);
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