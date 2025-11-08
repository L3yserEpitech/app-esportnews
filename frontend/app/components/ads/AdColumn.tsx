'use client';

import { useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations();
  // Filtrer les pubs valides et les trier par position
  const activeAds = useMemo(() =>
    (ads || [])
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
          <div
            className="rounded-lg p-4 text-center border"
            style={{
              backgroundImage: 'linear-gradient(to bottom right, rgba(var(--accent-rgb), 0.1), rgba(3, 105, 161, 0.1))',
              borderColor: 'rgba(var(--accent-rgb), 0.2)',
            }}
          >
            <h3
              className="font-medium mb-2"
              style={{ color: 'var(--color-accent)' }}
            >
              {t('pages.home.ads.premium_title')}
            </h3>
            <p className="text-text-secondary text-sm mb-3">
              {t('pages.home.ads.premium_description')}
            </p>
            <button
              onClick={handlePremiumClick}
              className="cursor-pointer text-text-inverse px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--color-accent-hover)',
              }}
            >
              {t('pages.home.ads.discover_premium_button')}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AdColumn;
