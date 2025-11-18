/**
 * Test Setup Configuration
 *
 * Configure the test environment before running integration tests
 */

// Set test timeout to 30 seconds for API calls
jest.setTimeout(30000);

// Log test environment info
console.log('\n========================================');
console.log('Frontend Integration Test Suite');
console.log('========================================');
console.log(`Backend URL: ${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}`);
console.log('========================================\n');

// Custom test matcher for API responses
expect.extend({
  toBeValidPandaTournament(received) {
    const pass =
      typeof received.id === 'number' &&
      typeof received.name === 'string';

    return {
      pass,
      message: () =>
        pass
          ? `Expected tournament not to be a valid PandaTournament`
          : `Expected valid PandaTournament structure with id (number) and name (string)`,
    };
  },

  toBeValidPandaMatch(received) {
    const pass =
      typeof received.id === 'number' &&
      typeof received.name === 'string' &&
      (received.opponents === undefined || Array.isArray(received.opponents));

    return {
      pass,
      message: () =>
        pass
          ? `Expected match not to be a valid PandaMatch`
          : `Expected valid PandaMatch structure with id (number), name (string), and opponents (array|undefined)`,
    };
  },

  toBeValidPandaTeam(received) {
    const pass =
      typeof received.id === 'number' &&
      typeof received.name === 'string' &&
      typeof received.slug === 'string';

    return {
      pass,
      message: () =>
        pass
          ? `Expected team not to be a valid PandaTeam`
          : `Expected valid PandaTeam structure with id (number), name (string), and slug (string)`,
    };
  },
});

// Extend Jest matchers TypeScript definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidPandaTournament(): R;
      toBeValidPandaMatch(): R;
      toBeValidPandaTeam(): R;
    }
  }
}
