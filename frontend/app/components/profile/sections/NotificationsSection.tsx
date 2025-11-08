'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, Newspaper } from 'lucide-react';
import { useTranslations } from 'next-intl';
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

interface NotificationPreferences {
  notifi_push: boolean;
  notif_articles: boolean;
  notif_news: boolean;
  notif_matchs: boolean;
}

export default function NotificationsSection() {
  const t = useTranslations();
  const [settings, setSettings] = useState<NotificationPreferences>({
    notifi_push: false,
    notif_articles: false,
    notif_news: false,
    notif_matchs: false,
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Charger les préférences au montage du composant
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const handleToggle = async (key: keyof NotificationPreferences) => {
    if (updating) return;

    // Capturer l'ancien état avant de le modifier
    const previousSettings = { ...settings };
    const newValue = !settings[key];

    // Mise à jour optimiste
    setSettings({ ...settings, [key]: newValue });
    setUpdating(true);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error('No auth token found');
        setSettings(previousSettings);
        setUpdating(false);
        return;
      }

      // Extraire le type de notification (push, articles, news, matchs)
      let type: string;
      if (key === 'notifi_push') {
        type = 'push';
      } else if (key === 'notif_articles') {
        type = 'articles';
      } else if (key === 'notif_news') {
        type = 'news';
      } else if (key === 'notif_matchs') {
        type = 'matchs';
      } else {
        console.error('Unknown notification type:', key);
        setSettings(previousSettings);
        setUpdating(false);
        return;
      }

      console.log(`Toggling notification ${type} to ${newValue}`);

      const response = await fetch(`${API_BASE_URL}/api/notifications/${type}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: newValue }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error updating notification preference:', errorData);
        // Revert sur erreur
        setSettings(previousSettings);
      } else {
        const data = await response.json();
        console.log('Notification preference updated:', data);
        setSettings(data);
      }
    } catch (error) {
      // Revert sur erreur
      console.error('Error updating notification preference:', error);
      setSettings(previousSettings);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('profile.notifications.notifications')}</h2>
          <p className="text-gray-400">{t('profile.notifications.chargement_preferences')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('profile.notifications.notifications')}</h2>
        <p className="text-gray-400">{t('profile.notifications.gerez_preferences')}</p>
      </div>

      {/* Paramètres de notifications */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-4">{t('profile.notifications.parametres_notifications')}</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 cursor-pointer group">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-[#F22E62] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm sm:text-base text-white font-medium group-hover:text-[#F22E62] transition-colors truncate">
                  {t('profile.notifications.notifications_push')}
                </p>
                <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">{t('profile.notifications.recevoir_notifications_appareil')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('notifi_push')}
              disabled={updating}
              className={`relative w-11 h-6 sm:w-12 rounded-full transition-colors flex-shrink-0 ${
                settings.notifi_push ? 'bg-[#F22E62]' : 'bg-white/10'
              } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.notifi_push ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between gap-3 cursor-pointer group">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Newspaper className="w-4 h-4 sm:w-5 sm:h-5 text-[#F22E62] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm sm:text-base text-white font-medium group-hover:text-[#F22E62] transition-colors truncate">
                  {t('profile.notifications.notifications_articles')}
                </p>
                <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">{t('profile.notifications.etre_notifie_articles')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('notif_articles')}
              disabled={updating}
              className={`relative w-11 h-6 sm:w-12 rounded-full transition-colors flex-shrink-0 ${
                settings.notif_articles ? 'bg-[#F22E62]' : 'bg-white/10'
              } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.notif_articles ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between gap-3 cursor-pointer group">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-[#F22E62] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm sm:text-base text-white font-medium group-hover:text-[#F22E62] transition-colors truncate">
                  {t('profile.notifications.alertes_actualites')}
                </p>
                <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">{t('profile.notifications.etre_notifie_actualites')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('notif_news')}
              disabled={updating}
              className={`relative w-11 h-6 sm:w-12 rounded-full transition-colors flex-shrink-0 ${
                settings.notif_news ? 'bg-[#F22E62]' : 'bg-white/10'
              } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.notif_news ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between gap-3 cursor-pointer group">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-[#F22E62] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm sm:text-base text-white font-medium group-hover:text-[#F22E62] transition-colors truncate">
                  {t('profile.notifications.rappels_matchs')}
                </p>
                <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">{t('profile.notifications.etre_notifie_avant_matchs')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('notif_matchs')}
              disabled={updating}
              className={`relative w-11 h-6 sm:w-12 rounded-full transition-colors flex-shrink-0 ${
                settings.notif_matchs ? 'bg-[#F22E62]' : 'bg-white/10'
              } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.notif_matchs ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

    </div>
  );
}
