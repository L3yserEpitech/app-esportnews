import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Backend URL from centralized .env (EXPO_PUBLIC_API_URL)
export const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

console.log('🌐 [apiClient] BACKEND_URL:', BACKEND_URL);

// Storage keys
const TOKEN_KEY = 'authToken';

// Auth-expired listener registry. AuthContext subscribes here so it can clear
// user state and bounce to the login screen when an authenticated request 401s.
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function notifyUnauthorized() {
  for (const listener of unauthorizedListeners) {
    try {
      listener();
    } catch (err) {
      console.error('onUnauthorized listener threw:', err);
    }
  }
}

// Endpoints that may legitimately 401 without meaning the session is dead
// (e.g. wrong credentials at login). Don't fire the global expired event for those.
const SESSION_AGNOSTIC_PATHS = ['/api/auth/login', '/api/auth/signup'];

function isSessionAgnostic(url: string | undefined): boolean {
  if (!url) return false;
  return SESSION_AGNOSTIC_PATHS.some((path) => url.startsWith(path));
}

// Create Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: BACKEND_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add JWT token to headers
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error reading token from AsyncStorage:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors and token expiration
apiClient.interceptors.response.use(
  (response: any) => {
    return response;
  },
  async (error: any) => {
    if (error.response?.status === 401 && !isSessionAgnostic(error.config?.url)) {
      // Authenticated request rejected — drop the token and let AuthContext
      // clear user state + redirect to the login screen.
      await AsyncStorage.removeItem(TOKEN_KEY);
      notifyUnauthorized();
    }
    return Promise.reject(error);
  }
);

// Token management helpers
export const tokenManager = {
  getToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  setToken: async (token: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error setting token:', error);
    }
  },

  removeToken: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  },
};

export default apiClient;
