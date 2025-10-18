/**
 * Gestion des préférences utilisateur (langue, thème) via cookies
 */

import { getCookie, setCookie } from './cookies';

export type Language = 'fr' | 'en' | 'es' | 'de';
export type Theme = 'light' | 'dark' | 'auto';

export type UserPreferences = {
  language: Language;
  theme: Theme;
};

const COOKIE_NAMES = {
  LANGUAGE: 'esport_language',
  THEME: 'esport_theme',
} as const;

const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'fr',
  theme: 'dark',
};

/**
 * Récupérer la langue depuis les cookies
 */
export function getLanguagePreference(): Language {
  const language = getCookie(COOKIE_NAMES.LANGUAGE);
  if (language && isValidLanguage(language)) {
    return language as Language;
  }
  return DEFAULT_PREFERENCES.language;
}

/**
 * Définir la langue dans les cookies
 */
export function setLanguagePreference(language: Language): void {
  if (!isValidLanguage(language)) {
    console.warn(`Invalid language: ${language}`);
    return;
  }
  setCookie(COOKIE_NAMES.LANGUAGE, language, { expires: 365 });
}

/**
 * Récupérer le thème depuis les cookies
 */
export function getThemePreference(): Theme {
  const theme = getCookie(COOKIE_NAMES.THEME);
  if (theme && isValidTheme(theme)) {
    return theme as Theme;
  }
  return DEFAULT_PREFERENCES.theme;
}

/**
 * Définir le thème dans les cookies
 */
export function setThemePreference(theme: Theme): void {
  if (!isValidTheme(theme)) {
    console.warn(`Invalid theme: ${theme}`);
    return;
  }
  setCookie(COOKIE_NAMES.THEME, theme, { expires: 365 });
}

/**
 * Récupérer toutes les préférences
 */
export function getPreferences(): UserPreferences {
  return {
    language: getLanguagePreference(),
    theme: getThemePreference(),
  };
}

/**
 * Définir toutes les préférences
 */
export function setPreferences(preferences: Partial<UserPreferences>): void {
  if (preferences.language) {
    setLanguagePreference(preferences.language);
  }
  if (preferences.theme) {
    setThemePreference(preferences.theme);
  }
}

/**
 * Valider une langue
 */
function isValidLanguage(language: string): language is Language {
  return ['fr', 'en', 'es', 'de'].includes(language);
}

/**
 * Valider un thème
 */
function isValidTheme(theme: string): theme is Theme {
  return ['light', 'dark', 'auto'].includes(theme);
}
