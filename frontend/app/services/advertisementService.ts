import { Advertisement } from '../types';

class AdvertisementService {
  private baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

  async getActiveAdvertisements(): Promise<Advertisement[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ads`, {
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

      // Vérifier que data est un array valide
      if (!data || !Array.isArray(data)) {
        return [];
      }

      // Trier par position et limiter à 3 emplacements maximum
      return data
        .filter((ad: Advertisement) => ad.url && ad.redirect_link) // Filtrer les ads valides
        .sort((a: Advertisement, b: Advertisement) => (a.position || 0) - (b.position || 0))
        .slice(0, 3);

    } catch (error) {
      console.error('Error fetching advertisements:', error);
      return [];
    }
  }
}

export const advertisementService = new AdvertisementService();