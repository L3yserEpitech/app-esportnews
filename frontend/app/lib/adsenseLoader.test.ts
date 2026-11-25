import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adSenseFailed, loadAdSense, resetAdSenseLoaderForTests, subscribeToAdSense } from './adsenseLoader';
import { ADSENSE_CLIENT } from './adSpots';

interface FakeScript {
  async?: boolean;
  src?: string;
  crossOrigin?: string;
  onload?: () => void;
  onerror?: () => void;
}

let appended: FakeScript[];

beforeEach(() => {
  appended = [];
  resetAdSenseLoaderForTests();
  vi.stubGlobal('document', {
    createElement: () => ({}) as FakeScript,
    head: { appendChild: (node: FakeScript) => appended.push(node) },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadAdSense', () => {
  it('adds the account script once, however often it is asked', () => {
    loadAdSense();
    loadAdSense();
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({
      async: true,
      crossOrigin: 'anonymous',
      src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`,
    });
  });

  it('reports a blocked script to the units waiting on it', () => {
    const listener = vi.fn();
    subscribeToAdSense(listener);
    loadAdSense();
    expect(adSenseFailed()).toBe(false);
    appended[0].onerror?.();
    expect(adSenseFailed()).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it('does not report a failure when the script loads', () => {
    loadAdSense();
    appended[0].onload?.();
    expect(adSenseFailed()).toBe(false);
  });

  it('stops notifying a unit that unsubscribed', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAdSense(listener);
    unsubscribe();
    loadAdSense();
    appended[0].onerror?.();
    expect(listener).not.toHaveBeenCalled();
  });
});
