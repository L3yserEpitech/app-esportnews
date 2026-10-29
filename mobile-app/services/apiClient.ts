import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { classifyRefreshFailure, type RefreshOutcome } from './sessionRefresh';

// Backend URL from centralized .env (EXPO_PUBLIC_API_URL)
export const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

console.log('🌐 [apiClient] BACKEND_URL:', BACKEND_URL);

// Storage keys
const TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
// Last profile fetched: lets the app open signed-in when /auth/me can't be
// reached (no network, backend restarting) instead of showing a logged-out
// screen while the tokens are still perfectly valid.
const USER_KEY = 'authUser';

// Auth-expired listener registry. AuthContext subscribes here so it can clear
// user state and bounce to the login screen when the session is really over.
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
// (e.g. wrong credentials at login, logout with an already expired token).
// Don't fire the global expired event for those, and never try to refresh
// from them — /auth/refresh especially, which would recurse into itself.
const SESSION_AGNOSTIC_PATHS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/refresh',
  '/api/auth/logout',
];

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
// refresh token contre une nouvelle paire au premier 401. Seul un refus du
// backend déconnecte ; sans réseau ou backend en redémarrage, on garde les
// tokens et on réessaiera au prochain 401.
let pendingRefresh: Promise<RefreshOutcome> | null = null;

async function refreshSession(): Promise<RefreshOutcome> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return 'rejected';

  try {
    // Instance nue : passer par apiClient relancerait les intercepteurs.
    const { data } = await axios.post<{ access_token: string; refresh_token: string }>(
      `${BACKEND_URL}/api/auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
    );
    if (!data?.access_token || !data?.refresh_token) return 'unavailable';
    await tokenManager.setTokens(data.access_token, data.refresh_token);
    return 'renewed';
  } catch (error) {
    return classifyRefreshFailure(error);
  }
}

// Un seul refresh en vol : plusieurs requêtes qui 401 en même temps attendent
// le même échange au lieu d'en déclencher un chacune (le backend fait tourner
// le refresh token, donc les suivants seraient refusés).
function refreshSessionOnce(): Promise<RefreshOutcome> {
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
    // Only a request that carried a token can tell us the session has expired.
    // A 401 on a call sent without one (e.g. a push-token unregister racing a
    // logout) is just an unauthenticated call, not a session to tear down.
    const wasAuthenticated = Boolean(original?.headers?.Authorization);
    const canRetry =
      wasAuthenticated && !original._retriedAfterRefresh && !isSessionAgnostic(original.url);

    if (error.response?.status === 401 && canRetry) {
      original._retriedAfterRefresh = true;

      const outcome = await refreshSessionOnce();
      if (outcome === 'renewed') {
        return apiClient(original);
      }
      if (outcome === 'rejected') {
        // Le backend a refusé le refresh token : la session est bien finie —
        // on nettoie et AuthContext renvoie vers la connexion.
        await tokenManager.clearTokens();
        notifyUnauthorized();
      }
      // 'unavailable' : l'échange n'a pas pu avoir lieu. Les tokens restent,
      // la requête échoue comme n'importe quelle erreur réseau.
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

  setCachedUser: async (user: unknown): Promise<void> => {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error caching user:', error);
    }
  },

  getCachedUser: async <T>(): Promise<T | null> => {
    try {
      const raw = await AsyncStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      console.error('Error reading cached user:', error);
      return null;
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
      await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  },
};

export default apiClient;
