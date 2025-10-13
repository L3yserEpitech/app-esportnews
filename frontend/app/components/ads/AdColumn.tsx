'use client';

import { useMemo, useCallback } from 'react';
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
  ads,
  isSubscribed = false,
  isLoading = false,
  className = ''
}) => {
  // Filtrer les pubs valides et les trier par position
  const activeAds = useMemo(() =>
    ads
      .filter(ad => ad.url && ad.redirect_link)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .slice(0, 3), // Maximum 3 emplacements comme spécifié dans CLAUDE.md
    [ads]
  );

  // Calculer l'espacement dynamique selon le nombre de pubs
  const getSpacingClass = useMemo(() => {
    const adCount = activeAds.length;
    if (adCount === 1) return 'justify-center';
    if (adCount === 2) return 'justify-between';
    return 'justify-between'; // Pour 3 pubs, espacement égal
  }, [activeAds.length]);


  const handlePremiumClick = useCallback(() => {
    // Navigation vers la page d'abonnement
    window.location.href = '/abonnement';
  }, []);

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
          activeAds.map((ad, index) => (
            <AdBanner
              key={ad.id}
              ad={ad}
              position={index + 1}
              isSubscribed={isSubscribed}
              className="w-full flex-shrink-0"
            />
          ))
        )}

        {/* Message d'abonnement si moins de 3 pubs et pas en loading */}
        {!isLoading && activeAds.length < 3 && activeAds.length > 0 && (
          <div className="bg-gradient-to-br from-pink-500/10 to-blue-600/10 border border-pink-500/20 rounded-lg p-4 text-center">
            <h3 className="text-pink-400 font-medium mb-2">
              🎆 Premium
            </h3>
            <p className="text-gray-300 text-sm mb-3">
              Découvrir le premium pour de nombreux avantages
            </p>
            <button
              onClick={handlePremiumClick}
              className="cursor-pointer bg-pink-600 hover:bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Découvrir Premium
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AdColumn;
