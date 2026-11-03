'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { analyticsService } from '@/lib/analyticsService';
import { withoutQuery } from '@/app/lib/pageViewUrl';

export function trackedPageView(pathname: string, referrer: string) {
  return { path: pathname, referer: withoutQuery(referrer) || undefined };
}

/**
 * PageViewTracker
 * Composant client qui track automatiquement chaque changement de page
 * Doit être placé dans le layout racine pour couvrir toute l'app
 */
export function PageViewTracker() {
  const pathname = usePathname();

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

        // Envoyer le tracking
        await analyticsService.trackPageView({
          visitor_id: visitorId,
          ...trackedPageView(pathname, document.referrer),
          user_agent: navigator.userAgent,
        });
      } catch (error) {
        console.error('[Analytics] Failed to track page view:', error);
      }
    };

    trackView();
  }, [pathname]);

  // Ce composant ne rend rien
  return null;
}

