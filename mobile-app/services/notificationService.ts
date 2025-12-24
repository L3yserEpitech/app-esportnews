import apiClient from './apiClient';

export interface NotificationPreferences {
  user_id: number;
  notifi_push: boolean;
  notif_news: boolean;
  notif_articles: boolean;
  notif_matchs: boolean;
}

export interface UpdateNotificationInput {
  notifi_push?: boolean;
  notif_news?: boolean;
  notif_articles?: boolean;
  notif_matchs?: boolean;
}

class NotificationService {
  /**
   * Récupère les préférences de notification actuelles
   */
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const response = await apiClient.get<NotificationPreferences>('/api/notifications/preferences');
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Impossible de récupérer les préférences';
      throw new Error(message);
    }
  }

  /**
   * Met à jour les préférences de notification
   */
  async updatePreferences(data: UpdateNotificationInput): Promise<NotificationPreferences> {
    try {
      const response = await apiClient.patch<NotificationPreferences>(
        '/api/notifications/preferences',
        data
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Impossible de mettre à jour les préférences';
      throw new Error(message);
    }
  }

  /**
   * Bascule un seul type de notification
   */
  async toggleNotification(type: 'push' | 'news' | 'articles' | 'matchs', enabled: boolean): Promise<NotificationPreferences> {
    try {
      const response = await apiClient.post<NotificationPreferences>(
        `/api/notifications/${type}/toggle`,
        { enabled }
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Impossible de basculer la notification';
      throw new Error(message);
    }
  }
}

export const notificationService = new NotificationService();
