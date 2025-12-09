import { Advertisement } from '../types';

class AdvertisementService {
  private baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

  async getActiveAdvertisements(): Promise<Advertisement[]> {
    try {
      // Ajouter un timestamp pour éviter le cache du navigateur
      const timestamp = Date.now();
      const response = await fetch(`${this.baseUrl}/api/ads?t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch advertisements: ${response.status}`);
      }

      const data = await response.json();

      console.log('[AdvertisementService] Raw data from API:', data);

      // Vérifier que data est un array valide
      if (!data || !Array.isArray(data)) {
        console.log('[AdvertisementService] Data is not an array:', data);
        return [];
      }

      console.log('[AdvertisementService] Number of ads received:', data.length);

      // Trier par position et limiter à 3 emplacements maximum
      const filteredAds = data.filter((ad: Advertisement) => {
        const isValid = ad.url && ad.redirect_link;
        if (!isValid) {
          console.log('[AdvertisementService] Invalid ad filtered out:', ad);
        }
        return isValid;
      });

      console.log('[AdvertisementService] Ads after filtering:', filteredAds.length);

      const sortedAds = filteredAds
        .sort((a: Advertisement, b: Advertisement) => (a.position || 0) - (b.position || 0))
        .slice(0, 3);

      console.log('[AdvertisementService] Final ads to return:', sortedAds);

      return sortedAds;

    } catch (error) {
      console.error('Error fetching advertisements:', error);
      return [];
    }
  }
}

export const advertisementService = new AdvertisementService();