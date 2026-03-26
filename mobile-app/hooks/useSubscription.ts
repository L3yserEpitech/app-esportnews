import { useEffect, useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import {
  initConnection,
  endConnection,
  purchaseUpdatedListener,
  purchaseErrorListener,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  ProductSubscription,
  PurchaseError,
  Purchase,
  ErrorCode,
} from 'react-native-iap';
import { useSubscriptionMock } from './useSubscriptionMock';
import { subscriptionService } from '@/services';

// =====================================================
// Configuration Mode Mock (Développement sans appareil)
// =====================================================
// ⚠️ Activer UNIQUEMENT pour tester sur émulateur Android sans appareil physique
// ⚠️ DÉSACTIVER en production (mettre false)
const USE_MOCK_SUBSCRIPTION = __DEV__ && Platform.OS === 'android' && false;

// Product IDs par plateforme
const SUBSCRIPTION_SKUS = Platform.select({
  ios: ['13801972972'],
  android: ['premium_monthly'],
}) ?? [];

export interface SubscriptionState {
  products: ProductSubscription[];
  isSubscribed: boolean;
  loading: boolean;
  purchasing: boolean;
  error: string | null;
}

export function useSubscription() {
  // Mode Mock pour tester sans appareil physique (développement uniquement)
  if (USE_MOCK_SUBSCRIPTION) {
    console.log('⚠️ [useSubscription] Using MOCK mode (no real purchases)');
    return useSubscriptionMock();
  }
  const [products, setProducts] = useState<ProductSubscription[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let purchaseUpdateSubscription: { remove: () => void } | null = null;
    let purchaseErrorSubscription: { remove: () => void } | null = null;

    const init = async () => {
      try {
        // Initialiser la connexion au store
        await initConnection();

        // Récupérer les produits disponibles (type: 'subs' pour les abonnements)
        if (SUBSCRIPTION_SKUS.length > 0) {
          const fetchedProducts = await fetchProducts({
            skus: SUBSCRIPTION_SKUS,
            type: 'subs',
          });

          // Filtrer uniquement les abonnements
          if (fetchedProducts) {
            const subscriptions: ProductSubscription[] = [];
            for (const p of fetchedProducts) {
              if (p.type === 'subs') {
                subscriptions.push(p as ProductSubscription);
              }
            }
            setProducts(subscriptions);
          }
        }

        // Vérifier si l'utilisateur a déjà un abonnement actif
        const purchases = await getAvailablePurchases();
        const hasActiveSubscription = purchases.some(
          (purchase) => SUBSCRIPTION_SKUS.includes(purchase.productId)
        );
        setIsSubscribed(hasActiveSubscription);

      } catch (err) {
        console.error('IAP initialization error:', err);
        setError('Impossible de charger les abonnements');
      } finally {
        setLoading(false);
      }
    };

    // Listener pour les achats réussis
    purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: Purchase) => {
      const receipt = purchase.purchaseToken;

      if (receipt) {
        try {
          // 1. Valider le reçu côté serveur pour synchroniser le statut premium en DB
          try {
            await subscriptionService.validateReceipt({
              transactionId: purchase.transactionId ?? undefined,
              productId: purchase.productId,
              purchaseToken: purchase.purchaseToken ?? undefined,
            });
            console.log('[useSubscription] Backend validation successful');
          } catch (backendError) {
            // Si le backend échoue (réseau, serveur down), on continue quand même
            // L'utilisateur a payé, le backend re-validera au prochain restore
            console.warn('[useSubscription] Backend validation failed, continuing:', backendError);
          }

          // 2. Finaliser la transaction avec le store
          await finishTransaction({ purchase, isConsumable: false });

          // 3. Mettre à jour le statut local
          setIsSubscribed(true);
          setPurchasing(false);

          Alert.alert(
            'Succès',
            'Votre abonnement Premium est maintenant actif !',
            [{ text: 'OK' }]
          );
        } catch (finishError) {
          console.error('Error finishing transaction:', finishError);
          // Même en cas d'erreur de finishTransaction, marquer comme abonné
          // car le paiement a été effectué
          setIsSubscribed(true);
          setPurchasing(false);
        }
      }
    });

    // Listener pour les erreurs d'achat
    purchaseErrorSubscription = purchaseErrorListener((err: PurchaseError) => {
      console.error('Purchase error:', err);
      setPurchasing(false);

      // Ne pas afficher d'erreur si l'utilisateur a annulé
      if (err.code !== ErrorCode.UserCancelled) {
        setError(err.message || 'Erreur lors de l\'achat');
        Alert.alert('Erreur', err.message || 'Une erreur est survenue lors de l\'achat');
      }
    });

    init();

    // Cleanup
    return () => {
      purchaseUpdateSubscription?.remove();
      purchaseErrorSubscription?.remove();
      endConnection();
    };
  }, []);

  const subscribe = useCallback(async (productId?: string) => {
    const sku = productId || products[0]?.id;

    if (!sku) {
      Alert.alert('Erreur', 'Aucun abonnement disponible');
      return;
    }

    setPurchasing(true);
    setError(null);

    try {
      // Nouvelle API v14 : requestPurchase avec type 'subs'
      await requestPurchase({
        type: 'subs',
        request: {
          apple: { sku },
          google: { skus: [sku] },
        },
      });
    } catch (err) {
      console.error('Subscription request error:', err);
      setPurchasing(false);
      setError('Impossible de lancer l\'achat');
    }
  }, [products]);

  const restorePurchases = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const purchases = await getAvailablePurchases();
      const activePurchase = purchases.find(
        (purchase) => SUBSCRIPTION_SKUS.includes(purchase.productId)
      );

      if (activePurchase) {
        // Valider avec le backend pour synchroniser le statut premium en DB
        try {
          await subscriptionService.validateReceipt({
            transactionId: activePurchase.transactionId ?? undefined,
            productId: activePurchase.productId,
            purchaseToken: activePurchase.purchaseToken ?? undefined,
          });
          console.log('[useSubscription] Backend restore validation successful');
        } catch (backendError) {
          // Le store dit que c'est valide, on continue même si le backend échoue
          console.warn('[useSubscription] Backend restore validation failed:', backendError);
        }

        setIsSubscribed(true);
        Alert.alert('Succès', 'Votre abonnement a été restauré !');
      } else {
        setIsSubscribed(false);
        Alert.alert('Info', 'Aucun abonnement actif trouvé');
      }
    } catch (err) {
      console.error('Restore error:', err);
      setError('Impossible de restaurer les achats');
      Alert.alert('Erreur', 'Impossible de restaurer les achats');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    products,
    isSubscribed,
    loading,
    purchasing,
    error,
    subscribe,
    restorePurchases,
  };
}
