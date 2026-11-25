import type { Advertisement } from '../types';

export const ADSENSE_CLIENT = 'ca-pub-4019532498018851';
export const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

export type AdSpotKey = 'sidebar-1' | 'sidebar-2' | 'sidebar-3' | 'article-bottom' | 'mobile-1';

export interface AdSpotDefinition {
  // The AdSense unit served when the back-office has not set another one.
  adsenseSlot: string;
  // Fixed AdSense size, or null for a responsive unit sized by its container.
  adsenseSize: { width: number; height: number } | null;
  // Box of a custom creative when the back-office gives no format.
  customFormat: string;
  // The right column is hidden below lg and the mobile unit above it: a unit
  // pushed into a hidden container gets no size and AdSense throws.
  viewport: 'desktop' | 'mobile' | 'all';
}

// Slot ids are the units created in the AdSense account (Annonces > Par bloc
// d'annonces), named esportnews-<key>.
export const AD_SPOTS: Record<AdSpotKey, AdSpotDefinition> = {
  'sidebar-1': { adsenseSlot: '4410076654', adsenseSize: { width: 300, height: 250 }, customFormat: '300x400', viewport: 'desktop' },
  'sidebar-2': { adsenseSlot: '2003405164', adsenseSize: { width: 300, height: 250 }, customFormat: '300x400', viewport: 'desktop' },
  'sidebar-3': { adsenseSlot: '1783913314', adsenseSize: { width: 300, height: 250 }, customFormat: '300x400', viewport: 'desktop' },
  'article-bottom': { adsenseSlot: '9690323498', adsenseSize: null, customFormat: '728x90', viewport: 'all' },
  'mobile-1': { adsenseSlot: '9470831648', adsenseSize: null, customFormat: '320x100', viewport: 'mobile' },
};

export const DESKTOP_AD_QUERY = '(min-width: 1024px)';

export interface AdSpotCreative {
  media_url: string;
  media_type: 'image' | 'video';
  redirect_link: string;
  title: string | null;
}

// One entry of GET /api/ad-spots.
export interface RemoteAdSpot {
  mode: 'adsense' | 'custom' | 'off';
  format?: string | null;
  adsense_slot?: string | null;
  creative?: Partial<AdSpotCreative> | null;
}

export type RemoteAdSpots = Record<string, RemoteAdSpot>;

export type ResolvedAdSpot =
  | { mode: 'off' }
  | { mode: 'adsense'; slot: string; size: { width: number; height: number } | null }
  | { mode: 'custom'; creative: AdSpotCreative; width: number; height: number };

export function parseFormat(format: string | null | undefined): { width: number; height: number } | null {
  const match = /^(\d{2,4})x(\d{2,4})$/.exec((format ?? '').trim());
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

function customSpot(key: AdSpotKey, creative: Partial<AdSpotCreative> | null | undefined, format?: string | null): ResolvedAdSpot | null {
  if (!creative?.media_url || !creative.redirect_link) return null;
  const box = parseFormat(format) ?? parseFormat(AD_SPOTS[key].customFormat)!;
  return {
    mode: 'custom',
    creative: {
      media_url: creative.media_url,
      media_type: creative.media_type === 'video' ? 'video' : 'image',
      redirect_link: creative.redirect_link,
      title: creative.title ?? null,
    },
    ...box,
  };
}

// `remote` is the answer of GET /api/ad-spots, or null when the endpoint did
// not answer (not deployed yet, backend down). In that case the banners of the
// old `ads` table keep their positions in the right column, and everything else
// is AdSense: the site never depends on a back-office row to show an ad.
export function resolveAdSpot(key: AdSpotKey, remote: RemoteAdSpots | null, legacyAds: Advertisement[] = []): ResolvedAdSpot {
  const definition = AD_SPOTS[key];
  const adsense: ResolvedAdSpot = { mode: 'adsense', slot: definition.adsenseSlot, size: definition.adsenseSize };

  if (remote === null) {
    const position = /^sidebar-(\d)$/.exec(key)?.[1];
    const legacy = position ? legacyAds.find((ad) => ad.position === Number(position)) : undefined;
    if (!legacy) return adsense;
    return (
      customSpot(key, {
        media_url: legacy.url ?? undefined,
        media_type: legacy.type === 'video' ? 'video' : 'image',
        redirect_link: legacy.redirect_link ?? undefined,
        title: legacy.title,
      }) ?? adsense
    );
  }

  const spot = remote[key];
  if (!spot) return adsense;
  if (spot.mode === 'off') return { mode: 'off' };
  const withSlot: ResolvedAdSpot = { ...adsense, slot: spot.adsense_slot?.trim() || definition.adsenseSlot };
  if (spot.mode === 'custom') return customSpot(key, spot.creative, spot.format) ?? withSlot;
  return withSlot;
}
