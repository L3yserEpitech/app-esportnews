'use client';

import { Globe, Moon, Sun, Monitor } from 'lucide-react';
import { usePreferences } from '@/app/hooks/usePreferences';

export default function PreferencesSection() {
  const { preferences, updatePreferences } = usePreferences();

  const handleSelect = (key: 'language' | 'theme', value: string) => {
    updatePreferences({ [key]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Préférences</h2>
        <p className="text-gray-400">Personnalisez votre expérience sur la plateforme</p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Langue */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-[#F22E62]" />
            <h3 className="text-base sm:text-lg font-semibold text-white">Langue</h3>
          </div>
          <select
            value={preferences.language}
            onChange={(e) => handleSelect('language', e.target.value)}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#F22E62] focus:border-transparent transition-all"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="de">Deutsch</option>
          </select>
        </div>

        {/* Thème */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-4">
            <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-[#F22E62]" />
            <h3 className="text-base sm:text-lg font-semibold text-white">Thème</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => handleSelect('theme', 'light')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 rounded-lg border transition-all ${
                preferences.theme === 'light'
                  ? 'bg-[#F22E62] border-[#F22E62] text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-medium text-xs sm:text-sm">Clair</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect('theme', 'dark')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 rounded-lg border transition-all ${
                preferences.theme === 'dark'
                  ? 'bg-[#F22E62] border-[#F22E62] text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-medium text-xs sm:text-sm">Sombre</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect('theme', 'auto')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 rounded-lg border transition-all ${
                preferences.theme === 'auto'
                  ? 'bg-[#F22E62] border-[#F22E62] text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-medium text-xs sm:text-sm">Auto</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
