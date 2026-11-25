import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openConsentSettings, whenConsentSettled } from './cookieConsent';

type Listener = (data: { eventStatus?: string; gdprApplies?: boolean }, success: boolean) => void;

let fakeWindow: Record<string, unknown>;

function installCmp(): { emit: Listener } {
  let listener: Listener | undefined;
  fakeWindow.__tcfapi = (_command: string, _version: number, callback: Listener) => {
    listener = callback;
  };
  return { emit: (data, success) => listener?.(data, success) };
}

beforeEach(() => {
  vi.useFakeTimers();
  fakeWindow = {};
  vi.stubGlobal('window', fakeWindow);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('whenConsentSettled', () => {
  it('settles after the wait when no consent platform ever loads', () => {
    const settled = vi.fn();
    whenConsentSettled(settled, 4000);
    vi.advanceTimersByTime(3999);
    expect(settled).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('settles at once for a visitor who had already answered', () => {
    const cmp = installCmp();
    const settled = vi.fn();
    whenConsentSettled(settled);
    cmp.emit({ eventStatus: 'tcloaded', gdprApplies: true }, true);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('settles at once where the GDPR does not apply', () => {
    const cmp = installCmp();
    const settled = vi.fn();
    whenConsentSettled(settled);
    cmp.emit({ gdprApplies: false }, true);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('waits for the answer while the message is on screen, past the timeout', () => {
    const cmp = installCmp();
    const settled = vi.fn();
    whenConsentSettled(settled, 4000);
    cmp.emit({ eventStatus: 'cmpuishown', gdprApplies: true }, true);
    vi.advanceTimersByTime(60_000);
    expect(settled).not.toHaveBeenCalled();
    cmp.emit({ eventStatus: 'useractioncomplete', gdprApplies: true }, true);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('picks up a consent platform that loads after the call', () => {
    const settled = vi.fn();
    whenConsentSettled(settled, 4000);
    vi.advanceTimersByTime(1000);
    const cmp = installCmp();
    vi.advanceTimersByTime(250);
    cmp.emit({ eventStatus: 'cmpuishown', gdprApplies: true }, true);
    vi.advanceTimersByTime(10_000);
    expect(settled).not.toHaveBeenCalled();
    cmp.emit({ eventStatus: 'useractioncomplete', gdprApplies: true }, true);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('settles only once, whatever follows', () => {
    const cmp = installCmp();
    const settled = vi.fn();
    whenConsentSettled(settled, 4000);
    cmp.emit({ eventStatus: 'tcloaded', gdprApplies: true }, true);
    cmp.emit({ eventStatus: 'useractioncomplete', gdprApplies: true }, true);
    vi.advanceTimersByTime(10_000);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('ignores a failed event and still gives up after the wait', () => {
    const cmp = installCmp();
    const settled = vi.fn();
    whenConsentSettled(settled, 4000);
    cmp.emit({ eventStatus: 'tcloaded' }, false);
    expect(settled).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('never settles once cancelled', () => {
    const cmp = installCmp();
    const settled = vi.fn();
    const cancel = whenConsentSettled(settled, 4000);
    cancel();
    cmp.emit({ eventStatus: 'tcloaded', gdprApplies: true }, true);
    vi.advanceTimersByTime(10_000);
    expect(settled).not.toHaveBeenCalled();
  });
});

describe('openConsentSettings', () => {
  it('queues the revocation message when the consent platform is there', () => {
    const showRevocationMessage = () => {};
    const callbackQueue: unknown[] = [];
    fakeWindow.googlefc = { callbackQueue, showRevocationMessage };
    expect(openConsentSettings()).toBe(true);
    expect(callbackQueue).toEqual([showRevocationMessage]);
  });

  it('reports that nothing can be opened without it', () => {
    expect(openConsentSettings()).toBe(false);
    fakeWindow.googlefc = { callbackQueue: [] };
    expect(openConsentSettings()).toBe(false);
  });
});
