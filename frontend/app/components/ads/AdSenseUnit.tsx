'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ADSENSE_CLIENT } from '@/app/lib/adSpots';
import { adSenseFailed, loadAdSense, subscribeToAdSense } from '@/app/lib/adsenseLoader';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSenseUnitProps {
  slot: string;
  // Fixed size, or null for a responsive unit that fills its container.
  size: { width: number; height: number } | null;
}

type FillStatus = 'pending' | 'filled' | 'unfilled';

const FILLED_KEY = 'esportnews_ad_filled:';
const RESERVE_GIVE_UP_MS = 8000;

function wasFilledLastTime(slot: string): boolean {
  try {
    return localStorage.getItem(FILLED_KEY + slot) === '1';
  } catch {
    return false;
  }
}

function rememberFill(slot: string, filled: boolean) {
  try {
    if (filled) localStorage.setItem(FILLED_KEY + slot, '1');
    else localStorage.removeItem(FILLED_KEY + slot);
  } catch {}
}

// One AdSense unit. Rendered on the client only (AdSpot waits for hydration).
//
// The <ins> must have a width when it is pushed (a display:none one has none
// and AdSense throws), and be pushed once: a second push on a filled <ins>
// throws too, which is what React's double effect in development would do.
//
// The box stays closed until AdSense reports the unit as filled: an account
// under review, or a request with no ad, would otherwise leave a hole in the
// page, and AdSense does not always say "unfilled". A unit that was filled on
// its last display keeps its place from the start, so a returning visitor sees
// no layout shift.
export default function AdSenseUnit({ slot, size }: AdSenseUnitProps) {
  const ins = useRef<HTMLModElement>(null);
  const failed = useSyncExternalStore(subscribeToAdSense, adSenseFailed, () => false);
  const [status, setStatus] = useState<FillStatus>('pending');
  const [reserved, setReserved] = useState(() => wasFilledLastTime(slot));

  useEffect(() => {
    const element = ins.current;
    if (!element) return;

    const read = () => {
      const value = element.dataset.adStatus;
      if (value !== 'filled' && value !== 'unfilled') return;
      setStatus(value);
      rememberFill(slot, value === 'filled');
    };
    const observer = new MutationObserver(read);
    observer.observe(element, { attributes: true, attributeFilter: ['data-ad-status'] });
    read();

    if (!element.dataset.adsbygoogleStatus && !element.dataset.requested) {
      element.dataset.requested = '1';
      loadAdSense();
      try {
        // Queued until the script runs when it is not there yet.
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // Refused: the unit stays closed.
      }
    }

    const giveUp = setTimeout(() => {
      if (!element.dataset.adStatus) {
        setReserved(false);
        rememberFill(slot, false);
      }
    }, RESERVE_GIVE_UP_MS);

    return () => {
      observer.disconnect();
      clearTimeout(giveUp);
    };
  }, [slot]);

  // Blocked script: nothing will ever fill the unit.
  if (failed) return null;

  const closed = status === 'pending' && !reserved;

  return (
    <div
      className="ad-slot"
      data-collapsed={closed ? '' : undefined}
      data-unfilled={status === 'unfilled' ? '' : undefined}
      style={{
        // A responsive unit takes the width of its box: without one, the centred
        // wrapper shrinks it to nothing and AdSense has no room to fill.
        width: size ? size.width : '100%',
        minHeight: status === 'pending' && reserved ? (size?.height ?? 250) : undefined,
      }}
    >
      <ins
        ref={ins}
        className="adsbygoogle"
        style={size ? { display: 'inline-block', width: size.width, height: size.height } : { display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        {...(size ? {} : { 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' })}
        {...(process.env.NODE_ENV === 'production' ? {} : { 'data-adtest': 'on' })}
      />
    </div>
  );
}
