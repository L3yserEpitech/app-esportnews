'use client';
import { useEffect } from 'react';

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1500, 4000, 8000];

/**
 * The backend image proxy answers with a 1×1 transparent placeholder (HTTP 200)
 * when the upstream fetch fails, so the browser never retries on its own and
 * logos stay invisible until a manual refresh. This global capture-phase
 * listener detects those placeholders as they "load" and re-requests them with
 * a backoff — by then the proxy cache is usually warm and the real image shows
 * up without a refresh.
 */
export default function ProxyImageRetry() {
  useEffect(() => {
    const retry = (img: HTMLImageElement) => {
      const attempts = Number(img.dataset.proxyRetries || '0');
      if (attempts >= MAX_RETRIES) return;
      img.dataset.proxyRetries = String(attempts + 1);
      const src = img.src;
      setTimeout(() => {
        if (!img.isConnected) return;
        const sep = src.includes('?') ? '&' : '?';
        img.src = `${src.split(/[?&]retry=/)[0]}${sep}retry=${attempts + 1}`;
      }, RETRY_DELAYS_MS[attempts]);
    };

    const onLoad = (e: Event) => {
      const img = e.target as HTMLImageElement;
      if (img?.tagName !== 'IMG' || !img.src.includes('/api/proxy/image')) return;
      if (img.naturalWidth <= 1 && img.naturalHeight <= 1) retry(img);
    };
    const onError = (e: Event) => {
      const img = e.target as HTMLImageElement;
      if (img?.tagName !== 'IMG' || !img.src.includes('/api/proxy/image')) return;
      retry(img);
    };

    document.addEventListener('load', onLoad, true);
    document.addEventListener('error', onError, true);
    return () => {
      document.removeEventListener('load', onLoad, true);
      document.removeEventListener('error', onError, true);
    };
  }, []);

  return null;
}
