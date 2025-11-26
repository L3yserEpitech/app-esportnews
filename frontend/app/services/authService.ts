const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export interface SignupData {
  name: string;
  email: string;
  password: string;
  age: number;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  user: UserData;
}

export interface FavoriteTeam {
  id: number;
  name: string;
  slug: string;
  acronym: string;
  players: any[];
  location: string;
  image_url: string;
  modified_at: number;
  current_videogame: any;
}

export interface UserData {
  id: number;
  created_at: string;
  name: string;
  email: string;
  admin: boolean;
  avatar: string | null;
  age: number;
}

class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   */
  async signup(data: SignupData): Promise<{ authToken: string; user: UserData }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de l\'inscription');
    }

    const result: AuthResponse = await response.json();

    return {
      authToken: result.access_token,
      user: result.user,
    };
  }

  /**
   * Connexion d'un utilisateur
   */
  async login(data: LoginData): Promise<{ authToken: string; user: UserData }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Email ou mot de passe incorrect');
    }

    const result: AuthResponse = await response.json();

    return {
      authToken: result.access_token,
      user: result.user,
    };
  }

  /**
   * Récupération des informations de l'utilisateur connecté
   */
  async getMe(token: string): Promise<UserData> {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Impossible de récupérer les informations utilisateur');
    }

    const userData: UserData = await response.json();
    return userData;
  }

  /**
   * Stockage du token dans le localStorage
   */
  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }

  /**
   * Récupération du token depuis le localStorage
   */
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  }

  /**
   * Suppression du token
   */
  removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }

  /**
   * Déconnexion
   */
  logout(): void {
    this.removeToken();
  }
}

export const authService = new AuthService();
