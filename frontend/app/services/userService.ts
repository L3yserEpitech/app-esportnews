import { supabase } from '@/lib/supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

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
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'POST',
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
   * Upload de l'avatar utilisateur directement vers Supabase Storage
   * puis mise à jour de l'URL en base via le backend
   */
  async uploadAvatar(token: string, file: File, userId: number): Promise<UserData> {
    // 1. Upload du fichier vers Supabase Storage (côté frontend)
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    console.log(`📤 Uploading avatar to Supabase Storage: ${filePath}`);

    // Créer un client Supabase avec le token JWT pour que les politiques RLS fonctionnent
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // Note: Pour que RLS fonctionne, il faudrait passer un token Supabase Auth
    // Pour l'instant, on utilise le client par défaut
    const { error: uploadError } = await supabase.storage
      .from('profilePictureUsers')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      throw new Error('Erreur lors de l\'upload de l\'image. Vérifiez les permissions du bucket.');
    }

    // 2. Obtenir l'URL publique
    const { data: publicUrlData } = supabase.storage
      .from('profilePictureUsers')
      .getPublicUrl(filePath);

    const avatarUrl = publicUrlData.publicUrl;
    console.log(`✅ Avatar uploaded, URL: ${avatarUrl}`);

    // 3. Envoyer l'URL au backend pour mettre à jour la base de données
    const response = await fetch(`${API_BASE_URL}/api/auth/avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ avatarUrl }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Erreur lors de la mise à jour de l'avatar");
    }

    const userData: UserData = await response.json();
    return userData;
  }

  /**
   * Récupération du profil utilisateur
   */
  async getProfile(token: string): Promise<UserData> {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
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
   * Suppression de l'avatar utilisateur
   */
  async deleteAvatar(token: string): Promise<UserData> {
    const response = await fetch(`${API_BASE_URL}/api/auth/avatar`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de la suppression de l\'avatar');
    }

    const userData: UserData = await response.json();
    return userData;
  }
}

export const userService = new UserService();
