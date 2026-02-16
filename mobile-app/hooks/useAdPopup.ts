import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';
import { adCooldownService } from '@/services/adCooldownService';

// =====================================================
// Configuration des Ad Unit IDs
// En production, utiliser les vrais IDs depuis app.config.js
// En dev/test, utiliser les IDs de test Google
// =====================================================
const getInterstitialAdUnitId = (): string => {
  // Toujours utiliser les IDs de test en développement
  if (__DEV__) {
    return TestIds.INTERSTITIAL;
  }

  // En production, utiliser l'ID configuré ou fallback sur test
  const configuredId = Constants.expoConfig?.extra?.admobInterstitialId;
  return configuredId || TestIds.INTERSTITIAL;
};

interface UseAdPopupOptions {
  /**
   * Empêcher l'affichage si l'utilisateur est abonné
   * @default false
   */
  skipIfSubscribed?: boolean;

  /**
   * Statut d'abonnement de l'utilisateur (passé depuis useSubscription)
   */
  isSubscribed?: boolean;

  /**
   * Callback appelé après la fermeture du popup
   */
  onClose?: () => void;

  /**
   * Callback appelé après l'affichage du popup
   */
  onShow?: () => void;
}

interface UseAdPopupReturn {
  /**
   * Indique si la pub est prête à être affichée
   */
  isAdReady: boolean;

  /**
   * Indique si le chargement est en cours
   */
  isLoading: boolean;

  /**
   * Afficher la pub interstitielle AdMob
   */
  showAd: () => void;

  /**
   * Recharger une nouvelle pub
   */
  loadAd: () => void;
}

/**
 * Hook pour gérer les publicités interstitielles AdMob
 * Inclut un système de cooldown de 5 minutes entre chaque pub
 *
 * @example
 * ```tsx
 * const { isAdReady, showAd } = useAdPopup({
 *   skipIfSubscribed: true,
 *   isSubscribed: userIsSubscribed
 * });
 *
 * // Afficher manuellement la pub
 * showAd();
 * ```
 */
export function useAdPopup(options: UseAdPopupOptions = {}): UseAdPopupReturn {
  const {
    skipIfSubscribed = false,
    isSubscribed = false,
    onClose,
    onShow,
  } = options;

  const [isAdReady, setIsAdReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Refs pour stocker l'instance
  const interstitialRef = useRef<InterstitialAd | null>(null);
  const unsubscribeLoadedRef = useRef<(() => void) | null>(null);
  const unsubscribeClosedRef = useRef<(() => void) | null>(null);

  /**
   * Crée et charge une nouvelle pub interstitielle
   */
  const loadAd = useCallback(() => {
    // Ne pas charger si l'utilisateur est abonné
    if (skipIfSubscribed && isSubscribed) {
      console.log('[useAdPopup] Skipping ad load - user is subscribed');
      return;
    }

    setIsLoading(true);
    setIsAdReady(false);

    // Nettoyer les anciens listeners
    if (unsubscribeLoadedRef.current) {
      unsubscribeLoadedRef.current();
    }
    if (unsubscribeClosedRef.current) {
      unsubscribeClosedRef.current();
    }

    // Créer une nouvelle instance d'interstitiel
    const adUnitId = getInterstitialAdUnitId();
    console.log('[useAdPopup] Loading ad with unit ID:', adUnitId);

    const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      keywords: ['esport', 'gaming', 'video games', 'tournament'],
      requestNonPersonalizedAdsOnly: true, // Aide à éviter les pubs vidéo
    });

    interstitialRef.current = interstitial;

    // Listener quand la pub est chargée
    unsubscribeLoadedRef.current = interstitial.addAdEventListener(
      AdEventType.LOADED,
      () => {
        console.log('[useAdPopup] Ad loaded successfully');
        console.log('[useAdPopup] Ad Unit ID:', adUnitId);
        console.log('[useAdPopup] Is Test Ad:', __DEV__ ? 'YES (Test ID)' : 'NO (Production ID)');
        setIsAdReady(true);
        setIsLoading(false);
      }
    );

    // Listener quand la pub est fermée
    unsubscribeClosedRef.current = interstitial.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        console.log('[useAdPopup] Ad closed by user');
        setIsAdReady(false);
        onClose?.();
        // Recharger automatiquement une nouvelle pub (mais ne pas l'afficher)
        // L'affichage sera manuel via showAd()
        loadAd();
      }
    );

    // Listener: pub affichée
    const unsubscribeOpened = interstitial.addAdEventListener(
      AdEventType.OPENED,
      () => {
        console.log('[useAdPopup] Ad opened - displaying full screen');
        console.log('[useAdPopup] 💡 TIP: If this is a video ad, wait for it to finish or look for the X button (top-right)');
      }
    );

    // Listener pour les erreurs
    const unsubscribeError = interstitial.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.error('[useAdPopup] Ad error:', error);
        setIsLoading(false);
        setIsAdReady(false);
      }
    );

    // Charger la pub
    interstitial.load();

    // Cleanup des listeners
    return () => {
      unsubscribeOpened();
      unsubscribeError();
    };
  }, [skipIfSubscribed, isSubscribed, onClose]);

  /**
   * Affiche la pub si elle est prête ET si le cooldown est respecté
   */
  const showAd = useCallback(async () => {
    // Ne pas afficher si l'utilisateur est abonné
    if (skipIfSubscribed && isSubscribed) {
      console.log('[useAdPopup] Skipping ad show - user is subscribed');
      return;
    }

    // Vérifier le cooldown (5 minutes minimum entre chaque pub)
    const canShow = await adCooldownService.canShowAd();
    if (!canShow) {
      const remaining = await adCooldownService.getRemainingCooldown();
      console.log(`[useAdPopup] Cooldown actif - ${remaining}s restantes avant prochaine pub`);
      return;
    }

    if (interstitialRef.current && isAdReady) {
      console.log('[useAdPopup] Showing interstitial ad');
      interstitialRef.current.show();
      // Enregistrer le timestamp de la pub affichée
      await adCooldownService.markAdShown();
      onShow?.();
    } else {
      console.log('[useAdPopup] Ad not ready yet');
    }
  }, [isAdReady, skipIfSubscribed, isSubscribed, onShow]);

  /**
   * Charger la pub au montage
   */
  useEffect(() => {
    loadAd();

    // Cleanup au démontage
    return () => {
      if (unsubscribeLoadedRef.current) {
        unsubscribeLoadedRef.current();
      }
      if (unsubscribeClosedRef.current) {
        unsubscribeClosedRef.current();
      }
    };
  }, []);

  return {
    isAdReady,
    isLoading,
    showAd,
    loadAd,
  };
}

export default useAdPopup;
