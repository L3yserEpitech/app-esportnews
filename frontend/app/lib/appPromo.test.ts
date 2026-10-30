import { describe, it, expect } from 'vitest';
import { isAppPromoPath, shouldShowAppPromo, storeUrlForUserAgent, APP_STORE_URL, PLAY_STORE_URL } from './appPromo';

describe('shouldShowAppPromo', () => {
  it('shows once per visit on public pages', () => {
    expect(shouldShowAppPromo('/', null)).toBe(true);
    expect(shouldShowAppPromo('/match/abc', null)).toBe(true);
    expect(shouldShowAppPromo('/', '1')).toBe(false);
  });

  it('stays out of the back-office and the login flow', () => {
    expect(shouldShowAppPromo('/admin', null)).toBe(false);
    expect(shouldShowAppPromo('/admin/articles/12', null)).toBe(false);
    expect(shouldShowAppPromo('/auth/login', null)).toBe(false);
  });
});

describe('isAppPromoPath', () => {
  it('covers public pages only', () => {
    expect(isAppPromoPath('/')).toBe(true);
    expect(isAppPromoPath('/article/foo/28-10-2026')).toBe(true);
    expect(isAppPromoPath('/admin/ads')).toBe(false);
    expect(isAppPromoPath('/auth/signup')).toBe(false);
  });
});

describe('storeUrlForUserAgent', () => {
  it('sends Android to Google Play', () => {
    expect(storeUrlForUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe(PLAY_STORE_URL);
  });

  it('sends iPhone, iPad and everyone else to the App Store', () => {
    expect(storeUrlForUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')).toBe(APP_STORE_URL);
    expect(storeUrlForUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15')).toBe(APP_STORE_URL);
    expect(storeUrlForUserAgent(null)).toBe(APP_STORE_URL);
  });
});
