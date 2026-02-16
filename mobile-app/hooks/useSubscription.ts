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

// Product ID de ton abonnement App Store Connect
const SUBSCRIPTION_SKUS = Platform.select({
  ios: ['13801972972'],
  android: [] as string[],
}) ?? [];

export interface SubscriptionState {
  products: ProductSubscription[];
  isSubscribed: boolean;
  loading: boolean;
  purchasing: boolean;
  error: string | null;
}

export function useSubscription() {
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
          // Finaliser la transaction
          await finishTransaction({ purchase, isConsumable: false });

          // Mettre à jour le statut
          setIsSubscribed(true);
          setPurchasing(false);

          Alert.alert(
            'Succès',
            'Votre abonnement Premium est maintenant actif !',
            [{ text: 'OK' }]
          );
        } catch (finishError) {
          console.error('Error finishing transaction:', finishError);
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
      const hasActiveSubscription = purchases.some(
        (purchase) => SUBSCRIPTION_SKUS.includes(purchase.productId)
      );

      setIsSubscribed(hasActiveSubscription);

      if (hasActiveSubscription) {
        Alert.alert('Succès', 'Votre abonnement a été restauré !');
      } else {
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
