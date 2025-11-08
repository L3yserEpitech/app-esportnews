import { NextRequest, NextResponse } from 'next/server';

// Configuration des locales supportées
const locales = ['fr', 'en', 'es', 'de', 'it'];
const defaultLocale = 'fr';

export function middleware(request: NextRequest) {
  // Récupérer la langue depuis le cookie utilisateur ou le header
  const languageCookie = request.cookies.get('esport_language')?.value;

  // Récupérer la langue préférée du navigateur
  const acceptLanguage = request.headers.get('accept-language');
  let preferredLanguage = defaultLocale;

  // Priorité: cookie > header > default
  if (languageCookie && locales.includes(languageCookie)) {
    preferredLanguage = languageCookie;
  } else if (acceptLanguage) {
    // Extraire la première langue du header accept-language
    const firstLanguage = acceptLanguage.split(',')[0].split('-')[0].toLowerCase();
    if (locales.includes(firstLanguage)) {
      preferredLanguage = firstLanguage;
    }
  }

  // Ajouter la langue préférée aux headers pour qu'elle soit accessible au serveur
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-preferred-locale', preferredLanguage);

  // Passer la réponse sans modifier les routes
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return response;
}

// Configuration du middleware
export const config = {
  matcher: [
    // Matcher tous les paths sauf les fichiers statiques et les fichiers système
    '/((?!_next|.*\\..*|api).*)',
  ],
};
