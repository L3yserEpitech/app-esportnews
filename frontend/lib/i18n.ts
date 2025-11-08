/**
 * Fichier de configuration pour les traductions
 * Utilisé par les composants client et serveur
 */
import { getLanguagePreference } from './preferences';
import frMessages from '@/public/locales/fr.json';
import enMessages from '@/public/locales/en.json';
import esMessages from '@/public/locales/es.json';
import deMessages from '@/public/locales/de.json';
import itMessages from '@/public/locales/it.json';

export const messages = {
  fr: frMessages,
  en: enMessages,
  es: esMessages,
  de: deMessages,
  it: itMessages,
};

export function getMessages(locale?: string) {
  const lang = locale || getLanguagePreference();
  return messages[lang as keyof typeof messages] || messages.fr;
}
