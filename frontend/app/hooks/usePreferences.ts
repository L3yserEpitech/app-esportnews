'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getPreferences,
  setPreferences as savePreferences,
  getLanguagePreference,
  setLanguagePreference,
  getThemePreference,
  setThemePreference,
  type Language,
  type Theme,
  type UserPreferences,
} from '@/lib/preferences';

/**
 * Hook personnalisé pour gérer les préférences utilisateur (langue et thème)
 * Les préférences sont stockées dans les cookies
 */
export function usePreferences() {
  const [preferences, setPreferencesState] = useState<UserPreferences>({
    language: 'fr',
    theme: 'dark',
  });

  const [isLoading, setIsLoading] = useState(true);

  // Charger les préférences depuis les cookies au montage
  useEffect(() => {
    const loadedPreferences = getPreferences();
    setPreferencesState(loadedPreferences);
    setIsLoading(false);
  }, []);

  // Mettre à jour la langue
  const updateLanguage = useCallback((language: Language) => {
    setLanguagePreference(language);
    setPreferencesState((prev) => ({ ...prev, language }));
  }, []);

  // Mettre à jour le thème
  const updateTheme = useCallback((theme: Theme) => {
    setThemePreference(theme);
    setPreferencesState((prev) => ({ ...prev, theme }));
  }, []);

  // Mettre à jour toutes les préférences
  const updatePreferences = useCallback((newPreferences: Partial<UserPreferences>) => {
    savePreferences(newPreferences);
    setPreferencesState((prev) => ({ ...prev, ...newPreferences }));
  }, []);

  return {
    preferences,
    language: preferences.language,
    theme: preferences.theme,
    updateLanguage,
    updateTheme,
    updatePreferences,
    isLoading,
  };
}
