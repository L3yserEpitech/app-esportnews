import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRefreshFailure } from './sessionRefresh.ts';

const httpError = (status: number) => ({ response: { status } });

test('a 401 from /auth/refresh means the session is over', () => {
  assert.equal(classifyRefreshFailure(httpError(401)), 'rejected');
});

test('a 400 (malformed token) also ends the session', () => {
  assert.equal(classifyRefreshFailure(httpError(400)), 'rejected');
});

test('a backend outage keeps the session', () => {
  assert.equal(classifyRefreshFailure(httpError(503)), 'unavailable');
  assert.equal(classifyRefreshFailure(httpError(502)), 'unavailable');
});

test('rate limiting keeps the session', () => {
  assert.equal(classifyRefreshFailure(httpError(429)), 'unavailable');
});

test('no network keeps the session', () => {
  assert.equal(classifyRefreshFailure({ message: 'Network Error' }), 'unavailable');
  assert.equal(classifyRefreshFailure({ code: 'ECONNABORTED' }), 'unavailable');
});

test('anything that is not an HTTP refusal keeps the session', () => {
  assert.equal(classifyRefreshFailure(undefined), 'unavailable');
  assert.equal(classifyRefreshFailure(new Error('boom')), 'unavailable');
});
