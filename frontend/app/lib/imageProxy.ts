/**
 * Proxies Liquipedia image URLs through the backend to avoid hotlink blocking.
 * Non-Liquipedia URLs are returned as-is.
 */
export function proxyImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (!url.includes('liquipedia.net')) return url;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  return `${backendUrl}/api/proxy/image?url=${encodeURIComponent(url)}`;
}

/**
 * Fire-and-forget: ask the backend to fetch a batch of Liquipedia image URLs
 * into its (Redis-backed) cache in parallel, so the browser's subsequent <img>
 * requests are instant cache hits instead of cold fetches. Client-only.
 */
export function prewarmImages(urls: Array<string | null | undefined>): void {
  if (typeof window === 'undefined') return;
  const liq = Array.from(
    new Set(urls.filter((u): u is string => !!u && u.includes('liquipedia.net')))
  );
  if (liq.length === 0) return;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  fetch(`${backendUrl}/api/proxy/prewarm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: liq }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Recursively collects every Liquipedia image URL found anywhere in a data
 * payload (matches, teams, tournaments, placements, rosters…), regardless of
 * shape. Iterative + capped so it stays cheap even on large payloads.
 */
export function collectLiquipediaUrls(data: unknown, cap = 400): string[] {
  const out = new Set<string>();
  const stack: unknown[] = [data];
  while (stack.length > 0 && out.size < cap) {
    const cur = stack.pop();
    if (cur == null) continue;
    if (typeof cur === 'string') {
      if (cur.includes('liquipedia.net')) out.add(cur);
    } else if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
    } else if (typeof cur === 'object') {
      for (const v of Object.values(cur as Record<string, unknown>)) stack.push(v);
    }
  }
  return Array.from(out);
}

/** Warm every Liquipedia image found in a data payload, whatever its shape. */
export function prewarmFromData(data: unknown): void {
  prewarmImages(collectLiquipediaUrls(data));
}

/** Extracts opponent (light + dark) and league logo URLs from a match list. */
export function matchLogoUrls(matches: any[] | null | undefined): string[] {
  if (!Array.isArray(matches)) return [];
  const out: string[] = [];
  for (const m of matches) {
    for (const o of m?.opponents ?? []) {
      if (o?.opponent?.image_url) out.push(o.opponent.image_url);
      if (o?.opponent?.dark_image_url) out.push(o.opponent.dark_image_url);
    }
    if (m?.league?.image_url) out.push(m.league.image_url);
  }
  return out;
}
