// One list for robots.txt (the polite ask) and middleware.ts (the 403 that
// applies at once). These crawlers either render JavaScript, so every page they
// visit replays all of its API calls against the backend's Liquipedia queue
// (Baidu and Meta were 60 % of backend GETs on 2026-10-27), or ignore
// robots.txt. facebookexternalhit is deliberately absent: it serves link
// previews. The backend mirrors this list in internal/middleware/botblock.go.
export const BLOCKED_CRAWLERS = ['Baiduspider', 'meta-externalagent', 'Bytespider', 'PetalBot', 'Amazonbot', 'GPTBot', 'CCBot'] as const;

const needles = BLOCKED_CRAWLERS.map((name) => name.toLowerCase());

export function isBlockedCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return needles.some((needle) => ua.includes(needle));
}

// Baidu's renderer fetches pages and the API with a browser-like user agent
// (observed 2026-10-28, 120 API calls/min from 116.179.37.x after the UA block),
// so its published crawler range is refused by address as well. Mirrored in
// the backend's blockedNetworks.
export const BLOCKED_CRAWLER_NETWORKS = ['116.179.32.0/20'] as const;

const networks = BLOCKED_CRAWLER_NETWORKS.map((cidr) => {
  const [base, bits] = cidr.split('/');
  const mask = bits === '0' ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return { base: (ipv4ToInt(base) & mask) >>> 0, mask };
});

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return -1;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return -1;
    value = (value << 8) | n;
  }
  return value >>> 0;
}

export function isBlockedCrawlerIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const value = ipv4ToInt(ip.trim());
  if (value < 0) return false;
  return networks.some(({ base, mask }) => ((value & mask) >>> 0) === base);
}
