import { expect, vi } from 'vitest';

export const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36';
export const GOOGLEBOT = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) Chrome/153 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

export function stubBackend(respond: (url: string) => Response) {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(String(url));
    return respond(String(url));
  });
  return urls;
}

export const notFoundDigest = expect.objectContaining({ digest: expect.stringContaining('404') });
