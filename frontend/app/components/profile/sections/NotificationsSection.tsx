'use client';

import { useState } from 'react';
import { Bell, Mail, Smartphone, Trash2, CheckCircle } from 'lucide-react';

interface Notification {
  id: string;
  type: 'match' | 'news' | 'team' | 'system';
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export default function NotificationsSection() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'match',
      title: 'Match en direct',
      message: 'Team Vitality vs G2 Esports commence dans 10 minutes',
      date: '2025-10-10T14:30:00',
      read: false,
    },
    {
      id: '2',
      type: 'news',
      title: 'Nouvelle actualité',
      message: 'Découvrez les dernières infos sur le monde de l\'esport',
      date: '2025-10-10T12:00:00',
      read: true,
    },
    {
      id: '3',
      type: 'team',
      title: 'Équipe favorite',
      message: 'Team Vitality a ajouté un nouveau joueur à son roster',
      date: '2025-10-09T18:00:00',
      read: true,
    },
  ]);

  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    matchReminders: true,
    newsAlerts: false,
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    );
  };

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'match':
        return '⚔️';
      case 'news':
        return '📰';
      case 'team':
        return '🏆';
      case 'system':
        return '⚙️';
      default:
        return '🔔';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) {
      return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else if (hours < 24) {
      return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
    } else {
      return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Notifications</h2>
        <p className="text-gray-400">Gérez vos préférences de notifications et consultez votre historique</p>
      </div>

      {/* Paramètres de notifications */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Paramètres de notifications</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-[#F22E62]" />
              <div>
                <p className="text-white font-medium group-hover:text-[#F22E62] transition-colors">
                  Notifications par email
                </p>
                <p className="text-sm text-gray-400">Recevoir des notifications par email</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('emailNotifications')}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.emailNotifications ? 'bg-[#F22E62]' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.emailNotifications ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

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
              onClick={() => handleToggle('pushNotifications')}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.pushNotifications ? 'bg-[#F22E62]' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.pushNotifications ? 'translate-x-6' : 'translate-x-0'
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
              onClick={() => handleToggle('matchReminders')}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.matchReminders ? 'bg-[#F22E62]' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.matchReminders ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-[#F22E62]" />
              <div>
                <p className="text-white font-medium group-hover:text-[#F22E62] transition-colors">
                  Alertes d'actualités
                </p>
                <p className="text-sm text-gray-400">Être notifié des nouvelles actualités</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('newsAlerts')}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.newsAlerts ? 'bg-[#F22E62]' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.newsAlerts ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Liste des notifications */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Historique des notifications</h3>
            {unreadCount > 0 && (
              <p className="text-sm text-[#F22E62]">{unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}</p>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleMarkAllAsRead}
                className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Tout marquer lu
              </button>
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Tout effacer
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-400">Aucune notification</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border transition-all ${
                  notification.read
                    ? 'bg-white/5 border-white/10'
                    : 'bg-[#F22E62]/10 border-[#F22E62]/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-medium">{notification.title}</h4>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-[#F22E62] rounded-full" />
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{notification.message}</p>
                      <p className="text-xs text-gray-500">{formatDate(notification.date)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!notification.read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Marquer comme lu"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notification.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
