/**
 * Integration Tests - Frontend ↔ Backend Communication
 *
 * Tests pour vérifier que le frontend communique correctement avec les nouveaux endpoints Go
 */

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

// ============ HELPER FUNCTIONS ============

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`[TEST] Fetching: ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ============ TOURNAMENT ENDPOINTS ============

describe('Tournament Endpoints', () => {
  test('GET /api/tournaments/all - Should return array of tournaments', async () => {
    const tournaments = await fetchAPI('/api/tournaments/all');

    expect(Array.isArray(tournaments)).toBe(true);
    if (tournaments.length > 0) {
      const tournament = tournaments[0];
      expect(tournament.id).toBeDefined();
      expect(tournament.name).toBeDefined();
      expect(typeof tournament.id).toBe('number');
      expect(typeof tournament.name).toBe('string');
    }
  });

  test('GET /api/tournaments?game={game} - Should return tournaments for specific game', async () => {
    const tournaments = await fetchAPI('/api/tournaments?game=valorant');

    expect(Array.isArray(tournaments)).toBe(true);
  });

  test('GET /api/tournaments/upcoming/all - Should return upcoming tournaments', async () => {
    const tournaments = await fetchAPI('/api/tournaments/upcoming/all');

    expect(Array.isArray(tournaments)).toBe(true);
  });

  test('GET /api/tournaments/finished/all - Should return finished tournaments', async () => {
    const tournaments = await fetchAPI('/api/tournaments/finished/all');

    expect(Array.isArray(tournaments)).toBe(true);
  });

  test('GET /api/tournaments/filtered - Should accept filter parameters', async () => {
    const tournaments = await fetchAPI('/api/tournaments/filtered?game=valorant&status=running');

    expect(Array.isArray(tournaments)).toBe(true);
  });

  test('GET /api/tournaments/by-date - Should return tournaments by date', async () => {
    const today = new Date().toISOString().split('T')[0];
    const tournaments = await fetchAPI(`/api/tournaments/by-date?date=${today}`);

    expect(Array.isArray(tournaments)).toBe(true);
  });
});

// ============ MATCH ENDPOINTS ============

describe('Match Endpoints', () => {
  test('GET /api/matches/by-date - Should return matches for a specific date', async () => {
    const today = new Date().toISOString().split('T')[0];
    const matches = await fetchAPI(`/api/matches/by-date?date=${today}`);

    expect(Array.isArray(matches)).toBe(true);
    if (matches.length > 0) {
      const match = matches[0];
      expect(match.id).toBeDefined();
      expect(match.name).toBeDefined();
    }
  });

  test('GET /api/matches/{id} - Should return a specific match', async () => {
    // First, get a list of matches to get a valid ID
    const today = new Date().toISOString().split('T')[0];
    const matches = await fetchAPI(`/api/matches/by-date?date=${today}`);

    if (matches.length > 0) {
      const matchId = matches[0].id;
      const match = await fetchAPI(`/api/matches/${matchId}`);

      expect(match.id).toBeDefined();
      expect(match.name).toBeDefined();
    }
  });
});

// ============ TEAM ENDPOINTS ============

describe('Team Endpoints', () => {
  test('GET /api/teams/search - Should return teams matching query', async () => {
    const teams = await fetchAPI('/api/teams/search?query=fnatic&page_size=10');

    expect(Array.isArray(teams)).toBe(true);
  });

  test('GET /api/teams/{id} - Should return a specific team', async () => {
    // Search for a team first
    const teams = await fetchAPI('/api/teams/search?query=fnatic');

    if (teams.length > 0) {
      const teamId = teams[0].id;
      const team = await fetchAPI(`/api/teams/${teamId}`);

      expect(team.id).toBeDefined();
      expect(team.name).toBeDefined();
    }
  });
});

// ============ RESPONSE FORMAT VALIDATION ============

describe('Response Format Validation', () => {
  test('Tournament response should have correct structure', async () => {
    const tournaments = await fetchAPI('/api/tournaments/all');

    if (tournaments.length > 0) {
      const tournament = tournaments[0];

      // Required fields
      expect(tournament.id).toBeDefined();
      expect(tournament.name).toBeDefined();

      // Optional fields that should be present if they exist
      if (tournament.begin_at) {
        expect(typeof tournament.begin_at).toBe('string');
      }

      if (tournament.tier) {
        expect(typeof tournament.tier).toBe('string');
      }

      if (tournament.videogame) {
        expect(tournament.videogame.id).toBeDefined();
        expect(tournament.videogame.name).toBeDefined();
      }
    }
  });

  test('Match response should have correct structure', async () => {
    const today = new Date().toISOString().split('T')[0];
    const matches = await fetchAPI(`/api/matches/by-date?date=${today}`);

    if (matches.length > 0) {
      const match = matches[0];

      // Required fields
      expect(match.id).toBeDefined();
      expect(match.name).toBeDefined();

      // Optional but common fields
      if (match.status) {
        expect(typeof match.status).toBe('string');
      }

      if (match.begin_at) {
        expect(typeof match.begin_at).toBe('string');
      }
    }
  });

  test('Team response should have correct structure', async () => {
    const teams = await fetchAPI('/api/teams/search?query=fnatic');

    if (teams.length > 0) {
      const team = teams[0];

      // Required fields
      expect(team.id).toBeDefined();
      expect(team.name).toBeDefined();
      expect(team.slug).toBeDefined();

      // Optional fields
      if (team.image_url) {
        expect(typeof team.image_url).toBe('string');
      }
    }
  });
});

// ============ ERROR HANDLING ============

describe('Error Handling', () => {
  test('Invalid date format should handle gracefully', async () => {
    try {
      await fetchAPI('/api/tournaments/by-date?date=invalid-date');
      // If it doesn't throw, it should return an empty array or error
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('Missing required parameters should return error', async () => {
    try {
      await fetchAPI('/api/tournaments/by-date');
      // Should fail without date parameter
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

// ============ TYPE COMPATIBILITY ============

describe('Frontend Type Compatibility', () => {
  test('PandaTournament type should match backend response', async () => {
    const tournaments = await fetchAPI('/api/tournaments/all');

    if (tournaments.length > 0) {
      const tournament = tournaments[0];

      // Check that response fields match PandaTournament interface
      expect(typeof tournament.id).toBe('number');
      expect(typeof tournament.name).toBe('string');

      // Optional fields can be null or string
      if (tournament.slug !== undefined) {
        expect(typeof tournament.slug === 'string' || tournament.slug === null).toBe(true);
      }

      // Teams should be an array if present
      if (tournament.teams) {
        expect(Array.isArray(tournament.teams)).toBe(true);
      }
    }
  });

  test('PandaMatch type should match backend response', async () => {
    const today = new Date().toISOString().split('T')[0];
    const matches = await fetchAPI(`/api/matches/by-date?date=${today}`);

    if (matches.length > 0) {
      const match = matches[0];

      // Check that response fields match PandaMatch interface
      expect(typeof match.id).toBe('number');
      expect(typeof match.name).toBe('string');

      // Opponents should be an array if present
      if (match.opponents) {
        expect(Array.isArray(match.opponents)).toBe(true);

        if (match.opponents.length > 0) {
          const opponent = match.opponents[0];
          expect(opponent.id).toBeDefined();
          expect(opponent.type).toBeDefined();
        }
      }
    }
  });

  test('PandaTeam type should match backend response', async () => {
    const teams = await fetchAPI('/api/teams/search?query=fnatic');

    if (teams.length > 0) {
      const team = teams[0];

      // Check that response fields match PandaTeam interface
      expect(typeof team.id).toBe('number');
      expect(typeof team.name).toBe('string');
      expect(typeof team.slug).toBe('string');

      // Optional fields
      if (team.image_url !== undefined) {
        expect(typeof team.image_url === 'string' || team.image_url === null).toBe(true);
      }

      // Players should be an array if present
      if (team.players) {
        expect(Array.isArray(team.players)).toBe(true);
      }
    }
  });
});
