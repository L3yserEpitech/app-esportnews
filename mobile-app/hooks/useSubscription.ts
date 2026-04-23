import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useAuth } from '@/hooks/useAuth';

// Clé AsyncStorage pour persister l'intention d'achat à travers un force-kill.
// Si l'user clique "S'abonner", confirme Face ID, mais kill l'app avant que
// finishTransaction ne passe, Apple rejouera l'event au prochain démarrage.
// On doit alors valider l'achat avec le backend — mais sans ce flag on
// confondrait avec un replay sandbox d'un autre compte de test.
const PURCHASE_INTENT_KEY = '@esport/purchase_intent';
const PURCHASE_INTENT_TTL_MS = 15 * 60 * 1000; // 15 minutes

async function writePurchaseIntent(productId: string): Promise<void> {
  try {
    const payload = JSON.stringify({ productId, ts: Date.now() });
    await AsyncStorage.setItem(PURCHASE_INTENT_KEY, payload);
  } catch (e) {
    console.warn('[useSubscription] Failed to persist purchase intent:', e);
  }
}

async function clearPurchaseIntent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PURCHASE_INTENT_KEY);
  } catch {
    // no-op
  }
}

async function readRecentPurchaseIntent(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PURCHASE_INTENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { ts?: number };
    if (typeof parsed.ts !== 'number') return false;
    const fresh = Date.now() - parsed.ts < PURCHASE_INTENT_TTL_MS;
    if (!fresh) {
      await clearPurchaseIntent();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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
  const { user } = useAuth();
  const serverPremium = user?.premium === true;

  const [products, setProducts] = useState<ProductSubscription[]>([]);
  const [iapSubscribed, setIapSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vrai uniquement si l'utilisateur a cliqué "S'abonner" pendant cette session.
  // Évite que le sandbox Apple ne rejoue d'anciennes transactions au démarrage
  // et marque un nouveau compte comme premium sans interaction.
  const hasInitiatedPurchase = useRef(false);

  // Dédup les events de purchase par transactionId pendant la session, pour
  // éviter une double-validation backend si Apple refire le même event.
  const processedTxIds = useRef<Set<string>>(new Set());

  // Premium = serveur (user.premium) OU achat IAP en cours de session
  const isSubscribed = serverPremium || iapSubscribed;

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

        // Ne PAS appeler getAvailablePurchases() au démarrage.
        // En sandbox Apple, cette fonction retourne tous les achats (y compris expirés),
        // ce qui fait que tous les utilisateurs apparaissent comme Premium.
        // Le statut premium est déterminé par :
        //   - user.premium du backend (pour les utilisateurs connectés, via AuthContext)
        //   - le purchase listener (pour les achats en cours de session)
        //   - le bouton "Restaurer mes achats" (action explicite)
        setIapSubscribed(false);

      } catch (err) {
        console.error('IAP initialization error:', err);
        setError('Impossible de charger les abonnements');
      } finally {
        setLoading(false);
      }
    };

    // Listener pour les achats réussis
    purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: Purchase) => {
      const txId = purchase.transactionId ?? '';

      // 1) Dédup intra-session : si on a déjà traité cette transaction,
      // juste finaliser pour qu'Apple arrête de la rejouer.
      if (txId && processedTxIds.current.has(txId)) {
        try {
          await finishTransaction({ purchase, isConsumable: false });
        } catch (e) {
          console.warn('[useSubscription] Failed to re-finish known tx:', e);
        }
        return;
      }

      // 2) Contrôle d'intention : l'event est-il légitime ?
      // - hasInitiatedPurchase.current : user a tapé "S'abonner" dans CETTE session
      // - AsyncStorage intent récent : user a tapé "S'abonner" dans une session
      //   précédente qui a été killée avant la finalisation (force-kill pendant
      //   le paiement Apple, crash, etc.)
      // - Sinon : c'est un replay sandbox d'un autre compte — on ignore.
      const intentIsCurrent = hasInitiatedPurchase.current;
      const intentIsPersisted = !intentIsCurrent && (await readRecentPurchaseIntent());
      const shouldProcess = intentIsCurrent || intentIsPersisted;

      if (!shouldProcess) {
        console.log('[useSubscription] Ignoring replayed purchase:', purchase.productId);
        try {
          await finishTransaction({ purchase, isConsumable: false });
        } catch (e) {
          console.warn('[useSubscription] Failed to finish replayed transaction:', e);
        }
        return;
      }

      // 3) Valider le reçu côté serveur. On NE marque PAS premium local tant
      // que le backend n'a pas confirmé — évite les désyncs UI/DB visibles
      // par Apple reviewer.
      let backendValidated = false;
      try {
        await subscriptionService.validateReceipt({
          transactionId: purchase.transactionId ?? undefined,
          productId: purchase.productId,
          purchaseToken: purchase.purchaseToken ?? undefined,
        });
        backendValidated = true;
        console.log('[useSubscription] Backend validation successful');
      } catch (backendError) {
        console.warn('[useSubscription] Backend validation failed:', backendError);
      }

      // 4) Finaliser la transaction côté store (peu importe que le backend
      // ait réussi — l'user a payé). Apple arrêtera de rejouer l'event.
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch (finishError) {
        console.error('[useSubscription] finishTransaction failed:', finishError);
      }

      // 5) Nettoyer l'intent et marquer la tx comme traitée.
      if (txId) processedTxIds.current.add(txId);
      hasInitiatedPurchase.current = false;
      await clearPurchaseIntent();
      setPurchasing(false);

      // 6) Mettre à jour l'UI en fonction du résultat backend.
      if (backendValidated) {
        setIapSubscribed(true);
        Alert.alert(
          'Succès',
          'Votre abonnement Premium est maintenant actif !',
          [{ text: 'OK' }]
        );
      } else {
        // Paiement OK côté Apple mais serveur injoignable. On NE ment PAS à
        // l'user : il doit synchroniser via "Restaurer mes achats" plus tard.
        Alert.alert(
          'Achat effectué',
          "Votre paiement a bien été reçu par Apple, mais la synchronisation avec notre serveur a échoué. Reconnectez-vous à Internet puis utilisez « Restaurer mes achats » pour activer votre Premium.",
          [{ text: 'OK' }]
        );
      }
    });

    // Listener pour les erreurs d'achat
    purchaseErrorSubscription = purchaseErrorListener((err: PurchaseError) => {
      setPurchasing(false);
      hasInitiatedPurchase.current = false;
      void clearPurchaseIntent();

      // Annulation user = cas normal, pas une erreur → log discret
      if (err.code === ErrorCode.UserCancelled) {
        console.log('[useSubscription] User cancelled the purchase flow');
        return;
      }

      // Vraie erreur : log + alerte
      console.warn('[useSubscription] Purchase error:', err);
      setError(err.message || 'Erreur lors de l\'achat');
      Alert.alert('Erreur', err.message || 'Une erreur est survenue lors de l\'achat');
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
    hasInitiatedPurchase.current = true;
    // Persister l'intention pour survivre à un force-kill pendant Face ID.
    await writePurchaseIntent(sku);

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
      hasInitiatedPurchase.current = false;
      await clearPurchaseIntent();
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
        // Valider avec le backend — le serveur est la source de vérité.
        // On NE bascule JAMAIS en premium local sans confirmation serveur
        // (évite qu'un utilisateur avec backend KO voie "abonné" alors que
        // `user.premium` reste false en DB → désynchro visible).
        try {
          const result = await subscriptionService.validateReceipt({
            transactionId: activePurchase.transactionId ?? undefined,
            productId: activePurchase.productId,
            purchaseToken: activePurchase.purchaseToken ?? undefined,
          });

          if (result.premium) {
            setIapSubscribed(true);
            Alert.alert('Succès', 'Votre abonnement a été restauré !');
          } else {
            setIapSubscribed(false);
            Alert.alert('Info', 'Votre abonnement a expiré.');
          }
        } catch (backendError) {
          console.warn('[useSubscription] Backend restore validation failed:', backendError);
          setIapSubscribed(false);
          Alert.alert(
            'Erreur réseau',
            "Impossible de valider votre abonnement auprès du serveur. Vérifiez votre connexion et réessayez."
          );
        }
      } else {
        setIapSubscribed(false);
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
