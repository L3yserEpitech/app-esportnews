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
