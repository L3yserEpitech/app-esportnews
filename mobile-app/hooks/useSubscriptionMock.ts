import { useState, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hook de test pour simuler les achats in-app en développement
 * Permet de tester l'UI et la logique d'abonnement sans compte App Store/Google Play
 *
 * ⚠️ À UTILISER UNIQUEMENT EN DÉVELOPPEMENT
 */

const MOCK_SUBSCRIPTION_KEY = '@mock_subscription_status';

interface MockSubscriptionState {
  products: any[];
  isSubscribed: boolean;
  loading: boolean;
  purchasing: boolean;
  error: string | null;
}

export function useSubscriptionMock() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock products (simule les produits du store)
  const mockProducts = [
    {
      id: Platform.OS === 'ios' ? '13801972972' : 'premium_monthly',
      type: 'subs',
      displayPrice: '0.99€',
      title: 'Abonnement Premium',
      description: 'Abonnement Premium mensuel - Zéro pub et support prioritaire',
      price: '0.99',
      currency: 'EUR',
    },
  ];

  // Charger le statut d'abonnement depuis AsyncStorage
  const loadSubscriptionStatus = useCallback(async () => {
    try {
      setLoading(true);
      const status = await AsyncStorage.getItem(MOCK_SUBSCRIPTION_KEY);
      setIsSubscribed(status === 'true');
      console.log('[MockSubscription] Loaded subscription status:', status);
    } catch (err) {
      console.error('[MockSubscription] Error loading status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialisation
  useEffect(() => {
    loadSubscriptionStatus();
  }, [loadSubscriptionStatus]);

  // Simuler un achat
  const subscribe = useCallback(async (productId?: string) => {
    console.log('[MockSubscription] Starting mock purchase for:', productId);
    setPurchasing(true);
    setError(null);

    // Simuler un délai (comme un vrai achat)
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      // Sauvegarder le statut d'abonnement
      await AsyncStorage.setItem(MOCK_SUBSCRIPTION_KEY, 'true');
      setIsSubscribed(true);
      setPurchasing(false);

      Alert.alert(
        'Succès (Mock)',
        'Votre abonnement Premium est maintenant actif !\n\n⚠️ Ceci est un achat simulé (développement)',
        [{ text: 'OK' }]
      );

      console.log('[MockSubscription] Mock purchase successful');
    } catch (err) {
      console.error('[MockSubscription] Mock purchase error:', err);
      setError('Erreur lors de l\'achat simulé');
      setPurchasing(false);
    }
  }, []);

  // Restaurer les achats (mock)
  const restorePurchases = useCallback(async () => {
    console.log('[MockSubscription] Restoring mock purchases');
    setLoading(true);
    setError(null);

    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const status = await AsyncStorage.getItem(MOCK_SUBSCRIPTION_KEY);
      const hasSubscription = status === 'true';
      setIsSubscribed(hasSubscription);

      if (hasSubscription) {
        Alert.alert(
          'Succès (Mock)',
          'Votre abonnement a été restauré !\n\n⚠️ Ceci est un test simulé',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Info (Mock)',
          'Aucun abonnement actif trouvé\n\n⚠️ Mode test simulé',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('[MockSubscription] Restore error:', err);
      setError('Impossible de restaurer les achats');
      Alert.alert('Erreur', 'Impossible de restaurer les achats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset (pour les tests)
  const resetMockSubscription = useCallback(async () => {
    await AsyncStorage.removeItem(MOCK_SUBSCRIPTION_KEY);
    setIsSubscribed(false);
    console.log('[MockSubscription] Subscription reset');
    Alert.alert('Reset', 'Abonnement mock réinitialisé', [{ text: 'OK' }]);
  }, []);

  return {
    products: mockProducts,
    isSubscribed,
    loading,
    purchasing,
    error,
    subscribe,
    restorePurchases,
    resetMockSubscription, // Fonction bonus pour reset le test
  };
}

export default useSubscriptionMock;
