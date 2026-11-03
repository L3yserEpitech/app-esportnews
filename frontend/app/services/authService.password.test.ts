import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, authService } from './authService';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const pair = { message: 'Password changed successfully', access_token: 'new-access', refresh_token: 'new-refresh', user: { id: 1 } };

let stored: Map<string, string>;
let calls: { url: string; auth: string | null; body: any }[];

function respondWith(...responses: Response[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      auth: new Headers(init?.headers).get('Authorization'),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return responses.shift() ?? json(500, {});
  }));
}

beforeEach(() => {
  stored = new Map([['authToken', 'old-access'], ['refreshToken', 'old-refresh']]);
  calls = [];
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
    removeItem: (key: string) => void stored.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('authService.changePassword', () => {
  it('calls the real route and keeps the pair it gets back', async () => {
    respondWith(json(200, pair));
    await authService.changePassword('current-pass', 'next-pass-123');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/auth\/change-password$/);
    expect(calls[0].auth).toBe('Bearer old-access');
    expect(calls[0].body).toEqual({ current_password: 'current-pass', new_password: 'next-pass-123' });
    expect(stored.get('authToken')).toBe('new-access');
    expect(stored.get('refreshToken')).toBe('new-refresh');
  });

  it('reports a wrong current password as a 401 and touches nothing', async () => {
    respondWith(json(401, { message: 'current password is incorrect' }));
    const error = await authService.changePassword('wrong', 'next-pass-123').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(calls).toHaveLength(1);
    expect(stored.get('authToken')).toBe('old-access');
  });

  it('renews an expired access token once, then retries', async () => {
    respondWith(
      json(401, { message: 'Invalid token' }),
      json(200, { access_token: 'renewed-access', refresh_token: 'renewed-refresh' }),
      json(200, pair),
    );
    await authService.changePassword('current-pass', 'next-pass-123');

    expect(calls.map((c) => c.url.replace(/^.*\/api/, ''))).toEqual(['/auth/change-password', '/auth/refresh', '/auth/change-password']);
    expect(calls[2].auth).toBe('Bearer renewed-access');
    expect(stored.get('authToken')).toBe('new-access');
  });

  it('surfaces an outage without touching the session', async () => {
    respondWith(json(503, { message: 'Session store unavailable' }));
    const error = await authService.changePassword('current-pass', 'next-pass-123').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(503);
    expect(stored.get('authToken')).toBe('old-access');
    expect(stored.get('refreshToken')).toBe('old-refresh');
  });
});

describe('authService.login', () => {
  it('does not call an outage a wrong password', async () => {
    respondWith(json(503, { message: 'Service temporarily unavailable' }));
    const error = await authService.login({ email: 'a@b.c', password: 'x' }).catch((e) => e);
    expect(error.message).not.toMatch(/incorrect/i);
  });

  it('still says so for a wrong password', async () => {
    respondWith(json(401, { message: 'invalid email or password' }));
    const error = await authService.login({ email: 'a@b.c', password: 'x' }).catch((e) => e);
    expect(error.message).toMatch(/incorrect/i);
  });
});
