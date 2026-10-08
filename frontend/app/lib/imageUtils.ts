/**
 * Hosts allowed by next.config.ts -> images.remotePatterns.
 * Keep in sync.
 */
const R2_PUBLIC_HOST = 'pub-aadef8fdc55f44388929f1cafa8d7293.r2.dev';

// Custom domain fronting the R2 bucket (e.g. "images.esportnews.fr"). Set it
// once the Cloudflare custom domain is attached to the bucket; until then
// every URL keeps its stored r2.dev host.
const IMAGE_HOST = (process.env.NEXT_PUBLIC_IMAGE_HOST || '').trim();

const ALLOWED_IMAGE_HOSTS = new Set<string>([
  'olybccviffjiqjmnsysn.supabase.co',
  R2_PUBLIC_HOST,
  'i.postimg.cc',
  ...(IMAGE_HOST ? [IMAGE_HOST] : []),
]);

/**
 * Rewrites a stored R2 URL to the site's own image domain. Existing rows keep
 * their r2.dev URL in the database; the swap happens on the way out so no
 * data migration is needed.
 */
export function publicImageUrl<T extends string | null | undefined>(url: T): T {
  if (!IMAGE_HOST || !url) return url;
  return url.replace(`https://${R2_PUBLIC_HOST}/`, `https://${IMAGE_HOST}/`) as T;
}

/** Same swap applied to every URL inside an HTML body (inline article images). */
export function rewriteImageHosts<T extends string | null | undefined>(html: T): T {
  if (!IMAGE_HOST || !html) return html;
  return html.split(`https://${R2_PUBLIC_HOST}/`).join(`https://${IMAGE_HOST}/`) as T;
}

const VIDEO_EXT = /\.(mp4|webm|ogg|mov|avi)$/i;

export function isVideoUrl(url: string | null | undefined): boolean {
  return !!url && VIDEO_EXT.test(url);
}

/**
 * Returns true if the URL's host is configured under
 * next.config.ts -> images.remotePatterns and the URL can therefore be
 * rendered with next/image. Anything else (legacy uploads, foreign CDNs,
 * non-https URLs) must fall back to a plain <img> tag to avoid a
 * runtime "Invalid src prop" crash.
 */
export function canUseNextImage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_IMAGE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}
