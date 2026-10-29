import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  refreshStoredSession,
  type RefreshOutcome,
  type TokenStore,
} from './sessionRefresh';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

/** Erreur HTTP qui garde le statut : le contexte d'auth distingue un 401 (session à renouveler) d'une panne. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const browserStore: TokenStore = {
  get: (key) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null),
  set: (key, value) => {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  },
  remove: (key) => {
    if (typeof window !== 'undefined') localStorage.removeItem(key);
  },
};

export interface SignupData {
  name: string;
  email: string;
  password: string;
  age?: number;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: UserData;
}

export interface Session {
  authToken: string;
  refreshToken: string;
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
  age?: number | null;
}

class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   */
  async signup(data: SignupData): Promise<Session> {
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
      refreshToken: result.refresh_token,
      user: result.user,
    };
  }

  /**
   * Connexion d'un utilisateur
   */
  async login(data: LoginData): Promise<Session> {
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
      refreshToken: result.refresh_token,
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
      throw new ApiError('Impossible de récupérer les informations utilisateur', response.status);
    }

    const userData: UserData = await response.json();
    return userData;
  }

  /**
   * Utilisateur de la session stockée. L'access token ne vit que 7 jours :
   * sur un 401, la session est renouvelée une fois avec le refresh token au
   * lieu de redemander le mot de passe chaque semaine. Seul un refus du
   * backend termine la session ; une panne laisse les tokens en place et
   * remonte l'erreur. Renvoie null sans session utilisable.
   */
  async getSessionUser(): Promise<UserData | null> {
    const token = this.getToken();
    if (!token) return null;
    try {
      return await this.getMe(token);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    if ((await this.refreshSession()) !== 'renewed') return null;
    const renewed = this.getToken();
    return renewed ? this.getMe(renewed) : null;
  }

  refreshSession(): Promise<RefreshOutcome> {
    return refreshStoredSession(API_BASE_URL, browserStore);
  }

  /**
   * Demande d'un lien de réinitialisation.
   * La réponse est identique que l'adresse ait un compte ou non — le backend
   * ne le dit pas, sinon la route servirait d'annuaire de comptes.
   */
  async forgotPassword(email: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error("Impossible d'envoyer l'e-mail de réinitialisation");
    }
  }

  /**
   * Consommation du lien : enregistre le nouveau mot de passe et ouvre une
   * session, l'utilisateur repart connecté.
   */
  async resetPassword(token: string, password: string): Promise<Session> {
    const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ce lien de réinitialisation est invalide ou a expiré.');
    }

    const result: AuthResponse = await response.json();
    return { authToken: result.access_token, refreshToken: result.refresh_token, user: result.user };
  }

  /**
   * Stockage de la session dans le localStorage. Les deux tokens : sans le
   * refresh, la session meurt à l'expiration de l'access token (7 jours).
   */
  setTokens(authToken: string, refreshToken: string): void {
    browserStore.set(ACCESS_TOKEN_KEY, authToken);
    browserStore.set(REFRESH_TOKEN_KEY, refreshToken);
  }

  /**
   * Récupération du token depuis le localStorage
   */
  getToken(): string | null {
    return browserStore.get(ACCESS_TOKEN_KEY);
  }

  /**
   * Suppression de la session locale
   */
  removeToken(): void {
    browserStore.remove(ACCESS_TOKEN_KEY);
    browserStore.remove(REFRESH_TOKEN_KEY);
  }

  /**
   * Déconnexion : révoque le refresh token de ce navigateur côté serveur
   * (best-effort, sans attendre) puis efface la session locale.
   */
  logout(): void {
    const token = this.getToken();
    if (token) {
      void fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => undefined);
    }
    this.removeToken();
  }
}

export const authService = new AuthService();
