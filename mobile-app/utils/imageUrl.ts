import { BACKEND_URL } from '@/services/apiClient';

// Single chokepoint for every remote image the app renders (team logos,
// tournament banners, game CDN assets). Default 'direct': each device loads the
// URL itself — distributed residential/mobile traffic, so no server-IP ban risk
// from Liquipedia media (unlike our poller/proxy). Flip to 'proxy' from here ONLY
// once Liquipedia's API media method is confirmed; then liquipedia.net media
// routes through the backend proxy from this one place.
const IMAGE_MODE: 'direct' | 'proxy' = 'direct';

function normalize(raw?: string | null): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`;
  return url;
}

function isLiquipediaMedia(url: string): boolean {
  return url.includes('liquipedia.net/commons');
}

export function imageUrl(raw?: string | null): string | null {
  const url = normalize(raw);
  if (!url) return null;
  if (IMAGE_MODE === 'proxy' && isLiquipediaMedia(url)) {
    return `${BACKEND_URL}/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}
