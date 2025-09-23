'use client';

import { useState, useEffect } from 'react';
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
  position,
  isSubscribed = false,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Ne pas afficher les pubs pour les abonnés
    if (isSubscribed || !ad.is_active) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
  }, [isSubscribed, ad.is_active]);

  const handleClick = () => {
    if (ad.redirect_link) {
      // Ouvrir dans un nouvel onglet comme spécifié dans CLAUDE.md
      window.open(ad.redirect_link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleImageError = () => {
    setHasError(true);
  };

  if (!isVisible || hasError) {
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
            aria-label={ad.title}
          >
            <source src={ad.url} type={ad.file_type} />
            <div className="flex items-center justify-center h-32 bg-gray-800 text-gray-400">
              Vidéo non supportée
            </div>
          </video>
        ) : (
          <img
            src={ad.url}
            alt={ad.title}
            className="w-full h-auto max-h-96 object-cover transition-all duration-300 group-hover:brightness-75"
            onError={handleImageError}
            loading="lazy"
          />
        )}

        {/* Overlay avec effet de slide depuis le bas */}
        <div className="absolute bottom-0 left-0 right-0 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
          <div className="bg-gradient-to-t from-black/90 to-transparent p-4">
            <h3 className="text-white text-sm font-semibold mb-1">
              {ad.title}
            </h3>
            <span className="text-xs text-pink-400 font-medium">Publicité</span>
          </div>
        </div>

        {/* Overlay d'assombrissement général au hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
      </div>
    </Card>
  );
};

export default AdBanner;
