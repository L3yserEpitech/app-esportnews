import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Linking, ActivityIndicator, DimensionValue } from 'react-native';
import { Text } from 'react-native-paper';
import { Advertisement } from '@/types';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

interface AdBannerProps {
  /**
   * Publicité à afficher
   */
  ad: Advertisement;

  /**
   * Largeur de la bannière (optionnel)
   */
  width?: DimensionValue;

  /**
   * Hauteur de la bannière (optionnel)
   */
  height?: number;

  /**
   * Afficher le badge "Publicité" (par défaut: true)
   */
  showBadge?: boolean;

  /**
   * Callback appelé lors du clic
   */
  onPress?: () => void;
}

/**
 * Composant pour afficher une bannière publicitaire
 * Récupère les publicités depuis le backend et les affiche
 *
 * @example
 * ```tsx
 * <AdBanner
 *   ad={advertisement}
 *   width="100%"
 *   height={200}
 *   showBadge={true}
 * />
 * ```
 */
export function AdBanner({
  ad,
  width = '100%',
  height = 200,
  showBadge = true,
  onPress,
}: AdBannerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [ad.url]);

  const handlePress = async () => {
    if (onPress) {
      onPress();
    }

    if (ad.redirect_link) {
      try {
        const canOpen = await Linking.canOpenURL(ad.redirect_link);
        if (canOpen) {
          await Linking.openURL(ad.redirect_link);
        } else {
          console.warn('[AdBanner] Cannot open URL:', ad.redirect_link);
        }
      } catch (error) {
        console.error('[AdBanner] Error opening URL:', error);
      }
    }
  };

  if (hasError) {
    return null; // Ne pas afficher si erreur de chargement
  }

  return (
    <TouchableOpacity
      style={[styles.container, { width, height }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Image de la pub */}
      <Image
        source={{ uri: ad.url ?? undefined }}
        style={styles.image}
        resizeMode="cover"
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      )}

      {/* Badge "Publicité" */}
      {showBadge && !isLoading && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Publicité</Text>
        </View>
      )}

      {/* Titre au hover (overlay) */}
      <View style={styles.overlay}>
        <Text style={styles.title} numberOfLines={2}>
          {ad.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: spacing.sm,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: COLORS.textPrimary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});

export default AdBanner;
