'use client';

import { useEffect, useState } from 'react';
import { Advertisement } from '@/app/types';
import { advertisementService } from '@/app/services/advertisementService';
import AdColumn from '@/app/components/ads/AdColumn';

export default function ArticleSidebar() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    advertisementService
      .getActiveAdvertisements()
      .then((fetched) => {
        if (!cancelled) setAds(fetched);
      })
      .catch((error) => {
        console.error('Erreur lors du chargement des publicités:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <AdColumn ads={ads} isSubscribed={false} isLoading={isLoading} />;
}
