# AdMob Integration Guide

Ce document décrit l'intégration complète d'AdMob dans l'application mobile Esport News.

## Table des matières

1. [Configuration](#configuration)
2. [Architecture](#architecture)
3. [Utilisation](#utilisation)
4. [Composants disponibles](#composants-disponibles)
5. [Hooks disponibles](#hooks-disponibles)
6. [Tests](#tests)
7. [Troubleshooting](#troubleshooting)

---

## Configuration

### Variables d'environnement

Les IDs AdMob sont définis dans le fichier `.env` :

```env
# App ID iOS
ADMOB_IOS_APP_ID=ca-app-pub-5118678813787741~6090534381

# App ID Android
ADMOB_ANDROID_APP_ID=ca-app-pub-5118678813787741~6893939034

# Ad Unit ID - Interstitiel
ADMOB_INTERSTITIAL_ID=ca-app-pub-5118678813787741/1903877366
```

### Configuration app.config.js

Les IDs sont injectés automatiquement dans `app.config.js` :

```javascript
ios: {
  infoPlist: {
    GADApplicationIdentifier: process.env.ADMOB_IOS_APP_ID,
    SKAdNetworkItems: [...] // Liste complète des SKAdNetwork IDs
  }
}

plugins: [
  [
    "react-native-google-mobile-ads",
    {
      androidAppId: process.env.ADMOB_ANDROID_APP_ID,
      iosAppId: process.env.ADMOB_IOS_APP_ID
    }
  ]
]
```

---

## Architecture

### Initialisation (app/_layout.tsx)

L'initialisation du SDK AdMob se fait au niveau racine de l'application :

```tsx
import mobileAds from 'react-native-google-mobile-ads';

useEffect(() => {
  mobileAds()
    .initialize()
    .then((adapterStatuses) => {
      console.log('[AdMob] SDK initialized successfully');
    })
    .catch((error) => {
      console.error('[AdMob] SDK initialization failed:', error);
    });
}, []);
```

### Contexte Global (contexts/AdContext.tsx)

Le `AdProvider` gère l'état global des publicités :

- **État** : `isInitialized`, `isAdReady`, `isLoading`, `isAdShowing`
- **Actions** : `showInterstitial()`, `loadInterstitial()`, `requestConsent()`

### Hiérarchie des Providers

```tsx
<SafeAreaProvider>
  <PaperProvider>
    <LocaleProvider>
      <AuthProvider>
        <GameProvider>
          <AdProvider> {/* AdMob Context */}
            <App />
          </AdProvider>
        </GameProvider>
      </AuthProvider>
    </LocaleProvider>
  </PaperProvider>
</SafeAreaProvider>
```

---

## Utilisation

### 1. Publicité Interstitielle (Popup) - Méthode Simple

**Utiliser `useAdPopup` pour un affichage automatique :**

```tsx
import { useAdPopup, useSubscription } from '@/hooks';

export default function HomeScreen() {
  const { isSubscribed } = useSubscription();

  // Configuration du popup publicitaire
  useAdPopup({
    autoShow: true,           // Affichage automatique
    delay: 2000,              // Délai de 2 secondes
    skipIfSubscribed: true,   // Ne pas afficher aux abonnés
    isSubscribed,             // Statut d'abonnement
  });

  return <View>...</View>;
}
```

### 2. Publicité Interstitielle - Méthode Avancée

**Utiliser `useAd` pour un contrôle manuel :**

```tsx
import { useAd } from '@/hooks';

export default function ArticleScreen() {
  const { isAdReady, showInterstitial, loadInterstitial } = useAd();

  useEffect(() => {
    // Charger une pub au montage
    loadInterstitial();
  }, []);

  const handleReadComplete = () => {
    // Afficher la pub quand l'utilisateur termine l'article
    if (isAdReady) {
      showInterstitial();
    }
  };

  return (
    <View>
      <Article onReadComplete={handleReadComplete} />
    </View>
  );
}
```

### 3. Bannières Publicitaires (Backend)

**Afficher une bannière depuis le backend :**

```tsx
import { AdBanner } from '@/components/features';
import { adService } from '@/services';

export default function TournamentScreen() {
  const [ad, setAd] = useState<Advertisement | null>(null);

  useEffect(() => {
    // Récupérer une pub aléatoire
    adService.getRandomAd().then(setAd);
  }, []);

  return (
    <View>
      <TournamentDetails />

      {/* Bannière publicitaire */}
      {ad && (
        <AdBanner
          ad={ad}
          width="100%"
          height={200}
          showBadge={true}
        />
      )}
    </View>
  );
}
```

### 4. Colonne de Publicités

**Afficher plusieurs bannières dans une colonne :**

```tsx
import { AdColumn } from '@/components/features';

export default function NewsScreen() {
  return (
    <View style={{ flexDirection: 'row' }}>
      {/* Contenu principal */}
      <View style={{ flex: 1 }}>
        <NewsList />
      </View>

      {/* Colonne de pubs (desktop) */}
      <View style={{ width: 300 }}>
        <AdColumn
          hideForSubscribers={true}
          maxAds={3}
        />
      </View>
    </View>
  );
}
```

---

## Composants disponibles

### AdBanner

Affiche une bannière publicitaire depuis le backend.

**Props :**
- `ad: Advertisement` - Publicité à afficher
- `width?: number | string` - Largeur (défaut: `'100%'`)
- `height?: number` - Hauteur (défaut: `200`)
- `showBadge?: boolean` - Afficher le badge "Publicité" (défaut: `true`)
- `onPress?: () => void` - Callback au clic

**Exemple :**
```tsx
<AdBanner
  ad={advertisement}
  width="100%"
  height={250}
  showBadge={true}
  onPress={() => console.log('Ad clicked')}
/>
```

### AdColumn

Affiche une colonne de bannières publicitaires.

**Props :**
- `hideForSubscribers?: boolean` - Masquer pour les abonnés (défaut: `true`)
- `maxAds?: number` - Nombre maximum de pubs (défaut: `3`)

**Exemple :**
```tsx
<AdColumn
  hideForSubscribers={true}
  maxAds={3}
/>
```

---

## Hooks disponibles

### useAdPopup

Gère l'affichage automatique d'une publicité interstitielle.

**Options :**
```tsx
interface UseAdPopupOptions {
  delay?: number;              // Délai avant affichage (ms)
  autoShow?: boolean;          // Affichage automatique
  skipIfSubscribed?: boolean;  // Ignorer si abonné
  isSubscribed?: boolean;      // Statut d'abonnement
  onClose?: () => void;        // Callback fermeture
  onShow?: () => void;         // Callback affichage
}
```

**Retour :**
```tsx
interface UseAdPopupReturn {
  isAdReady: boolean;   // Pub prête à être affichée
  isLoading: boolean;   // Chargement en cours
  showAd: () => void;   // Afficher manuellement
  loadAd: () => void;   // Recharger une pub
}
```

**Exemple :**
```tsx
const { isAdReady, showAd } = useAdPopup({
  autoShow: true,
  delay: 2000,
  skipIfSubscribed: true,
  isSubscribed: userIsSubscribed,
  onShow: () => console.log('Ad shown'),
  onClose: () => console.log('Ad closed')
});
```

### useAd

Accède au contexte AdMob global pour un contrôle manuel.

**Retour :**
```tsx
interface AdContextState {
  isInitialized: boolean;      // SDK initialisé
  isAdReady: boolean;          // Pub interstitielle prête
  isLoading: boolean;          // Chargement en cours
  isAdShowing: boolean;        // Pub actuellement affichée
  showInterstitial: () => void;    // Afficher la pub
  loadInterstitial: () => void;    // Charger une pub
  requestConsent: () => Promise<void>; // GDPR (TODO)
}
```

**Exemple :**
```tsx
const { isAdReady, showInterstitial, loadInterstitial } = useAd();

useEffect(() => {
  loadInterstitial();
}, []);

const handleAction = () => {
  if (isAdReady) {
    showInterstitial();
  }
};
```

### useSubscription

Gère l'état d'abonnement de l'utilisateur (In-App Purchases).

**Retour :**
```tsx
interface SubscriptionState {
  products: ProductSubscription[];  // Produits disponibles
  isSubscribed: boolean;            // Utilisateur abonné
  loading: boolean;                 // Chargement
  purchasing: boolean;              // Achat en cours
  error: string | null;             // Erreur
  subscribe: (productId?: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
}
```

**Exemple :**
```tsx
const { isSubscribed, subscribe, products } = useSubscription();

const handleSubscribe = async () => {
  await subscribe(products[0]?.id);
};
```

---

## Tests

### Mode Développement

En mode développement (`__DEV__ === true`), les publicités utilisent automatiquement les **Test IDs de Google** :

```tsx
const getInterstitialAdUnitId = (): string => {
  if (__DEV__) {
    return TestIds.INTERSTITIAL; // Test ID Google
  }
  return Constants.expoConfig?.extra?.admobInterstitialId;
};
```

### Test sur Simulateur iOS

```bash
npm run ios
```

Les publicités de test s'afficheront avec le label **"Test Ad"**.

### Test sur Device Android

```bash
npm run android
```

Même comportement : publicités de test visibles.

### Build Production

Pour tester avec de vraies publicités :

```bash
npm run build:preview:ios
npm run build:preview:android
```

⚠️ **Attention :** Ne jamais cliquer sur vos propres publicités en production (risque de ban AdMob).

---

## Troubleshooting

### Publicité ne s'affiche pas

**Vérifications :**
1. Le SDK est-il initialisé ? Vérifier les logs `[AdMob] SDK initialized successfully`
2. L'Ad Unit ID est-il correct dans `.env` ?
3. L'utilisateur est-il abonné ? (vérifier `isSubscribed`)
4. La pub est-elle chargée ? (vérifier `isAdReady`)

**Logs utiles :**
```tsx
console.log('[AdMob] isAdReady:', isAdReady);
console.log('[AdMob] isLoading:', isLoading);
console.log('[AdMob] isAdShowing:', isAdShowing);
```

### Erreur de chargement

**Erreur courante :**
```
[AdMob] Interstitial ad error: { code: 3, message: 'No fill' }
```

**Causes possibles :**
- Quota AdMob épuisé (en test)
- Mauvaise configuration de l'Ad Unit ID
- Problème réseau

**Solution :**
- Vérifier la configuration dans Google AdMob Console
- Attendre quelques minutes et réessayer
- Vérifier la connexion internet

### SKAdNetwork manquant (iOS)

**Erreur :**
```
[AdMob] Missing SKAdNetwork identifiers
```

**Solution :**
Vérifier que la liste `SKAdNetworkItems` est bien présente dans `app.config.js` :

```javascript
SKAdNetworkItems: [
  { SKAdNetworkIdentifier: "cstr6suwn9.skadnetwork" },
  // ... (47 identifiers au total)
]
```

### GDPR / Consentement

**TODO :** Implémenter la gestion du consentement GDPR avec `react-native-google-mobile-ads`.

Pour l'instant, le consentement n'est pas géré. Fonction placeholder :

```tsx
const requestConsent = async () => {
  console.log('[AdContext] Consent request - not implemented yet');
};
```

---

## Ressources

- [Documentation react-native-google-mobile-ads](https://docs.page/invertase/react-native-google-mobile-ads)
- [Google AdMob Console](https://apps.admob.com/)
- [Test Ads Guide](https://developers.google.com/admob/android/test-ads)
- [SKAdNetwork IDs](https://developers.google.com/admob/ios/3p-skadnetworks)

---

## Checklist d'intégration

- [x] Configuration `.env` avec les App IDs et Ad Unit IDs
- [x] Configuration `app.config.js` avec plugin AdMob
- [x] Ajout des SKAdNetwork IDs (iOS)
- [x] Initialisation du SDK dans `app/_layout.tsx`
- [x] Création du `AdProvider` et `useAd` hook
- [x] Création du hook `useAdPopup`
- [x] Composants `AdBanner` et `AdColumn`
- [x] Intégration dans la page d'accueil (Home)
- [ ] Intégration dans les pages Articles
- [ ] Intégration dans les pages Tournois
- [ ] Intégration dans les pages Matchs
- [ ] Tests sur iOS (simulateur + device)
- [ ] Tests sur Android (émulateur + device)
- [ ] Tests en production (preview builds)
- [ ] Implémentation du consentement GDPR (TODO)

---

**Dernière mise à jour :** 2026-02-16
