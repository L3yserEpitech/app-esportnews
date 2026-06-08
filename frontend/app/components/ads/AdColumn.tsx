'use client';

import { useMemo } from 'react';
import { Advertisement } from '../../types';
import AdBanner from './AdBanner';
import AdSkeleton from '../ui/AdSkeleton';

interface AdColumnProps {
  ads: Advertisement[];
  isSubscribed?: boolean;
  isLoading?: boolean;
  className?: string;
}

const AdColumn: React.FC<AdColumnProps> = ({
  ads = [],
  isSubscribed = false,
  isLoading = false,
  className = ''
}) => {
  // Filtrer les pubs valides et les trier par position
  const activeAds = useMemo(() => {
    const filtered = (ads || [])
      .filter(ad => ad.url && ad.redirect_link)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .slice(0, 3); // Maximum 3 emplacements comme spécifié dans CLAUDE.md

    return filtered;
  }, [ads]);

  // Calculer l'espacement dynamique selon le nombre de pubs
  const getSpacingClass = useMemo(() => {
    const adCount = activeAds.length;
    if (adCount === 1) return 'justify-center';
    if (adCount === 2) return 'justify-between';
    return 'justify-between'; // Pour 3 pubs, espacement égal
  }, [activeAds.length]);


  const shouldShowColumn = useMemo(() =>
    !isSubscribed && (activeAds.length > 0 || isLoading),
    [isSubscribed, activeAds.length, isLoading]
  );

  // Ne pas afficher la colonne pour les abonnés
  if (!shouldShowColumn) {
    return null;
  }

  return (
    <aside
      className={`hidden lg:block w-[300px] flex-shrink-0 ${className}`}
      aria-label="Publicités"
    >
      <div className="sticky top-26 space-y-4">
        {isLoading ? (
          // Afficher les skeletons pendant le chargement
          Array.from({ length: 3 }).map((_, index) => (
            <AdSkeleton key={`ad-skeleton-${index}`} className="w-full flex-shrink-0" />
          ))
        ) : (
          <>
            {console.log('[AdColumn] Rendering', activeAds.length, 'ad banners')}
            {activeAds.map((ad, index) => {
              console.log('[AdColumn] Rendering ad banner for:', ad);
              return (
                <AdBanner
                  key={ad.id}
                  ad={ad}
                  position={index + 1}
                  isSubscribed={isSubscribed}
                  className="w-full flex-shrink-0"
                />
              );
            })}
          </>
        )}

      </div>
    </aside>
  );
};

export default AdColumn;
