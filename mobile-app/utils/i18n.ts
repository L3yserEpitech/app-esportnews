import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import fr from '@/locales/fr.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import de from '@/locales/de.json';
import it from '@/locales/it.json';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
  it: { translation: it },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'fr', // Default language
  fallbackLng: 'fr',
  compatibilityJSON: 'v4',
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  react: {
    useSuspense: false, // Disable suspense to avoid issues with React Native
  },
});

export default i18n;
