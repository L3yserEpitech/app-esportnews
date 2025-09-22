'use client';

import { Advertisement } from '../../types';
import AdBanner from './AdBanner';

interface AdColumnProps {
  ads: Advertisement[];
  isSubscribed?: boolean;
  className?: string;
}

const AdColumn: React.FC<AdColumnProps> = ({
  ads,
  isSubscribed = false,
  className = ''
}) => {
  // Filtrer les pubs actives et les trier par position
  const activeAds = ads
    .filter(ad => ad.is_active)
    .sort((a, b) => a.position - b.position)
    .slice(0, 3); // Maximum 3 emplacements comme spécifié dans CLAUDE.md

  // Ne pas afficher la colonne pour les abonnés
  if (isSubscribed || activeAds.length === 0) {
    return null;
  }

  return (
    <aside
      className={`hidden lg:block w-[300px] flex-shrink-0 ${className}`}
      aria-label="Publicités"
    >
      <div className="sticky top-4 space-y-4">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">
          Nos partenaires
        </h2>
        
        {activeAds.map((ad, index) => (
          <AdBanner
            key={ad.id}
            ad={ad}
            position={index + 1}
            isSubscribed={isSubscribed}
            className="w-full"
          />
        ))}
        
        {/* Message d'abonnement si moins de 3 pubs */}
        {activeAds.length < 3 && (
          <div className="bg-gradient-to-br from-pink-500/10 to-blue-600/10 border border-pink-500/20 rounded-lg p-4 text-center">
            <h3 className="text-pink-400 font-medium mb-2">
              🎆 Experience sans pub
            </h3>
            <p className="text-gray-300 text-sm mb-3">
              Profitez du contenu sans interruption avec notre abonnement premium.
            </p>
            <button className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Découvrir Premium
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AdColumn;
