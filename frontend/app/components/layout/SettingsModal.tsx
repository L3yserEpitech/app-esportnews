'use client';

import { Globe, Moon, Sun, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePreferences } from '@/app/hooks/usePreferences';
import { Language, Theme } from '@/lib/preferences';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const t = useTranslations();
  const { preferences, updateLanguage, updateTheme } = usePreferences();

  // Gérer le changement de langue
  const handleLanguageChange = (newLanguage: string) => {
    console.log('🌍 Changement de langue:', newLanguage);
    console.log('📊 Préférences avant:', preferences);
    updateLanguage(newLanguage as Language);
    // Recharger la page pour appliquer les traductions
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  // Gérer le changement de thème (toggle entre dark et light uniquement)
  const handleThemeToggle = () => {
    const newTheme: Theme = preferences.theme === 'dark' ? 'light' : 'dark';
    console.log('🎨 Changement de thème:', preferences.theme, '->', newTheme);
    console.log('📊 Préférences avant:', preferences);
    updateTheme(newTheme);
    console.log('✅ updateTheme appelé');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-10"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800/30 rounded-lg shadow-2xl overflow-hidden z-20">
        {/* Content */}
        <div className="py-2">
          {/* Language Selector */}
          <div className="px-3 py-2">
            <div className="flex items-center space-x-2 mb-2">
              <Globe className="w-4 h-4 text-gray-400" />
              <label className="text-xs font-medium text-gray-300">{t('layout.settings_modal.langue')}</label>
            </div>
            <select
              value={preferences.language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
            >
              <option value="fr">{t('layout.settings_modal.francais')}</option>
              <option value="en">{t('layout.settings_modal.english')}</option>
              <option value="es">{t('layout.settings_modal.espanol')}</option>
              <option value="de">{t('layout.settings_modal.deutsch')}</option>
              <option value="it">{t('layout.settings_modal.italiano')}</option>
            </select>
          </div>

          {/* Theme Toggle */}
          <div className="px-3 py-2 border-t border-gray-800/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {preferences.theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-gray-400" />
                ) : preferences.theme === 'light' ? (
                  <Sun className="w-4 h-4 text-gray-400" />
                ) : (
                  <Monitor className="w-4 h-4 text-gray-400" />
                )}
                <label className="text-xs font-medium text-gray-300">
                  {preferences.theme === 'dark' ? t('layout.settings_modal.sombre') : preferences.theme === 'light' ? t('layout.settings_modal.clair') : t('layout.settings_modal.auto')}
                </label>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={handleThemeToggle}
                className={`
                  relative inline-flex items-center h-5 rounded-full w-9 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-gray-900
                  ${preferences.theme === 'dark' ? 'bg-pink-600' : 'bg-gray-600'}
                `}
                role="switch"
                aria-checked={preferences.theme === 'dark'}
              >
                <span
                  className={`
                    inline-block w-3 h-3 transform bg-white rounded-full transition-transform duration-300
                    ${preferences.theme === 'dark' ? 'translate-x-5' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsModal;
