import { createContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import { authService } from '@/services';
import { onUnauthorized } from '@/services/apiClient';
import { pushTokenService } from '@/services/pushTokenService';
import { registerForPushNotificationsAsync } from '@/utils/notifications';
import { User, LoginCredentials, RegisterData } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Register push token with backend after authentication
async function registerPushToken() {
  try {
    const pushToken = await registerForPushNotificationsAsync();
    if (pushToken) {
      await pushTokenService.register(pushToken, Platform.OS);
    }
  } catch (error) {
    console.error('AuthContext.registerPushToken error:', error);
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);
  // Set when the stored session could not be verified for a reason that is
  // not the backend refusing it (offline, backend restarting): the profile is
  // fetched again when the app comes back to the foreground.
  const retryOnForegroundRef = useRef(false);

  // Track mount state to avoid state updates after unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Loads the profile of the stored session. Only a refresh the backend
  // refuses ends the session — apiClient then wipes the tokens and fires
  // onUnauthorized. Any other failure keeps the tokens: the last known profile
  // is shown and the fetch is retried later.
  const loadSession = useCallback(async () => {
    const token = await authService.getToken();
    if (!token) {
      retryOnForegroundRef.current = false;
      return;
    }
    try {
      const userData = await authService.getMe();
      retryOnForegroundRef.current = false;
      if (isMountedRef.current) {
        setUser(userData);
      }
      // Fire-and-forget — same as login/register
      void registerPushToken();
    } catch (error) {
      if (!(await authService.getToken())) {
        // Session over: handled by the onUnauthorized listener.
        retryOnForegroundRef.current = false;
        return;
      }
      console.warn('AuthContext.loadSession: profile unavailable, session kept', error);
      retryOnForegroundRef.current = true;
      const cached = await authService.getCachedUser();
      if (cached && isMountedRef.current) {
        setUser((current) => current ?? cached);
      }
    }
  }, []);

  // Auto-login on mount (check if token exists in AsyncStorage)
  useEffect(() => {
    loadSession().finally(() => {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    });
  }, [loadSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && retryOnForegroundRef.current) {
        void loadSession();
      }
    });
    return () => subscription.remove();
  }, [loadSession]);

  // When apiClient gets a 401 on an authenticated request, drop the user state
  // and bounce to the login screen. Token has already been wiped by apiClient.
  useEffect(() => {
    return onUnauthorized(() => {
      if (!isMountedRef.current) return;
      retryOnForegroundRef.current = false;
      setUser(null);
      router.replace('/auth/login');
    });
  }, []);

  // Unregister push token from backend
  const unregisterPushToken = async () => {
    try {
      const Notifications = await import('expo-notifications');
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '96bacb7b-e2b7-4bfa-b8ad-940dc3e54815',
      });
      if (tokenData?.data) {
        await pushTokenService.unregister(tokenData.data);
      }
    } catch (error) {
      console.error('AuthContext.unregisterPushToken error:', error);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authService.login(credentials);

      // Note: token already stored by authService
      // Just set user data
      setUser(response.user);

      // Register push token after successful login.
      // Fire-and-forget: a notifications-permission denial or transient
      // network error must not reject the login() promise — registerPushToken
      // already swallows its own errors, but we also don't await it so any
      // future-thrown error can't bubble up here either.
      void registerPushToken();
    } catch (error) {
      console.error('AuthContext.login error:', error);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await authService.signup(data);

      // Note: token already stored by authService
      // Just set user data
      setUser(response.user);

      // Fire-and-forget for the same reason as login() above.
      void registerPushToken();
    } catch (error) {
      console.error('AuthContext.register error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Unregister push token best-effort — must not block sign-out if the
      // notifications permission was revoked or the network is down.
      void unregisterPushToken();

      // Revokes this device's refresh token server-side, then clears storage.
      await authService.logout();

      // Clear user data
      setUser(null);
    } catch (error) {
      console.error('AuthContext.logout error:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    const token = await authService.getToken();
    if (!token) return;
    try {
      const userData = await authService.getMe();
      setUser(userData);
    } catch (error) {
      // A refused session is already handled by onUnauthorized; anything else
      // (offline, backend down) keeps the current profile on screen.
      console.error('AuthContext.refreshUser error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
