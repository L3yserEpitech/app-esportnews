'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

// False on the server and during hydration, true right after: for what the HTML
// cannot know, like today's date on a page prerendered at build time.
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

const SERVER_TIME_ZONE = 'Europe/Paris';

// The zone to format a date in. The server runs in UTC and the browser in the
// visitor's zone: both start from the same fixed zone so that hydration matches,
// then the browser switches to its own (undefined).
export function useDisplayTimeZone(): string | undefined {
  return useHydrated() ? undefined : SERVER_TIME_ZONE;
}
