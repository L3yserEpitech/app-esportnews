import apiClient, { tokenManager } from './apiClient';
import type { User, LoginCredentials, RegisterData, AuthResponse } from '@/types';

export type SignupData = RegisterData;

export interface LoginData extends LoginCredentials {}

export interface UserData extends User {}

/**
 * Auth-flow error that preserves the HTTP status alongside the message.
 * Lets login/register screens map server replies to localized copy
 * without parsing strings.
 */
export class AuthError extends Error {
  status: number | undefined;
  serverMessage: string | undefined;

  constructor(message: string, status?: number, serverMessage?: string) {
    super(message);
    // Hermes/Babel can drop the prototype chain when transpiling `extends Error`,
    // which would silently break `err instanceof AuthError` in the screens.
    Object.setPrototypeOf(this, AuthError.prototype);
    this.name = 'AuthError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

function toAuthError(error: any, fallback: string): AuthError {
  const status: number | undefined = error?.response?.status;
  const serverMessage: string | undefined =
    error?.response?.data?.message || error?.response?.data?.error;
  return new AuthError(serverMessage || fallback, status, serverMessage);
}

class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   */
  async signup(data: SignupData): Promise<{ authToken: string; user: UserData }> {
    try {
      const response = await apiClient.post<AuthResponse>('/api/auth/signup', data);

      const { access_token, user } = response.data;

      // Store token in AsyncStorage
      await tokenManager.setToken(access_token);

      return {
        authToken: access_token,
        user: user as UserData,
      };
    } catch (error: any) {
      throw toAuthError(error, "Erreur lors de l'inscription");
    }
  }

  /**
   * Connexion d'un utilisateur
   */
  async login(data: LoginData): Promise<{ authToken: string; user: UserData }> {
    try {
      const response = await apiClient.post<AuthResponse>('/api/auth/login', data);

      const { access_token, user } = response.data;

      // Store token in AsyncStorage
      await tokenManager.setToken(access_token);

      return {
        authToken: access_token,
        user: user as UserData,
      };
    } catch (error: any) {
      throw toAuthError(error, 'Email ou mot de passe incorrect');
    }
  }

  /**
   * Récupération des informations de l'utilisateur connecté
   */
  async getMe(): Promise<UserData> {
    try {
      // Token is automatically added by interceptor
      const response = await apiClient.get<UserData>('/api/auth/me');
      return response.data;
    } catch (error: any) {
      throw new Error('Impossible de récupérer les informations utilisateur');
    }
  }

  /**
   * Récupération du token depuis AsyncStorage
   */
  async getToken(): Promise<string | null> {
    return tokenManager.getToken();
  }

  /**
   * Suppression du token
   */
  async removeToken(): Promise<void> {
    await tokenManager.removeToken();
  }

  /**
   * Déconnexion
   */
  async logout(): Promise<void> {
    await this.removeToken();
  }

  /**
   * Mise à jour du profil utilisateur
   */
  async updateProfile(data: { name?: string; email?: string; avatar?: string }): Promise<UserData> {
    try {
      const response = await apiClient.post<UserData>('/api/auth/me', data);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Impossible de mettre à jour le profil';
      throw new Error(message);
    }
  }

  /**
   * Upload de la photo de profil vers Cloudflare R2
   */
  async uploadProfilePhoto(uri: string): Promise<{ avatar_url: string }> {
    try {
      // Create FormData for file upload
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('avatar', {
        uri,
        name: filename,
        type,
      } as any);

      const response = await apiClient.post<{ avatar_url: string }>(
        '/api/auth/avatar/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Impossible d\'uploader la photo';
      throw new Error(message);
    }
  }

  /**
   * Changement de mot de passe
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const response = await apiClient.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Impossible de changer le mot de passe';
      throw new Error(message);
    }
  }
  /**
   * Suppression définitive du compte utilisateur
   */
  async deleteAccount(password: string): Promise<void> {
    try {
      await apiClient.delete('/api/auth/account', {
        data: { password },
      });
      await this.removeToken();
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Impossible de supprimer le compte';
      throw new Error(message);
    }
  }
}

export const authService = new AuthService();
