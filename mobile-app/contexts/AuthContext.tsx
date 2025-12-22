import { createContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '@/services';
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

  // Auto-login on mount (check if token exists in AsyncStorage)
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await authService.getToken();
        if (token) {
          // Token exists, fetch user data
          const userData = await authService.getMe();
          setUser(userData);
        }
      } catch (error) {
        console.error('AuthContext.initAuth error:', error);
        // Invalid token, remove it
        await authService.removeToken();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authService.login(credentials);

      // Note: token already stored by authService
      // Just set user data
      setUser(response.user);
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
    } catch (error) {
      console.error('AuthContext.register error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
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
