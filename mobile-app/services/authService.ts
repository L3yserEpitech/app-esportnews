import apiClient, { tokenManager } from './apiClient';
import type { User, LoginCredentials, RegisterData, AuthResponse } from '@/types';

export interface SignupData extends RegisterData {
  age?: number;
}

export interface LoginData extends LoginCredentials {}

export interface UserData extends User {}

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
      const message = error.response?.data?.error || "Erreur lors de l'inscription";
      throw new Error(message);
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
      const message = error.response?.data?.error || 'Email ou mot de passe incorrect';
      throw new Error(message);
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
}

export const authService = new AuthService();
