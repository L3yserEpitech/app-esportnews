import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Backend URL from centralized .env (EXPO_PUBLIC_API_URL)
export const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

console.log('🌐 [apiClient] BACKEND_URL:', BACKEND_URL);

// Storage keys
const TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

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
// (e.g. wrong credentials at login). Don't fire the global expired event for
// those, and never try to refresh from them — /auth/refresh especially, which
// would recurse into itself.
const SESSION_AGNOSTIC_PATHS = ['/api/auth/login', '/api/auth/signup', '/api/auth/refresh'];

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

// L'access token ne vit que 7 jours. Sans renouvellement, toute session finit
// donc par mourir même sur une app utilisée tous les jours : on échange le
// refresh token contre une nouvelle paire au premier 401, et on ne déconnecte
// que si cet échange échoue.
let pendingRefresh: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;

  try {
    // Instance nue : passer par apiClient relancerait les intercepteurs.
    const { data } = await axios.post<{ access_token: string; refresh_token: string }>(
      `${BACKEND_URL}/api/auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
    );
    if (!data?.access_token) return false;
    await tokenManager.setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// Un seul refresh en vol : plusieurs requêtes qui 401 en même temps attendent
// le même échange au lieu d'en déclencher un chacune (le backend fait tourner
// le refresh token, donc les suivants seraient refusés).
function refreshSessionOnce(): Promise<boolean> {
  if (!pendingRefresh) {
    pendingRefresh = refreshSession().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}

// Response interceptor - Handle errors and token expiration
apiClient.interceptors.response.use(
  (response: any) => {
    return response;
  },
  async (error: any) => {
    const original = error.config;
    const canRetry = original && !original._retriedAfterRefresh && !isSessionAgnostic(original.url);

    if (error.response?.status === 401 && canRetry) {
      original._retriedAfterRefresh = true;

      if (await refreshSessionOnce()) {
        return apiClient(original);
      }

      // Refresh impossible (token absent, expiré ou révoqué) : la session est
      // bien finie — on nettoie et AuthContext renvoie vers la connexion.
      await tokenManager.clearTokens();
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

  // Le refresh token est ce qui garde la session en vie : sans lui, la
  // déconnexion est garantie à l'expiration de l'access token.
  setTokens: async (accessToken: string, refreshToken?: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, accessToken);
      if (refreshToken) {
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }
    } catch (error) {
      console.error('Error setting tokens:', error);
    }
  },

  removeToken: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  },

  clearTokens: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  },
};

export default apiClient;
