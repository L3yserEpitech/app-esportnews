import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';

// =====================================================
// Configuration AdMob
// =====================================================

/**
 * Récupère l'Ad Unit ID pour les interstitiels
 * En dev : utilise les test IDs de Google
 * En prod : utilise les vrais IDs depuis app.config.js
 */
const getInterstitialAdUnitId = (): string => {
  if (__DEV__) {
    return TestIds.INTERSTITIAL;
  }

  const configuredId = Constants.expoConfig?.extra?.admobInterstitialId;
  return configuredId || TestIds.INTERSTITIAL;
};

// =====================================================
// Context Type Definitions
// =====================================================

interface AdContextState {
  /**
   * Indique si AdMob est initialisé
   */
  isInitialized: boolean;

  /**
   * Indique si une pub interstitielle est prête
   */
  isAdReady: boolean;

  /**
   * Indique si une pub est en cours de chargement
   */
  isLoading: boolean;

  /**
   * Indique si une pub est actuellement affichée
   */
  isAdShowing: boolean;

  /**
   * Affiche une pub interstitielle si elle est prête
   */
  showInterstitial: () => void;

  /**
   * Charge une nouvelle pub interstitielle
   */
  loadInterstitial: () => void;

  /**
   * Demande le consentement GDPR (si nécessaire)
   */
  requestConsent: () => Promise<void>;
}

const AdContext = createContext<AdContextState | undefined>(undefined);

// =====================================================
// Provider Props
// =====================================================

interface AdProviderProps {
  children: ReactNode;
}

// =====================================================
// AdProvider Component
// =====================================================

export function AdProvider({ children }: AdProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAdReady, setIsAdReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdShowing, setIsAdShowing] = useState(false);
  const [interstitial, setInterstitial] = useState<InterstitialAd | null>(null);

  /**
   * Charge une nouvelle pub interstitielle
   */
  const loadInterstitial = useCallback(() => {
    setIsLoading(true);
    setIsAdReady(false);

    const adUnitId = getInterstitialAdUnitId();
    console.log('[AdContext] Loading interstitial with unit ID:', adUnitId);

    const ad = InterstitialAd.createForAdRequest(adUnitId, {
      keywords: ['esport', 'gaming', 'video games', 'tournament', 'competitive gaming'],
    });

    // Listener: pub chargée
    const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      console.log('[AdContext] Interstitial ad loaded successfully');
      setIsAdReady(true);
      setIsLoading(false);
    });

    // Listener: pub affichée
    const unsubscribeOpened = ad.addAdEventListener(AdEventType.OPENED, () => {
      console.log('[AdContext] Interstitial ad opened');
      setIsAdShowing(true);
    });

    // Listener: pub fermée
    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[AdContext] Interstitial ad closed');
      setIsAdShowing(false);
      setIsAdReady(false);
      // Recharger automatiquement une nouvelle pub
      loadInterstitial();
    });

    // Listener: erreur
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error('[AdContext] Interstitial ad error:', error);
      setIsLoading(false);
      setIsAdReady(false);
    });

    // Charger la pub
    ad.load();
    setInterstitial(ad);

    // Cleanup
    return () => {
      unsubscribeLoaded();
      unsubscribeOpened();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  /**
   * Affiche la pub interstitielle si elle est prête
   */
  const showInterstitial = useCallback(() => {
    if (interstitial && isAdReady && !isAdShowing) {
      console.log('[AdContext] Showing interstitial ad');
      interstitial.show();
    } else {
      console.log('[AdContext] Cannot show ad:', {
        hasInterstitial: !!interstitial,
        isAdReady,
        isAdShowing,
      });
    }
  }, [interstitial, isAdReady, isAdShowing]);

  /**
   * Demande le consentement GDPR (placeholder pour future implémentation)
   */
  const requestConsent = useCallback(async () => {
    // TODO: Implémenter le consentement GDPR avec react-native-google-mobile-ads
    // Pour l'instant, pas de gestion du consentement
    console.log('[AdContext] Consent request - not implemented yet');
  }, []);

  const value: AdContextState = {
    isInitialized,
    isAdReady,
    isLoading,
    isAdShowing,
    showInterstitial,
    loadInterstitial,
    requestConsent,
  };

  return <AdContext.Provider value={value}>{children}</AdContext.Provider>;
}

// =====================================================
// useAd Hook
// =====================================================

/**
 * Hook pour accéder au contexte AdMob
 * @throws {Error} Si utilisé en dehors d'un AdProvider
 *
 * @example
 * ```tsx
 * const { isAdReady, showInterstitial } = useAd();
 *
 * useEffect(() => {
 *   if (isAdReady) {
 *     showInterstitial();
 *   }
 * }, [isAdReady]);
 * ```
 */
export function useAd(): AdContextState {
  const context = useContext(AdContext);

  if (!context) {
    throw new Error('useAd must be used within an AdProvider');
  }

  return context;
}
