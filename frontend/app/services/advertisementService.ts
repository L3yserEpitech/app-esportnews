import { Advertisement } from '../types';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: Advertisement[] | null = null;
let cachedAt = 0;
let inflight: Promise<Advertisement[]> | null = null;

class AdvertisementService {
  private baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  async getActiveAdvertisements(): Promise<Advertisement[]> {
    if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
      return cached;
    }

    if (inflight) {
      return inflight;
    }

    inflight = this.fetchAdvertisements()
      .then((ads) => {
        cached = ads;
        cachedAt = Date.now();
        return ads;
      })
      .catch((error) => {
        if (cached) {
          return cached;
        }
        throw error;
      })
      .finally(() => {
        inflight = null;
      });

    return inflight;
  }

  private async fetchAdvertisements(): Promise<Advertisement[]> {
    const response = await fetch(`${this.baseUrl}/api/ads`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch advertisements: ${response.status}`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data
      .filter((ad: Advertisement) => ad.url && ad.redirect_link)
      .sort((a: Advertisement, b: Advertisement) => (a.position || 0) - (b.position || 0))
      .slice(0, 3);
  }
}

export const advertisementService = new AdvertisementService();