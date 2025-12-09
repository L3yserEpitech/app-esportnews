'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Advertisement } from '../../types';
import Card from '../ui/Card';

interface AdBannerProps {
  ad: Advertisement;
  position: number;
  isSubscribed?: boolean;
  className?: string;
}

const AdBanner: React.FC<AdBannerProps> = ({
  ad,
  isSubscribed = false,
  className = ''
}) => {
  // Déterminer la visibilité initiale directement
  const shouldBeVisible = !isSubscribed && !!ad.url && !!ad.redirect_link;
  const [hasError, setHasError] = useState(false);

  // Réinitialiser hasError quand l'URL de la pub change
  useEffect(() => {
    setHasError(false);
  }, [ad.url, ad.id]);

  const handleClick = () => {
    if (ad.redirect_link) {
      // Ouvrir dans un nouvel onglet comme spécifié dans CLAUDE.md
      window.open(ad.redirect_link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleImageError = (e: any) => {
    console.error('[AdBanner] Image load error for ad:', ad.id, 'URL:', ad.url, 'Error:', e);
    setHasError(true);
  };

  if (!shouldBeVisible || hasError) {
    return null;
  }

  return (
    <Card
      variant="outlined"
      padding="none"
      className={`cursor-pointer transition-all duration-300 group ${className}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Publicité: ${ad.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="relative overflow-hidden rounded-lg">
        {ad.type === 'video' ? (
          <video
            className="w-full h-auto max-h-96 object-cover transition-all duration-300 group-hover:brightness-75"
            autoPlay
            muted
            loop
            playsInline
            onError={handleImageError}
            aria-label={ad.title || 'Publicité vidéo'}
          >
            <source src={ad.url || undefined} type="video/mp4" />
            <div className="flex items-center justify-center h-32 bg-bg-tertiary text-text-secondary">
              Vidéo non supportée
            </div>
          </video>
        ) : (
          <div className="relative w-full" style={{ minHeight: '400px' }}>
            <Image
              src={ad.url || ''}
              alt={ad.title || 'Publicité'}
              fill
              className="object-cover transition-all duration-300 group-hover:brightness-75"
              onError={handleImageError}
              loading="lazy"
              sizes="300px"
            />
          </div>
        )}

        {/* Overlay avec effet de slide depuis le bas */}
        <div className="absolute bottom-0 left-0 right-0 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
          <div className="bg-gradient-to-t from-black/90 to-transparent p-4">
            <h3 className="text-white text-sm font-semibold mb-1">
              {ad.title || 'Publicité'}
            </h3>
            <span className="text-xs text-accent font-medium">Publicité</span>
          </div>
        </div>

        {/* Overlay d'assombrissement général au hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
      </div>
    </Card>
  );
};

export default AdBanner;
