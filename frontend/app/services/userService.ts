const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export interface UpdateProfileData {
  name?: string;
  email?: string;
  password?: string;
  avatar?: string;
}

export interface UserData {
  id: number;
  created_at: string;
  name: string;
  email: string;
  admin: boolean;
  avatar: string | null;
}

class UserService {
  /**
   * Mise à jour du profil utilisateur
   */
  async updateProfile(token: string, data: UpdateProfileData): Promise<UserData> {
    const response = await fetch(`${API_BASE_URL}/api/user/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de la mise à jour du profil');
    }

    const userData: UserData = await response.json();
    return userData;
  }

  /**
   * Récupération du profil utilisateur
   */
  async getProfile(token: string): Promise<UserData> {
    const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Impossible de récupérer le profil utilisateur');
    }

    const userData: UserData = await response.json();
    return userData;
  }

  /**
   * Suppression du compte utilisateur
   */
  async deleteAccount(token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/user/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de la suppression du compte');
    }
  }
}

export const userService = new UserService();
