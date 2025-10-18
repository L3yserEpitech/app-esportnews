'use client';

import { useState } from 'react';
import { Globe, Moon, Sun, Monitor, Save, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function PreferencesSection() {
  const [preferences, setPreferences] = useState({
    language: 'fr',
    theme: 'dark',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSelect = (key: keyof typeof preferences, value: string) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      setMessage(null);

      // Simuler une sauvegarde
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setMessage({ type: 'success', text: 'Préférences enregistrées avec succès' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde des préférences' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Préférences</h2>
        <p className="text-gray-400">Personnalisez votre expérience sur la plateforme</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-red-500/10 border border-red-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <span className={message.type === 'success' ? 'text-green-500' : 'text-red-500'}>
              {message.text}
            </span>
          </div>
          <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Langue */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-[#F22E62]" />
            <h3 className="text-lg font-semibold text-white">Langue</h3>
          </div>
          <select
            value={preferences.language}
            onChange={(e) => handleSelect('language', e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F22E62] focus:border-transparent transition-all"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="de">Deutsch</option>
          </select>
        </div>

        {/* Thème */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Monitor className="w-5 h-5 text-[#F22E62]" />
            <h3 className="text-lg font-semibold text-white">Thème</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleSelect('theme', 'light')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                preferences.theme === 'light'
                  ? 'bg-[#F22E62] border-[#F22E62] text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Sun className="w-5 h-5" />
              <span className="font-medium">Clair</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect('theme', 'dark')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                preferences.theme === 'dark'
                  ? 'bg-[#F22E62] border-[#F22E62] text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Moon className="w-5 h-5" />
              <span className="font-medium">Sombre</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect('theme', 'auto')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                preferences.theme === 'auto'
                  ? 'bg-[#F22E62] border-[#F22E62] text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <Monitor className="w-5 h-5" />
              <span className="font-medium">Auto</span>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-[#F22E62] hover:bg-[#F22E62]/80 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Enregistrement en cours...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Enregistrer les préférences
            </>
          )}
        </button>
      </form>
    </div>
  );
}
