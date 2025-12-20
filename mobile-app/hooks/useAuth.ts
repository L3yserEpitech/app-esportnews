import { useContext } from 'react';
import AuthContext from '@/contexts/AuthContext';

/**
 * Hook personnalisé pour accéder au contexte d'authentification
 *
 * @throws {Error} Si utilisé en dehors d'un AuthProvider
 * @returns {AuthContextType} Les états et fonctions d'authentification
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, login, logout } = useAuth();
 *
 * if (!isAuthenticated) {
 *   return <LoginScreen />;
 * }
 *
 * return <Text>Welcome {user?.name}</Text>;
 * ```
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
