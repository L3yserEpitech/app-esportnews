import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { AdBanner } from './AdBanner';
import { adService } from '@/services';
import { Advertisement } from '@/types';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';
import { useSubscription } from '@/hooks';

interface AdColumnProps {
  /**
   * Afficher uniquement pour les non-abonnés (par défaut: true)
   */
  hideForSubscribers?: boolean;

  /**
   * Nombre maximum de pubs à afficher (par défaut: 3)
   */
  maxAds?: number;
}

/**
 * Composant pour afficher une colonne de bannières publicitaires
 * Utilisé principalement sur les écrans desktop/tablette
 *
 * @example
 * ```tsx
 * <AdColumn
 *   hideForSubscribers={true}
 *   maxAds={3}
 * />
 * ```
 */
export function AdColumn({ hideForSubscribers = true, maxAds = 3 }: AdColumnProps) {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSubscribed } = useSubscription();

  // Ne pas afficher si l'utilisateur est abonné et hideForSubscribers est activé
  if (hideForSubscribers && isSubscribed) {
    return null;
  }

  useEffect(() => {
    loadAds();
  }, []);

  const loadAds = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const fetchedAds = await adService.getAds();

      // Limiter au nombre maximum
      const limitedAds = fetchedAds.slice(0, maxAds);
      setAds(limitedAds);
    } catch (err) {
      console.error('[AdColumn] Error loading ads:', err);
      setError('Impossible de charger les publicités');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (error || ads.length === 0) {
    return null; // Ne rien afficher si erreur ou pas de pubs
  }

  return (
    <View style={styles.container}>
      {ads.map((ad, index) => (
        <View key={ad.id} style={index > 0 ? styles.adSpacing : undefined}>
          <AdBanner
            ad={ad}
            width="100%"
            height={200}
            showBadge={true}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  adSpacing: {
    marginTop: spacing.md,
  },
});

export default AdColumn;
