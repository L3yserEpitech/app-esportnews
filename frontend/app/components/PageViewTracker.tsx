'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { analyticsService } from '@/lib/analyticsService';

/**
 * PageViewTracker
 * Composant client qui track automatiquement chaque changement de page
 * Doit être placé dans le layout racine pour couvrir toute l'app
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Ne pas tracker en mode développement (optionnel)
    if (process.env.NODE_ENV === 'development') {
      // console.log('[Analytics] Dev mode - skipping tracking');
      // return; // Décommenter pour désactiver en dev
    }

    const trackView = async () => {
      try {
        // Récupérer ou créer le visitor_id
        const visitorId = analyticsService.getOrCreateVisitorID();
        
        if (!visitorId) {
          console.warn('[Analytics] No visitor ID available (SSR?)');
          return;
        }

        // Construire le path complet avec query params
        const fullPath = searchParams.toString() 
          ? `${pathname}?${searchParams.toString()}`
          : pathname;

        // Envoyer le tracking
        await analyticsService.trackPageView({
          visitor_id: visitorId,
          path: fullPath,
          referer: document.referrer || undefined,
          user_agent: navigator.userAgent,
        });

        // console.log('[Analytics] Page view tracked:', fullPath);
      } catch (error) {
        console.error('[Analytics] Failed to track page view:', error);
      }
    };

    trackView();
  }, [pathname, searchParams]);

  // Ce composant ne rend rien
  return null;
}

