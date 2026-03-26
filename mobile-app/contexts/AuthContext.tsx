import { createContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import { authService } from '@/services';
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  // Track mount state to avoid state updates after unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-login on mount (check if token exists in AsyncStorage)
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await authService.getToken();
        if (token && isMountedRef.current) {
          // Token exists, fetch user data
          const userData = await authService.getMe();
          if (isMountedRef.current) {
            setUser(userData);
          }

          // Register push token on auto-login (non-blocking)
          registerPushToken();
        }
      } catch (error) {
        console.error('AuthContext.initAuth error:', error);
        // Invalid token, remove it
        await authService.removeToken();
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    initAuth();
  }, []);

  // Register push token with backend after authentication
  const registerPushToken = async () => {
    try {
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        await pushTokenService.register(pushToken, Platform.OS);
      }
    } catch (error) {
      console.error('AuthContext.registerPushToken error:', error);
    }
  };

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

      // Register push token after successful login
      await registerPushToken();
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

      // Register push token after successful registration
      await registerPushToken();
    } catch (error) {
      console.error('AuthContext.register error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Unregister push token before logout
      await unregisterPushToken();

      // Remove token from AsyncStorage
      await authService.removeToken();

      // Clear user data
      setUser(null);
    } catch (error) {
      console.error('AuthContext.logout error:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const token = await authService.getToken();
      if (token) {
        const userData = await authService.getMe();
        setUser(userData);
      }
    } catch (error) {
      console.error('AuthContext.refreshUser error:', error);
      // Invalid token, logout
      await logout();
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
