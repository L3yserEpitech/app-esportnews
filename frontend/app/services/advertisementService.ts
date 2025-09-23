import { Advertisement } from '../types';

class AdvertisementService {
  private baseUrl = 'https://x8ki-letl-twmt.n7.xano.io/api:kPvIg7bD';

  async getActiveAdvertisements(): Promise<Advertisement[]> {
    try {
      const response = await fetch(`${this.baseUrl}/advertisements_active`, {
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

      // L'API retourne déjà les ads actives, on les trie par position
      return data
        .sort((a: Advertisement, b: Advertisement) => a.position - b.position)
        .slice(0, 3); // Maximum 3 emplacements comme spécifié dans CLAUDE.md

    } catch (error) {
      console.error('Error fetching advertisements:', error);
      return [];
    }
  }
}

export const advertisementService = new AdvertisementService();