/**
 * Utilitaire de gestion des cookies pour les préférences utilisateur
 */

export type CookieOptions = {
  expires?: number | Date; // En jours ou Date
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
};

/**
 * Définir un cookie
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof window === 'undefined') return;

  const {
    expires = 365, // Par défaut 1 an
    path = '/',
    domain,
    secure = true,
    sameSite = 'lax',
  } = options;

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  // Gérer l'expiration
  if (expires) {
    const date = expires instanceof Date ? expires : new Date(Date.now() + expires * 24 * 60 * 60 * 1000);
    cookieString += `; expires=${date.toUTCString()}`;
  }

  // Ajouter les autres options
  if (path) cookieString += `; path=${path}`;
  if (domain) cookieString += `; domain=${domain}`;
  if (secure) cookieString += '; secure';
  if (sameSite) cookieString += `; samesite=${sameSite}`;

  document.cookie = cookieString;
}

/**
 * Récupérer un cookie
 */
export function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null;

  const nameEQ = encodeURIComponent(name) + '=';
  const cookies = document.cookie.split(';');

  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1);
    }
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length));
    }
  }

  return null;
}

/**
 * Supprimer un cookie
 */
export function deleteCookie(name: string, path: string = '/'): void {
  if (typeof window === 'undefined') return;

  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
}

/**
 * Vérifier si un cookie existe
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null;
}
