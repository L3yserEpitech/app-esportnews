'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Advertisement } from '@/app/types';
import { AD_SPOTS, DESKTOP_AD_QUERY, resolveAdSpot, type AdSpotKey, type RemoteAdSpots } from '@/app/lib/adSpots';
import { getAdSpots } from '@/app/services/adSpotService';
import AdBanner from './AdBanner';
import AdSenseUnit from './AdSenseUnit';

interface AdSpotProps {
  id: AdSpotKey;
  // Banners of the old `ads` table, used only while /api/ad-spots is not there.
  legacyAds?: Advertisement[];
  className?: string;
}

function subscribeToDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_AD_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

// null until hydration: the server cannot know the viewport.
function useIsDesktop(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribeToDesktop,
    () => window.matchMedia(DESKTOP_AD_QUERY).matches,
    () => null,
  );
}

// One ad placement. The back-office decides what it shows through
// GET /api/ad-spots: a custom banner, the AdSense unit, or nothing.
export default function AdSpot({ id, legacyAds, className = '' }: AdSpotProps) {
  const isDesktop = useIsDesktop();
  const [remote, setRemote] = useState<RemoteAdSpots | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getAdSpots().then((spots) => {
      if (!cancelled) setRemote(spots);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { viewport } = AD_SPOTS[id];
  if (isDesktop === null || remote === undefined) return null;
  if (viewport === 'desktop' && !isDesktop) return null;
  if (viewport === 'mobile' && isDesktop) return null;

  const spot = resolveAdSpot(id, remote, legacyAds);
  if (spot.mode === 'off') return null;

  return (
    <div className={`ad-spot flex justify-center ${className}`} data-ad-spot={id}>
      {spot.mode === 'custom' ? (
        <AdBanner creative={spot.creative} width={spot.width} height={spot.height} />
      ) : (
        // Keyed by slot: a new slot is a new <ins>, never a second push on a filled one.
        <AdSenseUnit key={spot.slot} slot={spot.slot} size={spot.size} />
      )}
    </div>
  );
}
