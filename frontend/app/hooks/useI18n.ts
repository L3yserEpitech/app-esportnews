'use client';

import { useTranslations } from 'next-intl';
import { getLanguagePreference, setLanguagePreference } from '@/lib/preferences';
import { useState, useCallback } from 'react';

/**
 * Hook personnalisé pour les traductions
 * Combine les fonctionnalités de next-intl avec les préférences utilisateur
 */
export function useI18n() {
  const t = useTranslations();
  const [currentLocale, setCurrentLocale] = useState(() => getLanguagePreference());

  const changeLanguage = useCallback((locale: 'fr' | 'en' | 'es' | 'de' | 'it') => {
    setLanguagePreference(locale);
    setCurrentLocale(locale);
    // Recharger la page pour appliquer les traductions
    window.location.reload();
  }, []);

  return {
    t,
    currentLocale,
    changeLanguage,
  };
}
