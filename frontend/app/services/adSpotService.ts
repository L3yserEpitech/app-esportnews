import type { RemoteAdSpots } from '../lib/adSpots';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { spots: RemoteAdSpots | null; at: number } | null = null;
let inflight: Promise<RemoteAdSpots | null> | null = null;

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

async function fetchAdSpots(): Promise<RemoteAdSpots | null> {
  try {
    const response = await fetch(`${baseUrl}/api/ad-spots`);
    if (!response.ok) return null;
    const data = await response.json();
    const spots = data?.spots;
    return spots && typeof spots === 'object' && !Array.isArray(spots) ? (spots as RemoteAdSpots) : null;
  } catch {
    return null;
  }
}

// null = the endpoint did not answer. That answer is cached too, so a backend
// without the route is asked once every five minutes and not once per page.
export function getAdSpots(): Promise<RemoteAdSpots | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return Promise.resolve(cached.spots);
  if (!inflight) {
    inflight = fetchAdSpots()
      .then((spots) => {
        cached = { spots, at: Date.now() };
        return spots;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
