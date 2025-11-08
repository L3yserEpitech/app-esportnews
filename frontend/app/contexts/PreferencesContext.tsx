'use client';

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import {
  getPreferences,
  setPreferences as savePreferences,
  type Language,
  type Theme,
  type UserPreferences,
} from '@/lib/preferences';

interface PreferencesContextType {
  preferences: UserPreferences;
  updateLanguage: (language: Language) => void;
  updateTheme: (theme: Theme) => void;
  updatePreferences: (newPreferences: Partial<UserPreferences>) => void;
  isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
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
    savePreferences({ language });
    setPreferencesState((prev) => ({ ...prev, language }));
  }, []);

  // Mettre à jour le thème
  const updateTheme = useCallback((theme: Theme) => {
    savePreferences({ theme });
    setPreferencesState((prev) => ({ ...prev, theme }));
  }, []);

  // Mettre à jour toutes les préférences
  const updatePreferences = useCallback((newPreferences: Partial<UserPreferences>) => {
    savePreferences(newPreferences);
    setPreferencesState((prev) => ({ ...prev, ...newPreferences }));
  }, []);

  const value: PreferencesContextType = {
    preferences,
    updateLanguage,
    updateTheme,
    updatePreferences,
    isLoading,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferencesContext() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferencesContext must be used within PreferencesProvider');
  }
  return context;
}
