export const APP_STORE_URL = 'https://apps.apple.com/app/id6758380570';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.esportnewsapp.mobile';

export const APP_PROMO_SEEN_KEY = 'esportnews_app_promo_seen';
// Also read by the pre-paint script in app/layout.tsx.
export const APP_BANNER_CLOSED_KEY = 'esportnews_app_banner_closed';

// Neither the back-office nor the login flow advertises the app.
export function isAppPromoPath(pathname: string): boolean {
  return !pathname.startsWith('/admin') && !pathname.startsWith('/auth');
}

// Once per visit: the session flag is set as soon as the modal has been shown.
export function shouldShowAppPromo(pathname: string, seenThisSession: string | null): boolean {
  return !seenThisSession && isAppPromoPath(pathname);
}

// iPadOS Safari identifies as a Mac, and a desktop visitor who typed /app
// still gets a store page rather than a dead end, hence App Store by default.
export function storeUrlForUserAgent(userAgent: string | null | undefined): string {
  return /android/i.test(userAgent ?? '') ? PLAY_STORE_URL : APP_STORE_URL;
}
