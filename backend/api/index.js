const fastify = require('fastify')({ logger: true });
const { supabase } = require('../src/config/supabase');
const multipart = require('@fastify/multipart');

fastify.register(require('@fastify/cors'), {
  origin: true
});

fastify.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
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

// Route pour récupérer tous les jeux
fastify.get('/api/games', async (_request, reply) => {
  try {
    console.log('🎮 Fetching games from Supabase');

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('❌ Error fetching games:', error);
      reply.code(500);
      return { error: 'Failed to fetch games' };
    }

    console.log(`✅ Successfully fetched ${data.length} games`);
    return data;
  } catch (error) {
    console.error('❌ Error in /api/games:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Route pour récupérer un jeu par ID
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
      reply.code(error.code === 'PGRST116' ? 404 : 500);
      return { error: error.code === 'PGRST116' ? 'Game not found' : 'Failed to fetch game' };
    }

    console.log(`✅ Successfully fetched game: ${data.name}`);
    return data;
  } catch (error) {
    console.error('❌ Error in /api/games/:id:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Route pour récupérer un jeu par acronyme
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
      reply.code(error.code === 'PGRST116' ? 404 : 500);
      return { error: error.code === 'PGRST116' ? 'Game not found' : 'Failed to fetch game' };
    }

    console.log(`✅ Successfully fetched game: ${data.name}`);
    return data;
  } catch (error) {
    console.error('❌ Error in /api/games/acronym/:acronym:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
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
        'Authorization': `Bearer ${process.env.API_SPORTDEVS}`,
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

// Route dynamique pour les tournois avec filtres
fastify.get('/api/tournaments/filtered', async (request, reply) => {
  try {
    const { game, status = 'running', 'filter[tier]': tierFilter } = request.query;

    console.log(`🔍 Fetching filtered tournaments: ${JSON.stringify({
      game: game || 'ALL',
      status,
      tierFilter
    })}`);

    const PANDASCORE_API_TOKEN = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk';
    const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

    const ALL_GAMES = [
      'valorant', 'fifa', 'lol-wild-rift', 'dota2', 'overwatch',
      'cod-mw', 'lol', 'rainbow-six-siege', 'rocket-league', 'csgo'
    ];

    // Déterminer l'endpoint selon le statut
    let endpoint;
    switch (status) {
    case 'upcoming':
      endpoint = 'tournaments/upcoming';
      break;
    case 'finished':
      endpoint = 'tournaments/past';
      break;
    case 'running':
    default:
      endpoint = 'tournaments/running';
      break;
    }

    // Déterminer les tiers à requêter
    let tiersToFetch;
    if (tierFilter) {
      tiersToFetch = Array.isArray(tierFilter) ? tierFilter : [tierFilter];
      console.log(`🎯 Filtering by tiers: ${tiersToFetch.join(', ')}`);
    } else {
      tiersToFetch = ['s', 'a', 'b', 'c', 'd'];
    }

    // Déterminer les jeux à requêter
    const gamesToFetch = game ? [game] : ALL_GAMES;

    // Fonction pour récupérer les tournois d'un jeu pour un tier donné
    const fetchTournamentsForGameAndTier = async (gameSlug, tier) => {
      const url = `${PANDASCORE_BASE_URL}/${gameSlug}/${endpoint}?filter[tier]=${tier}&page[size]=100&token=${PANDASCORE_API_TOKEN}`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'EsportNews/1.0',
          },
        });

        if (!response.ok) {
          console.log(`⚠️ ${status} ${gameSlug} tier ${tier}: HTTP ${response.status}`);
          return [];
        }

        const tournaments = await response.json();
        console.log(`✅ ${status} ${gameSlug} tier ${tier}: ${tournaments.length} tournaments`);

        // Filtrer les tournois selon le statut et ajouter les infos
        const now = new Date();
        let statusFilteredTournaments = tournaments;

        if (status === 'running') {
          statusFilteredTournaments = tournaments.filter(tournament => {
            if (!tournament.end_at) return true;
            const endDate = new Date(tournament.end_at);
            return endDate > now;
          });
        }

        return statusFilteredTournaments.map(tournament => ({
          ...tournament,
          tier: tier,
          gameSlug: gameSlug
        }));
      } catch (error) {
        console.error(`❌ Error fetching ${status} ${gameSlug} tier ${tier}:`, error.message);
        return [];
      }
    };

    // Récupérer tous les tournois en parallèle
    const allPromises = [];
    for (const gameSlug of gamesToFetch) {
      for (const tier of tiersToFetch) {
        allPromises.push(fetchTournamentsForGameAndTier(gameSlug, tier));
      }
    }

    const results = await Promise.allSettled(allPromises);
    const allTournaments = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allTournaments.push(...result.value);
      }
    });

    // Tri final par tier puis par date
    const tierPriority = { 's': 5, 'a': 4, 'b': 3, 'c': 2, 'd': 1, 'unranked': 0 };
    allTournaments.sort((a, b) => {
      const tierDiff = tierPriority[b.tier] - tierPriority[a.tier];
      if (tierDiff !== 0) return tierDiff;

      // Tri par date selon le statut
      let dateA, dateB;
      if (status === 'upcoming') {
        dateA = new Date(a.begin_at);
        dateB = new Date(b.begin_at);
        return dateA - dateB; // Plus proche d'abord
      } else if (status === 'finished') {
        dateA = new Date(a.end_at || a.begin_at);
        dateB = new Date(b.end_at || b.begin_at);
        return dateB - dateA; // Plus récent d'abord
      } else {
        dateA = new Date(a.end_at || '2099-12-31');
        dateB = new Date(b.end_at || '2099-12-31');
        return dateA - dateB; // Se termine plus tôt d'abord
      }
    });

    console.log(`🎊 FILTERED RESULT: ${allTournaments.length} tournaments`, {
      game: game || 'ALL',
      status,
      tierFilter: tierFilter || 'ALL',
      byTier: tiersToFetch.reduce((acc, tier) => {
        acc[tier] = allTournaments.filter(t => t.tier === tier).length;
        return acc;
      }, {}),
      byGame: gamesToFetch.reduce((acc, gameSlug) => {
        acc[gameSlug] = allTournaments.filter(t => t.gameSlug === gameSlug).length;
        return acc;
      }, {})
    });

    return allTournaments;

  } catch (error) {
    console.error('Error fetching filtered tournaments:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Tournaments route (existante - maintenue pour compatibilité)
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
      const url = `${PANDASCORE_BASE_URL}/${game}/tournaments/running?filter[tier]=${tier}&page[size]=100&token=${PANDASCORE_API_TOKEN}`;

      console.log(`🔄 Fetching tournaments for ${game} tier ${tier}`);
      console.log(`📡 FULL URL BEING CALLED: ${url}`);
      console.log(`🔍 URL BREAKDOWN: ${JSON.stringify({
        baseUrl: PANDASCORE_BASE_URL,
        game: game,
        endpoint: 'tournaments/running',
        filters: {
          tier: tier,
          pageSize: 50
        },
        token: PANDASCORE_API_TOKEN ? 'PROVIDED' : 'MISSING'
      })}`);

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
      const url = `${PANDASCORE_BASE_URL}/${game}/tournaments/running?filter[tier]=${tier}&page[size]=100&token=${PANDASCORE_API_TOKEN}`;

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

// Route pour récupérer les tournois à venir pour un jeu spécifique
fastify.get('/api/tournaments/upcoming', async (request, reply) => {
  try {
    const { game } = request.query;

    if (!game) {
      reply.code(400);
      return { error: 'Game acronym is required' };
    }

    console.log(`🔮 Fetching upcoming tournaments for game: ${game}`);

    const PANDASCORE_API_TOKEN = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk';
    const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

    // Fonction pour récupérer les tournois à venir par tier
    const fetchUpcomingTournamentsByTier = async (tier) => {
      const url = `${PANDASCORE_BASE_URL}/${game}/tournaments/upcoming?filter[tier]=${tier}&page[size]=100&token=${PANDASCORE_API_TOKEN}`;

      console.log(`🔄 Fetching upcoming tournaments for ${game} tier ${tier}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EsportNews/1.0',
        },
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch upcoming tier ${tier} for ${game}:`, response.status);
        return [];
      }

      const tournaments = await response.json();
      console.log(`📊 Upcoming Tier ${tier.toUpperCase()} for ${game}:`, tournaments.length, 'tournaments');

      return tournaments.map(tournament => ({
        ...tournament,
        tier: tier
      }));
    };

    // Fetch tournaments for all tiers in parallel
    const tiers = ['s', 'a', 'b', 'c', 'd'];
    const tournamentPromises = tiers.map(tier => fetchUpcomingTournamentsByTier(tier));
    const results = await Promise.allSettled(tournamentPromises);

    // Combine all successful results
    const allTournaments = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allTournaments.push(...result.value);
      } else {
        console.error(`Failed to fetch upcoming tier ${tiers[index]}:`, result.reason);
      }
    });

    // Sort by tier priority then by start date (closest first)
    const tierPriority = { 's': 5, 'a': 4, 'b': 3, 'c': 2, 'd': 1 };
    allTournaments.sort((a, b) => {
      const tierDiff = tierPriority[b.tier] - tierPriority[a.tier];
      if (tierDiff !== 0) return tierDiff;

      const startDateA = new Date(a.begin_at);
      const startDateB = new Date(b.begin_at);
      return startDateA - startDateB;
    });

    console.log(`🔮 Final upcoming result for ${game}:`, allTournaments.length, 'tournaments');
    return allTournaments;

  } catch (error) {
    console.error('Error fetching upcoming tournaments:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Route pour récupérer tous les tournois à venir de tous les jeux
fastify.get('/api/tournaments/upcoming/all', async (request, reply) => {
  try {
    console.log('🌐 Fetching upcoming tournaments for ALL games');

    const PANDASCORE_API_TOKEN = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk';
    const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

    const ALL_GAMES = [
      'valorant', 'fifa', 'lol-wild-rift', 'dota2', 'overwatch',
      'cod-mw', 'lol', 'rainbow-six-siege', 'rocket-league', 'csgo'
    ];

    const fetchUpcomingTournamentsForGameAndTier = async (game, tier) => {
      const url = `${PANDASCORE_BASE_URL}/${game}/tournaments/upcoming?filter[tier]=${tier}&page[size]=100&token=${PANDASCORE_API_TOKEN}`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'EsportNews/1.0',
          },
        });

        if (!response.ok) {
          console.log(`⚠️ Upcoming ${game} tier ${tier}: HTTP ${response.status}`);
          return [];
        }

        const tournaments = await response.json();
        console.log(`✅ Upcoming ${game} tier ${tier}: ${tournaments.length} tournaments`);

        return tournaments.map(tournament => ({
          ...tournament,
          tier: tier,
          gameSlug: game
        }));
      } catch (error) {
        console.error(`❌ Error fetching upcoming ${game} tier ${tier}:`, error.message);
        return [];
      }
    };

    const tiers = ['s', 'a', 'b', 'c', 'd'];
    const allTournaments = [];

    for (const tier of tiers) {
      console.log(`🏆 Starting upcoming tier ${tier.toUpperCase()} for all games...`);
      const gamePromises = ALL_GAMES.map(game => fetchUpcomingTournamentsForGameAndTier(game, tier));
      const results = await Promise.allSettled(gamePromises);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allTournaments.push(...result.value);
        } else {
          console.error(`Failed upcoming ${ALL_GAMES[index]} tier ${tier}:`, result.reason);
        }
      });
    }

    // Sort by tier priority then by start date
    const tierPriority = { 's': 5, 'a': 4, 'b': 3, 'c': 2, 'd': 1 };
    allTournaments.sort((a, b) => {
      const tierDiff = tierPriority[b.tier] - tierPriority[a.tier];
      if (tierDiff !== 0) return tierDiff;

      const startDateA = new Date(a.begin_at);
      const startDateB = new Date(b.begin_at);
      return startDateA - startDateB;
    });

    console.log(`🔮 FINAL UPCOMING RESULT: ${allTournaments.length} total upcoming tournaments`);
    return allTournaments;

  } catch (error) {
    console.error('Error fetching all upcoming tournaments:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Route pour récupérer les tournois passés pour un jeu spécifique
fastify.get('/api/tournaments/finished', async (request, reply) => {
  try {
    const { game } = request.query;

    if (!game) {
      reply.code(400);
      return { error: 'Game acronym is required' };
    }

    console.log(`📚 Fetching finished tournaments for game: ${game}`);

    const PANDASCORE_API_TOKEN = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk';
    const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

    // Fonction pour récupérer les tournois passés par tier
    const fetchFinishedTournamentsByTier = async (tier) => {
      const url = `${PANDASCORE_BASE_URL}/${game}/tournaments/past?filter[tier]=${tier}&page[size]=100&token=${PANDASCORE_API_TOKEN}`;

      console.log(`🔄 Fetching finished tournaments for ${game} tier ${tier}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EsportNews/1.0',
        },
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch finished tier ${tier} for ${game}:`, response.status);
        return [];
      }

      const tournaments = await response.json();
      console.log(`📊 Finished Tier ${tier.toUpperCase()} for ${game}:`, tournaments.length, 'tournaments');

      return tournaments.map(tournament => ({
        ...tournament,
        tier: tier
      }));
    };

    // Fetch tournaments for all tiers in parallel
    const tiers = ['s', 'a', 'b', 'c', 'd'];
    const tournamentPromises = tiers.map(tier => fetchFinishedTournamentsByTier(tier));
    const results = await Promise.allSettled(tournamentPromises);

    // Combine all successful results
    const allTournaments = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allTournaments.push(...result.value);
      } else {
        console.error(`Failed to fetch finished tier ${tiers[index]}:`, result.reason);
      }
    });

    // Sort by tier priority then by end date (most recent first)
    const tierPriority = { 's': 5, 'a': 4, 'b': 3, 'c': 2, 'd': 1 };
    allTournaments.sort((a, b) => {
      const tierDiff = tierPriority[b.tier] - tierPriority[a.tier];
      if (tierDiff !== 0) return tierDiff;

      const endDateA = new Date(a.end_at || a.begin_at);
      const endDateB = new Date(b.end_at || b.begin_at);
      return endDateB - endDateA; // Most recent first
    });

    console.log(`📚 Final finished result for ${game}:`, allTournaments.length, 'tournaments');
    return allTournaments;

  } catch (error) {
    console.error('Error fetching finished tournaments:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Route pour récupérer les tournois par date
fastify.get('/api/tournaments/by-date', async (request, reply) => {
  try {
    const { date, game } = request.query;

    if (!date) {
      reply.code(400);
      return { error: 'Date is required (format: YYYY-MM-DD)' };
    }

    console.log(`📅 Fetching tournaments for date: ${date}, game: ${game || 'ALL'}`);

    const PANDASCORE_API_TOKEN = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk';
    const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

    // Construire l'endpoint selon le jeu
    const tournamentsEndpoint = game
      ? `${PANDASCORE_BASE_URL}/${encodeURIComponent(game)}/tournaments`
      : `${PANDASCORE_BASE_URL}/tournaments`;

    // Construire l'URL avec les paramètres de date
    const url = new URL(tournamentsEndpoint);
    url.searchParams.set('range[begin_at]', `1970-01-01,${date}T23:59:59Z`);
    url.searchParams.set('range[end_at]', `${date}T00:00:00Z,2100-01-01`);
    url.searchParams.set('sort', 'begin_at');
    url.searchParams.set('page[size]', '100');
    url.searchParams.set('token', PANDASCORE_API_TOKEN);

    console.log(`📡 API URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EsportNews/1.0',
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch tournaments for date ${date}:`, response.status);
      reply.code(response.status);
      return { error: `Failed to fetch tournaments: ${response.status}` };
    }

    const tournaments = await response.json();

    console.log(`📅 Tournaments for ${date}:`, {
      game: game || 'ALL',
      date,
      count: tournaments.length,
      tournaments: tournaments.map(t => ({
        id: t.id,
        name: t.name,
        begin_at: t.begin_at,
        end_at: t.end_at,
        tier: t.tier
      }))
    });

    // Ajouter gameSlug si ce n'est pas déjà présent
    const enrichedTournaments = tournaments.map(tournament => ({
      ...tournament,
      gameSlug: game || tournament.videogame?.slug || 'unknown'
    }));

    return enrichedTournaments;

  } catch (error) {
    console.error('Error fetching tournaments by date:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Route pour récupérer les matchs par date
fastify.get('/api/matches/by-date', async (request, reply) => {
  try {
    const { date, game } = request.query;

    if (!date) {
      reply.code(400);
      return { error: 'Date is required (format: YYYY-MM-DD)' };
    }

    console.log(`⚔️ Fetching matches for date: ${date}, game: ${game || 'ALL'}`);

    const PANDASCORE_API_TOKEN = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk';
    const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

    // Construire l'endpoint selon le jeu
    const matchesEndpoint = game
      ? `${PANDASCORE_BASE_URL}/${encodeURIComponent(game)}/matches`
      : `${PANDASCORE_BASE_URL}/matches`;

    // Construire l'URL complète avec les paramètres
    const url = new URL(matchesEndpoint);
    url.searchParams.set('range[begin_at]', `${date}T00:00:00Z,${date}T23:59:59Z`);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('sort', 'begin_at');

    console.log(`📡 Full URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${PANDASCORE_API_TOKEN}`,
        'User-Agent': 'EsportNews/1.0',
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch matches for date ${date}:`, {
        status: response.status,
        statusText: response.statusText,
        url: url.toString()
      });
      reply.code(response.status);
      return { error: `Failed to fetch matches: ${response.status}` };
    }

    const matches = await response.json();

    console.log(`⚔️ Matches for ${date}:`, {
      game: game || 'ALL',
      date,
      count: matches.length,
      matches: matches.slice(0, 3).map(m => ({
        id: m.id,
        name: m.name,
        begin_at: m.begin_at,
        status: m.status,
        tournament: m.tournament?.name
      }))
    });

    // Ajouter gameSlug si ce n'est pas déjà présent
    const enrichedMatches = matches.map(match => ({
      ...match,
      gameSlug: game || match.videogame?.slug || 'unknown'
    }));

    return enrichedMatches;

  } catch (error) {
    console.error('Error fetching matches by date:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Route pour récupérer tous les tournois passés de tous les jeux
fastify.get('/api/tournaments/finished/all', async (request, reply) => {
  try {
    console.log('🌐 Fetching finished tournaments for ALL games');

    const PANDASCORE_API_TOKEN = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk';
    const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

    const ALL_GAMES = [
      'valorant', 'fifa', 'lol-wild-rift', 'dota2', 'overwatch',
      'cod-mw', 'lol', 'rainbow-six-siege', 'rocket-league', 'csgo'
    ];

    const fetchFinishedTournamentsForGameAndTier = async (game, tier) => {
      const url = `${PANDASCORE_BASE_URL}/${game}/tournaments/past?filter[tier]=${tier}&page[size]=100&token=${PANDASCORE_API_TOKEN}`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'EsportNews/1.0',
          },
        });

        if (!response.ok) {
          console.log(`⚠️ Finished ${game} tier ${tier}: HTTP ${response.status}`);
          return [];
        }

        const tournaments = await response.json();
        console.log(`✅ Finished ${game} tier ${tier}: ${tournaments.length} tournaments`);

        return tournaments.map(tournament => ({
          ...tournament,
          tier: tier,
          gameSlug: game
        }));
      } catch (error) {
        console.error(`❌ Error fetching finished ${game} tier ${tier}:`, error.message);
        return [];
      }
    };

    const tiers = ['s', 'a', 'b', 'c', 'd'];
    const allTournaments = [];

    for (const tier of tiers) {
      console.log(`🏆 Starting finished tier ${tier.toUpperCase()} for all games...`);
      const gamePromises = ALL_GAMES.map(game => fetchFinishedTournamentsForGameAndTier(game, tier));
      const results = await Promise.allSettled(gamePromises);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allTournaments.push(...result.value);
        } else {
          console.error(`Failed finished ${ALL_GAMES[index]} tier ${tier}:`, result.reason);
        }
      });
    }

    // Sort by tier priority then by end date (most recent first)
    const tierPriority = { 's': 5, 'a': 4, 'b': 3, 'c': 2, 'd': 1 };
    allTournaments.sort((a, b) => {
      const tierDiff = tierPriority[b.tier] - tierPriority[a.tier];
      if (tierDiff !== 0) return tierDiff;

      const endDateA = new Date(a.end_at || a.begin_at);
      const endDateB = new Date(b.end_at || b.begin_at);
      return endDateB - endDateA; // Most recent first
    });

    console.log(`📚 FINAL FINISHED RESULT: ${allTournaments.length} total finished tournaments`);
    return allTournaments;

  } catch (error) {
    console.error('Error fetching all finished tournaments:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// ==================== ROUTES ARTICLES ====================

// Route pour récupérer tous les articles
fastify.get('/api/articles', async (_request, reply) => {
  try {
    console.log('📰 Fetching articles from Supabase');

    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching articles:', error);
      reply.code(500);
      return { error: 'Failed to fetch articles' };
    }

    console.log(`✅ Successfully fetched ${data.length} articles`);
    return data;
  } catch (error) {
    console.error('❌ Error in /api/articles:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Route pour récupérer un article par slug
fastify.get('/api/articles/:slug', async (request, reply) => {
  try {
    const { slug } = request.params;
    console.log(`📰 Fetching article with slug: ${slug}`);

    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`❌ Article not found with slug: ${slug}`);
        reply.code(404);
        return { error: 'Article not found' };
      }
      console.error('❌ Error fetching article:', error);
      reply.code(500);
      return { error: 'Failed to fetch article' };
    }

    console.log(`✅ Successfully fetched article: ${data.title}`);
    return data;
  } catch (error) {
    console.error('❌ Error in /api/articles/:slug:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Route pour incrémenter les vues d'un article
fastify.post('/api/articles/:slug/views', async (request, reply) => {
  try {
    const { slug } = request.params;
    console.log(`👁️ Incrementing views for article: ${slug}`);

    const { error } = await supabase.rpc('increment_article_views', {
      article_slug: slug
    });

    if (error) {
      console.error('❌ Error incrementing views:', error);
      reply.code(500);
      return { error: 'Failed to increment views' };
    }

    console.log(`✅ Successfully incremented views for article: ${slug}`);
    return { success: true, message: 'Views incremented successfully' };
  } catch (error) {
    console.error('❌ Error in /api/articles/:slug/views:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Route pour récupérer les articles similaires
fastify.get('/api/articles/:slug/similar', async (request, reply) => {
  try {
    const { slug } = request.params;
    const { limit = 3 } = request.query;
    console.log(`🔗 Fetching similar articles for: ${slug}`);

    // D'abord récupérer l'article courant pour obtenir ses tags
    const { data: currentArticle, error: currentError } = await supabase
      .from('articles')
      .select('tags')
      .eq('slug', slug)
      .single();

    if (currentError || !currentArticle) {
      console.log(`❌ Article not found with slug: ${slug}`);
      reply.code(404);
      return { error: 'Article not found' };
    }

    // Récupérer tous les autres articles
    const { data: allArticles, error: articlesError } = await supabase
      .from('articles')
      .select('*')
      .neq('slug', slug)
      .order('created_at', { ascending: false });

    if (articlesError) {
      console.error('❌ Error fetching articles:', articlesError);
      reply.code(500);
      return { error: 'Failed to fetch articles' };
    }

    // Calculer la similarité basée sur les tags
    const currentTags = currentArticle.tags || [];
    const articlesWithScore = allArticles
      .map(article => {
        const articleTags = article.tags || [];
        const commonTags = articleTags.filter(tag => currentTags.includes(tag));
        return {
          ...article,
          similarityScore: commonTags.length
        };
      })
      .filter(article => article.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, parseInt(limit));

    console.log(`✅ Found ${articlesWithScore.length} similar articles`);
    return articlesWithScore;
  } catch (error) {
    console.error('❌ Error in /api/articles/:slug/similar:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// Route pour récupérer les publicités
fastify.get('/api/ads', async (_request, reply) => {
  try {
    console.log('📢 Fetching advertisements from Supabase');

    const { data, error } = await supabase
      .from('ads')
      .select('*')
      .order('position', { ascending: true });

    if (error) {
      console.error('❌ Error fetching ads:', error);
      reply.code(500);
      return { error: 'Failed to fetch advertisements' };
    }

    // Filtrer les publicités valides (avec URL et redirect_link)
    const validAds = data?.filter(ad => ad.url && ad.redirect_link) || [];

    console.log(`✅ Successfully fetched ${validAds.length} valid advertisements`);
    return validAds;
  } catch (error) {
    console.error('❌ Error in /api/ads:', error);
    reply.code(500);
    return { error: 'Internal server error' };
  }
});

// ==================== ROUTES AUTHENTIFICATION ====================

// Middleware pour vérifier le token JWT
const verifyToken = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401);
      return reply.send({ error: 'Token manquant ou invalide' });
    }

    const token = authHeader.substring(7);

    // Vérifier le token avec Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      reply.code(401);
      return reply.send({ error: 'Token invalide ou expiré' });
    }

    // Ajouter l'utilisateur à la requête
    request.user = user;
  } catch (error) {
    console.error('❌ Error verifying token:', error);
    reply.code(500);
    return reply.send({ error: 'Erreur lors de la vérification du token' });
  }
};

// Route d'inscription
fastify.post('/api/auth/signup', async (request, reply) => {
  try {
    const { email, password, name } = request.body;

    if (!email || !password || !name) {
      reply.code(400);
      return { error: 'Email, mot de passe et nom sont requis' };
    }

    console.log(`📝 Creating new user: ${email}`);

    // Créer l'utilisateur avec Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.error('❌ Error creating auth user:', authError);
      reply.code(400);
      return { error: authError.message };
    }

    // Créer l'enregistrement dans la table users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        email,
        name,
        photo: null,
        photoUploaded: false,
        admin: false,
        favorite_team: null
      }])
      .select()
      .single();

    if (userError) {
      console.error('❌ Error creating user record:', userError);
      reply.code(500);
      return { error: 'Erreur lors de la création du profil utilisateur' };
    }

    console.log(`✅ User created successfully: ${email}`);

    return {
      authToken: authData.session?.access_token,
      user: userData
    };
  } catch (error) {
    console.error('❌ Error in /api/auth/signup:', error);
    reply.code(500);
    return { error: 'Erreur interne du serveur' };
  }
});

// Route de connexion
fastify.post('/api/auth/login', async (request, reply) => {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      reply.code(400);
      return { error: 'Email et mot de passe sont requis' };
    }

    console.log(`🔐 User login attempt: ${email}`);

    // Authentifier avec Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error('❌ Error authenticating user:', authError);
      reply.code(401);
      return { error: 'Email ou mot de passe incorrect' };
    }

    // Récupérer les données utilisateur depuis la table users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError) {
      console.error('❌ Error fetching user data:', userError);
      reply.code(500);
      return { error: 'Erreur lors de la récupération des données utilisateur' };
    }

    console.log(`✅ User logged in successfully: ${email}`);

    return {
      authToken: authData.session?.access_token,
      user: userData
    };
  } catch (error) {
    console.error('❌ Error in /api/auth/login:', error);
    reply.code(500);
    return { error: 'Erreur interne du serveur' };
  }
});

// Route pour récupérer les informations de l'utilisateur connecté
fastify.get('/api/auth/me', { preHandler: verifyToken }, async (request, reply) => {
  try {
    console.log(`👤 Fetching user data for: ${request.user.id}`);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', request.user.id)
      .single();

    if (error) {
      console.error('❌ Error fetching user:', error);
      reply.code(500);
      return { error: 'Erreur lors de la récupération des données utilisateur' };
    }

    console.log('✅ User data fetched successfully');
    return data;
  } catch (error) {
    console.error('❌ Error in /api/auth/me:', error);
    reply.code(500);
    return { error: 'Erreur interne du serveur' };
  }
});

// Route pour mettre à jour le profil utilisateur
fastify.post('/api/auth/me', { preHandler: verifyToken }, async (request, reply) => {
  try {
    const { name, email, password } = request.body;
    const userId = request.user.id;

    console.log(`📝 Updating user profile for: ${userId}`);

    const updates = {};

    if (name) updates.name = name;
    if (email) updates.email = email;

    // Mettre à jour l'email dans Supabase Auth si nécessaire
    if (email && email !== request.user.email) {
      const { error: authError } = await supabase.auth.updateUser({ email });
      if (authError) {
        console.error('❌ Error updating auth email:', authError);
        reply.code(400);
        return { error: authError.message };
      }
    }

    // Mettre à jour le mot de passe si fourni
    if (password) {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) {
        console.error('❌ Error updating password:', passwordError);
        reply.code(400);
        return { error: passwordError.message };
      }
    }

    // Mettre à jour la table users
    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating user:', error);
        reply.code(500);
        return { error: 'Erreur lors de la mise à jour du profil' };
      }

      console.log('✅ User profile updated successfully');
      return data;
    }

    // Si aucune mise à jour de la table users, retourner les données actuelles
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      reply.code(500);
      return { error: 'Erreur lors de la récupération des données' };
    }

    return data;
  } catch (error) {
    console.error('❌ Error in /api/auth/me (update):', error);
    reply.code(500);
    return { error: 'Erreur interne du serveur' };
  }
});

// Route pour uploader un avatar
fastify.post('/api/auth/avatar', { preHandler: verifyToken }, async (request, reply) => {
  try {
    const userId = request.user.id;
    console.log(`📸 Uploading avatar for user: ${userId}`);

    // Récupérer le fichier
    const data = await request.file();

    if (!data) {
      reply.code(400);
      return { error: 'Aucun fichier fourni' };
    }

    // Vérifier le type de fichier
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(data.mimetype)) {
      reply.code(400);
      return { error: 'Format de fichier non supporté. Utilisez JPG, PNG, GIF ou WebP.' };
    }

    // Convertir le stream en buffer
    const buffer = await data.toBuffer();

    // Générer un nom de fichier unique
    const fileExt = data.mimetype.split('/')[1];
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // Upload vers Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('users')
      .upload(filePath, buffer, {
        contentType: data.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Error uploading to storage:', uploadError);
      reply.code(500);
      return { error: 'Erreur lors de l\'upload de l\'image' };
    }

    // Obtenir l'URL publique
    const { data: publicUrlData } = supabase.storage
      .from('users')
      .getPublicUrl(filePath);

    const photoUrl = publicUrlData.publicUrl;

    // Mettre à jour la table users avec la nouvelle photo
    const { data: userData, error: updateError } = await supabase
      .from('users')
      .update({
        photo: photoUrl,
        photoUploaded: true
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating user photo:', updateError);
      reply.code(500);
      return { error: 'Erreur lors de la mise à jour du profil' };
    }

    console.log('✅ Avatar uploaded successfully');
    return {
      photo: {
        url: photoUrl
      },
      user: userData
    };
  } catch (error) {
    console.error('❌ Error in /api/auth/avatar:', error);
    reply.code(500);
    return { error: 'Erreur interne du serveur' };
  }
});

// Route pour supprimer un avatar
fastify.delete('/api/auth/avatar', { preHandler: verifyToken }, async (request, reply) => {
  try {
    const userId = request.user.id;
    console.log(`🗑️ Deleting avatar for user: ${userId}`);

    // Récupérer l'URL actuelle de la photo
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('photo')
      .eq('id', userId)
      .single();

    if (fetchError) {
      reply.code(500);
      return { error: 'Erreur lors de la récupération des données utilisateur' };
    }

    // Si l'utilisateur a une photo, la supprimer du storage
    if (currentUser.photo) {
      // Extraire le chemin du fichier depuis l'URL
      const photoPath = currentUser.photo.split('/').slice(-2).join('/');

      const { error: deleteError } = await supabase.storage
        .from('users')
        .remove([photoPath]);

      if (deleteError) {
        console.error('⚠️ Error deleting from storage:', deleteError);
        // Continue même si la suppression du fichier échoue
      }
    }

    // Mettre à jour la table users
    const { data: userData, error: updateError } = await supabase
      .from('users')
      .update({
        photo: null,
        photoUploaded: false
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating user:', updateError);
      reply.code(500);
      return { error: 'Erreur lors de la mise à jour du profil' };
    }

    console.log('✅ Avatar deleted successfully');
    return userData;
  } catch (error) {
    console.error('❌ Error in /api/auth/avatar (delete):', error);
    reply.code(500);
    return { error: 'Erreur interne du serveur' };
  }
});

// Export handler for Vercel
module.exports = async (req, res) => {
  await fastify.ready();
  fastify.server.emit('request', req, res);
};
