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
