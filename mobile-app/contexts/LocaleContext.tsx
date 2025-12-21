import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/utils/i18n';

type SupportedLocale = 'fr' | 'en' | 'es' | 'de' | 'it';

interface LocaleContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  isLoading: boolean;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const STORAGE_KEY = 'esport_language';
const DEFAULT_LOCALE: SupportedLocale = 'fr';

export const LocaleProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved locale on mount
  useEffect(() => {
    const loadLocale = async () => {
      try {
        const savedLocale = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedLocale && isValidLocale(savedLocale)) {
          setLocaleState(savedLocale as SupportedLocale);
          await i18n.changeLanguage(savedLocale);
        } else {
          // Set default locale
          await i18n.changeLanguage(DEFAULT_LOCALE);
        }
      } catch (error) {
        console.error('Failed to load locale:', error);
        await i18n.changeLanguage(DEFAULT_LOCALE);
      } finally {
        setIsLoading(false);
      }
    };

    loadLocale();
  }, []);

  const setLocale = async (newLocale: SupportedLocale) => {
    try {
      // Update i18n
      await i18n.changeLanguage(newLocale);

      // Update state
      setLocaleState(newLocale);

      // Persist to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, newLocale);
    } catch (error) {
      console.error('Failed to set locale:', error);
      throw error;
    }
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, isLoading }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
};

// Helper function to validate locale
function isValidLocale(locale: string): boolean {
  return ['fr', 'en', 'es', 'de', 'it'].includes(locale);
}
