/**
 * Analytics API Service
 * Gère le tracking des visiteurs et la récupération des statistiques
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// Types
export interface TrackPageViewInput {
  visitor_id: string;
  path: string;
  referer?: string;
  user_agent?: string;
}

export interface VisitorBreakdown {
  date: string;
  visitors: number;
  views: number;
}

export interface VisitorStats {
  timeline: string;
  total_visitors: number;
  total_pageviews: number;
  avg_per_day: number;
  breakdown: VisitorBreakdown[];
}

export interface RegistrationBreakdown {
  date: string;
  count: number;
}

export interface RegistrationStats {
  timeline: string;
  total_users: number;
  avg_per_day: number;
  breakdown: RegistrationBreakdown[];
}

export interface AnalyticsSummary {
  timeline: string;
  visitors: VisitorStats;
  registrations: RegistrationStats;
}

export interface AgeStats {
  age_range: string; // "0-16", "16-25", "25-40", "40-60", "60+"
  count: number;
}

export interface AgeDistribution {
  total_users: number;
  breakdown: AgeStats[];
}

export type Timeline = '24h' | 'day' | 'week' | 'month' | 'year';

/**
 * Service de gestion des analytics
 */
export const analyticsService = {
  /**
   * Enregistre une page view (tracking public)
   * Appelé automatiquement par le layout à chaque changement de page
   */
  trackPageView: async (input: TrackPageViewInput): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        credentials: 'include', // Pour inclure les cookies de session
      });

      if (!response.ok) {
        console.error('Failed to track page view:', response.statusText);
      }
    } catch (error) {
      console.error('Error tracking page view:', error);
      // Ne pas throw - le tracking ne doit pas bloquer l'app
    }
  },

  /**
   * Récupère les statistiques de visiteurs (admin only)
   */
  getVisitorStats: async (timeline: Timeline = '24h', token?: string): Promise<VisitorStats> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/analytics/visitors?timeline=${timeline}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to get visitor stats: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  },

  /**
   * Récupère les statistiques d'inscriptions (admin only)
   */
  getRegistrationStats: async (timeline: Timeline = 'week', token?: string): Promise<RegistrationStats> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/analytics/registrations?timeline=${timeline}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to get registration stats: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  },

  /**
   * Récupère un résumé combiné (visiteurs + inscriptions) (admin only)
   */
  getSummary: async (timeline: Timeline = '24h', token?: string): Promise<AnalyticsSummary> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/analytics/summary?timeline=${timeline}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to get analytics summary: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  },

  /**
   * Exporte les données analytics en CSV (admin only)
   */
  exportCSV: async (timeline: Timeline = 'week', token?: string): Promise<Blob> => {
    const headers: HeadersInit = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/analytics/export?timeline=${timeline}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to export analytics: ${response.statusText}`);
    }

    return await response.blob();
  },

  /**
   * Récupère la distribution d'âge des utilisateurs (admin only)
   */
  getAgeDistribution: async (token?: string): Promise<AgeDistribution> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/analytics/age-distribution`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to get age distribution: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  },

  /**
   * Génère ou récupère le visitor_id depuis localStorage
   * UUID v4 anonyme stocké localement
   */
  getOrCreateVisitorID: (): string => {
    if (typeof window === 'undefined') return ''; // SSR

    const STORAGE_KEY = 'esportnews_visitor_id';
    let visitorId = localStorage.getItem(STORAGE_KEY);

    if (!visitorId) {
      // Générer un UUID v4
      visitorId = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, visitorId);
    }

    return visitorId;
  },
};

