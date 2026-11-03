import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackedPageView } from './PageViewTracker';

afterEach(() => vi.restoreAllMocks());

describe('trackedPageView', () => {
  it('sends the path alone, whatever the address holds', () => {
    expect(trackedPageView('/auth/login', 'https://www.esportnews.fr/auth/login?password=secret')).toEqual({
      path: '/auth/login',
      referer: 'https://www.esportnews.fr/auth/login',
    });
  });

  it('sends no referer when there is none', () => {
    expect(trackedPageView('/', '')).toEqual({ path: '/', referer: undefined });
  });
});
