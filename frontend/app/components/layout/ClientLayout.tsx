'use client';

import { NextIntlClientProvider } from 'next-intl';
import Navbar from './Navbar';
import Footer from './Footer';
import { ThemeProvider } from '../providers/ThemeProvider';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { useGame } from '../../contexts/GameContext';
import { getLanguagePreference } from '@/lib/preferences';
import frMessages from '@/public/locales/fr.json';
import enMessages from '@/public/locales/en.json';
import esMessages from '@/public/locales/es.json';
import deMessages from '@/public/locales/de.json';
import itMessages from '@/public/locales/it.json';

interface ClientLayoutProps {
  children: React.ReactNode;
}

const messages: Record<string, any> = {
  fr: frMessages,
  en: enMessages,
  es: esMessages,
  de: deMessages,
  it: itMessages,
};

const ClientLayout: React.FC<ClientLayoutProps> = ({ children }) => {
  const { games, selectedGame, setSelectedGame } = useGame();
  const locale = getLanguagePreference();

  return (
    <PreferencesProvider>
      <ThemeProvider>
        <NextIntlClientProvider
          locale={locale}
          messages={messages[locale]}
          timeZone="Europe/Paris"
        >
          <ToastProvider>
            <Navbar
              games={games}
              selectedGame={selectedGame}
              onGameSelectionChange={setSelectedGame}
            />
            {children}
            <Footer />
          </ToastProvider>
        </NextIntlClientProvider>
      </ThemeProvider>
    </PreferencesProvider>
  );
};

export default ClientLayout;