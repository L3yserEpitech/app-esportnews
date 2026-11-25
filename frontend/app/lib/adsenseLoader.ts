import { ADSENSE_SCRIPT_SRC } from './adSpots';

// The AdSense script is added from the client, after hydration, and not
// rendered in <head>: as soon as it runs it inserts another <script> before the
// first script of the document. When that happened before hydration, React
// paired the stranger with the first inline script of the layout and reported a
// mismatch. The site is tied to the account by the meta tag and ads.txt, which
// do not need the script in the HTML.

type State = 'idle' | 'loading' | 'loaded' | 'failed';

let state: State = 'idle';
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function loadAdSense(): void {
  if (state !== 'idle') return;
  set('loading');
  const script = document.createElement('script');
  script.async = true;
  script.src = ADSENSE_SCRIPT_SRC;
  script.crossOrigin = 'anonymous';
  script.onload = () => set('loaded');
  // What an ad blocker does: no unit will ever be filled.
  script.onerror = () => set('failed');
  document.head.appendChild(script);
}

export function subscribeToAdSense(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function adSenseFailed(): boolean {
  return state === 'failed';
}

export function resetAdSenseLoaderForTests(): void {
  state = 'idle';
  listeners.clear();
}
