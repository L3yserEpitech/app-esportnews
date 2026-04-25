/**
 * Hosts allowed by next.config.ts -> images.remotePatterns.
 * Keep in sync.
 */
const ALLOWED_IMAGE_HOSTS = new Set<string>([
  'cdn.pandascore.co',
  'olybccviffjiqjmnsysn.supabase.co',
  'pub-aadef8fdc55f44388929f1cafa8d7293.r2.dev',
  'i.postimg.cc',
]);

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
