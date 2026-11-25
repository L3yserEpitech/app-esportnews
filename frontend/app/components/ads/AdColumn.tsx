'use client';

import { Advertisement } from '../../types';
import AdSpot from './AdSpot';
import AdSkeleton from '../ui/AdSkeleton';

interface AdColumnProps {
  ads: Advertisement[];
  isSubscribed?: boolean;
  isLoading?: boolean;
  className?: string;
}

const SPOTS = ['sidebar-1', 'sidebar-2', 'sidebar-3'] as const;

// Right column, desktop only: three placements, each one a custom banner or an
// AdSense unit (see AdSpot).
const AdColumn: React.FC<AdColumnProps> = ({ ads = [], isSubscribed = false, isLoading = false, className = '' }) => {
  if (isSubscribed) return null;

  return (
    <aside className={`ad-column hidden lg:block w-[300px] flex-shrink-0 ${className}`} aria-label="Publicités">
      <div className="sticky top-26 space-y-4">
        {isLoading
          ? SPOTS.map((id) => <AdSkeleton key={id} className="ad-skeleton w-full flex-shrink-0" />)
          : SPOTS.map((id) => <AdSpot key={id} id={id} legacyAds={ads} />)}
      </div>
    </aside>
  );
};

export default AdColumn;
