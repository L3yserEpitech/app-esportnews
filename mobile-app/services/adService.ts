import apiClient from './apiClient';
import { Advertisement } from '@/types';

/**
 * Service pour gérer les publicités
 * Récupère les ads depuis le backend et fournit des méthodes utilitaires
 */
class AdService {
  /**
   * Récupère toutes les publicités actives
   */
  async getAds(): Promise<Advertisement[]> {
    try {
      const response = await apiClient.get<Advertisement[]>('/api/ads');
      return response.data || [];
    } catch (error) {
      console.error('[AdService] Error fetching ads:', error);
      return [];
    }
  }

  /**
   * Récupère une publicité aléatoire parmi celles disponibles
   * @returns Une pub aléatoire ou null si aucune disponible
   */
  async getRandomAd(): Promise<Advertisement | null> {
    try {
      const ads = await this.getAds();

      if (ads.length === 0) {
        console.log('[AdService] No ads available');
        return null;
      }

      // Sélection aléatoire
      const randomIndex = Math.floor(Math.random() * ads.length);
      const selectedAd = ads[randomIndex];

      console.log('[AdService] Selected random ad:', selectedAd.title);
      return selectedAd;
    } catch (error) {
      console.error('[AdService] Error getting random ad:', error);
      return null;
    }
  }

  /**
   * Récupère une publicité par sa position (1, 2 ou 3)
   * @param position Position de la pub (1-3)
   */
  async getAdByPosition(position: number): Promise<Advertisement | null> {
    try {
      const ads = await this.getAds();
      const ad = ads.find(a => a.position === position);
      return ad || null;
    } catch (error) {
      console.error('[AdService] Error getting ad by position:', error);
      return null;
    }
  }
}

export const adService = new AdService();
export default adService;
