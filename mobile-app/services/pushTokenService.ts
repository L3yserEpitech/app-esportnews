import apiClient from './apiClient';

class PushTokenService {
  async register(token: string, platform: string): Promise<void> {
    await apiClient.post('/api/push-tokens', { token, platform });
  }

  async unregister(token: string): Promise<void> {
    await apiClient.delete('/api/push-tokens', { data: { token } });
  }
}

export const pushTokenService = new PushTokenService();
