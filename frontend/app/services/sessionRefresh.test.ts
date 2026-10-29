import { describe, expect, it } from 'vitest';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  refreshStoredSession,
  type TokenStore,
} from './sessionRefresh';

function memoryStore(initial: Record<string, string> = {}): TokenStore {
  const data = new Map(Object.entries(initial));
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('refreshStoredSession', () => {
  it('renews both tokens from the stored refresh token', async () => {
    const store = memoryStore({ [REFRESH_TOKEN_KEY]: 'old-refresh' });
    const bodies: unknown[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return json(200, { access_token: 'new-access', refresh_token: 'new-refresh' });
    };

    await expect(refreshStoredSession('https://api.test', store, fetchImpl)).resolves.toBe('renewed');
    expect(store.get(ACCESS_TOKEN_KEY)).toBe('new-access');
    expect(store.get(REFRESH_TOKEN_KEY)).toBe('new-refresh');
    expect(bodies).toEqual([{ refresh_token: 'old-refresh' }]);
  });

  it('is over when nothing is stored, without calling the backend', async () => {
    const store = memoryStore({ [ACCESS_TOKEN_KEY]: 'stale' });
    const fetchImpl: typeof fetch = async () => {
      throw new Error('must not be called');
    };

    await expect(refreshStoredSession('https://api.test', store, fetchImpl)).resolves.toBe('rejected');
    expect(store.get(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('ends the session and clears both tokens on a 401', async () => {
    const store = memoryStore({ [ACCESS_TOKEN_KEY]: 'stale', [REFRESH_TOKEN_KEY]: 'revoked' });
    const fetchImpl: typeof fetch = async () => json(401, { message: 'Invalid refresh token' });

    await expect(refreshStoredSession('https://api.test', store, fetchImpl)).resolves.toBe('rejected');
    expect(store.get(ACCESS_TOKEN_KEY)).toBeNull();
    expect(store.get(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('keeps the tokens when the backend is down', async () => {
    const store = memoryStore({ [ACCESS_TOKEN_KEY]: 'stale', [REFRESH_TOKEN_KEY]: 'still-good' });
    const fetchImpl: typeof fetch = async () => json(503, {});

    await expect(refreshStoredSession('https://api.test', store, fetchImpl)).resolves.toBe('unavailable');
    expect(store.get(REFRESH_TOKEN_KEY)).toBe('still-good');
  });

  it('keeps the tokens when the network fails', async () => {
    const store = memoryStore({ [REFRESH_TOKEN_KEY]: 'still-good' });
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    await expect(refreshStoredSession('https://api.test', store, fetchImpl)).resolves.toBe('unavailable');
    expect(store.get(REFRESH_TOKEN_KEY)).toBe('still-good');
  });
});
