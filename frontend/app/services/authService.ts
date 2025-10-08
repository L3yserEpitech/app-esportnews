const API_BASE_URL = 'https://x8ki-letl-twmt.n7.xano.io/api:Pj8XX1w0';

export interface SignupData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  authToken: string;
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
  created_at: number;
  name: string;
  email: string;
  photoUploaded: boolean;
  admin: boolean;
  favorite_team: FavoriteTeam | null;
  photo: {
    url: string;
  } | null;
}

class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   */
  async signup(data: SignupData): Promise<{ authToken: string; user: UserData }> {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Erreur lors de l\'inscription');
    }

    const authResponse: AuthResponse = await response.json();

    // Récupérer les informations utilisateur
    const user = await this.getMe(authResponse.authToken);

    return {
      authToken: authResponse.authToken,
      user,
    };
  }

  /**
   * Connexion d'un utilisateur
   */
  async login(data: LoginData): Promise<{ authToken: string; user: UserData }> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Email ou mot de passe incorrect');
    }

    const authResponse: AuthResponse = await response.json();

    // Récupérer les informations utilisateur
    const user = await this.getMe(authResponse.authToken);

    return {
      authToken: authResponse.authToken,
      user,
    };
  }

  /**
   * Récupération des informations de l'utilisateur connecté
   */
  async getMe(token: string): Promise<UserData> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
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
