'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, Newspaper } from 'lucide-react';
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

interface NotificationPreferences {
  notifi_push: boolean;
  notif_articles: boolean;
  notif_news: boolean;
  notif_matchs: boolean;
}

export default function NotificationsSection() {
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
          <h2 className="text-2xl font-bold text-white mb-2">Notifications</h2>
          <p className="text-gray-400">Chargement des préférences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Notifications</h2>
        <p className="text-gray-400">Gérez vos préférences de notifications</p>
      </div>

      {/* Paramètres de notifications */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Paramètres de notifications</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-[#F22E62]" />
              <div>
                <p className="text-white font-medium group-hover:text-[#F22E62] transition-colors">
                  Notifications push
                </p>
                <p className="text-sm text-gray-400">Recevoir des notifications sur votre appareil</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('notifi_push')}
              disabled={updating}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.notifi_push ? 'bg-[#F22E62]' : 'bg-white/10'
              } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.notifi_push ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-3">
              <Newspaper className="w-5 h-5 text-[#F22E62]" />
              <div>
                <p className="text-white font-medium group-hover:text-[#F22E62] transition-colors">
                  Notifications d'articles
                </p>
                <p className="text-sm text-gray-400">Être notifié des nouveaux articles</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('notif_articles')}
              disabled={updating}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.notif_articles ? 'bg-[#F22E62]' : 'bg-white/10'
              } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.notif_articles ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-[#F22E62]" />
              <div>
                <p className="text-white font-medium group-hover:text-[#F22E62] transition-colors">
                  Alertes d'actualités
                </p>
                <p className="text-sm text-gray-400">Être notifié des nouvelles actualités</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('notif_news')}
              disabled={updating}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.notif_news ? 'bg-[#F22E62]' : 'bg-white/10'
              } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.notif_news ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-[#F22E62]" />
              <div>
                <p className="text-white font-medium group-hover:text-[#F22E62] transition-colors">
                  Rappels de matchs
                </p>
                <p className="text-sm text-gray-400">Être notifié avant le début des matchs</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('notif_matchs')}
              disabled={updating}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.notif_matchs ? 'bg-[#F22E62]' : 'bg-white/10'
              } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.notif_matchs ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

    </div>
  );
}
