# 🧪 Test des abonnements sans appareil physique (Mode Mock)

Guide pour tester l'abonnement Premium sur émulateur Android ou simulateur iOS **sans compte Apple/Google**.

---

## 🎯 Concept

Le hook `useSubscriptionMock` simule complètement le système d'achat :
- ✅ Charge un produit fictif (0.99€/mois)
- ✅ Simule un achat avec délai réaliste (1.5s)
- ✅ Sauvegarde le statut dans AsyncStorage
- ✅ Affiche le badge Premium
- ✅ Masque les publicités

**Idéal pour** :
- Développer l'UI sans compte App Store/Google Play
- Tester sur émulateur Android
- Tester sur simulateur iOS (sans StoreKit)
- Démonstrations clients

**Limites** :
- ❌ Ne teste pas les vrais achats
- ❌ Ne valide pas les receipts
- ❌ Ne teste pas les renouvellements

---

## 🚀 Activation du mode Mock

### Option 1 : Variable d'environnement (Recommandé)

Créer un fichier `.env.development` :

```bash
cd /Users/jules/Code/freelance/esportnews/mobile-app
echo "USE_MOCK_SUBSCRIPTION=true" > .env.development
```

Modifier [hooks/useSubscription.ts](hooks/useSubscription.ts) :

```typescript
import { useSubscriptionMock } from './useSubscriptionMock';
import Constants from 'expo-constants';

export function useSubscription() {
  // Mode mock si variable d'environnement activée
  const useMock = Constants.expoConfig?.extra?.useMockSubscription || false;

  if (useMock) {
    console.log('⚠️ Using MOCK subscription (dev mode)');
    return useSubscriptionMock();
  }

  // Code normal ici...
}
```

### Option 2 : Switch manuel dans le code

Modifier directement [hooks/useSubscription.ts](hooks/useSubscription.ts) :

```typescript
import { useSubscriptionMock } from './useSubscriptionMock';

export function useSubscription() {
  // ⚠️ DEVELOPMENT ONLY - Basculer vers true pour mode mock
  const USE_MOCK = __DEV__ && Platform.OS === 'android'; // Mode mock sur Android dev uniquement

  if (USE_MOCK) {
    console.log('⚠️ Using MOCK subscription');
    return useSubscriptionMock();
  }

  // Code normal...
}
```

### Option 3 : Export conditionnel

Modifier [hooks/index.ts](hooks/index.ts) :

```typescript
// Mode mock pour Android en dev
if (__DEV__ && Platform.OS === 'android') {
  export { useSubscriptionMock as useSubscription } from './useSubscriptionMock';
} else {
  export { useSubscription } from './useSubscription';
}
```

---

## 🧪 Tester sur émulateur Android

### Étape 1 : Installer Android Studio

```bash
brew install --cask android-studio
```

### Étape 2 : Créer un émulateur

1. Ouvrir Android Studio
2. **Tools > Device Manager**
3. **Create Device** :
   - Appareil : **Pixel 6**
   - Image système : **API 33 (Android 13)**
   - Télécharger si nécessaire
4. **Finish**

### Étape 3 : Lancer l'émulateur

```bash
# Depuis Android Studio : cliquer sur ▶️

# Ou en ligne de commande
emulator -avd Pixel_6_API_33 &
```

### Étape 4 : Activer le mode Mock

Choisir une des 3 options ci-dessus (recommandé : Option 2)

### Étape 5 : Lancer l'app

```bash
cd /Users/jules/Code/freelance/esportnews/mobile-app
npm run android
```

### Étape 6 : Tester l'abonnement

1. Dans l'app (émulateur) : **Profil → Abonnement Premium**
2. Vérifier les logs :
   ```
   ⚠️ Using MOCK subscription
   Products loaded: [{
     displayPrice: "0.99€",
     title: "Abonnement Premium"
   }]
   ```
3. Cliquer sur **S'abonner maintenant**
4. Attendre 1.5s (simulation)
5. ✅ Badge Premium apparaît
6. ✅ Publicités masquées

---

## 🧪 Tester sur simulateur iOS (sans StoreKit)

Si vous ne voulez pas configurer StoreKit dans Xcode :

```bash
# Activer le mode mock (Option 2 recommandée)
# Modifier hooks/useSubscription.ts :
const USE_MOCK = __DEV__; // true pour iOS en dev

# Lancer le simulateur
npm run ios
```

---

## 🔧 Fonctionnalités du Mock

### Acheter un abonnement

```typescript
const { subscribe, purchasing } = useSubscription();

// L'utilisateur clique sur "S'abonner"
subscribe('premium_monthly');

// Résultat après 1.5s :
// - isSubscribed = true
// - Badge Premium affiché
// - Pubs masquées
```

### Restaurer les achats

```typescript
const { restorePurchases } = useSubscription();

// L'utilisateur clique sur "Restaurer"
restorePurchases();

// Résultat :
// - Vérifie AsyncStorage
// - Restaure le statut si abonné
```

### Reset (pour les tests)

```typescript
const { resetMockSubscription } = useSubscription();

// Reset le statut (uniquement en mode mock)
resetMockSubscription();

// Résultat :
// - isSubscribed = false
// - Badge Premium caché
// - Pubs réaffichées
```

---

## 📊 Comparaison des méthodes de test

| Méthode | Achats réels | Setup | Besoin appareil | Recommandation |
|---------|-------------|-------|-----------------|----------------|
| **Mode Mock (ce guide)** | ❌ Non | 5 min | ❌ Non | ⭐⭐⭐ **Dev sans appareil** |
| **StoreKit iOS (Xcode)** | ❌ Non | 10 min | ❌ Non | ⭐⭐⭐ Test iOS local |
| **Sandbox iOS** | ✅ Oui | 20 min | ✅ iPhone | ⭐⭐ Validation iOS |
| **License Tester Android** | ✅ Oui | 30 min | ✅ Android | ⭐⭐ Validation Android |
| **Production** | ✅ Oui | - | ✅ Oui | ⭐⭐⭐ Après validation |

---

## 🐛 Troubleshooting

### ❌ "products.length = 0" en mode mock

**Cause** : Le mode mock n'est pas activé

**Solution** :
1. Vérifier les logs console : devrait afficher `⚠️ Using MOCK subscription`
2. Si absent, vérifier que `USE_MOCK = true` dans le code
3. Redémarrer l'app (fermer complètement)

### ❌ Badge Premium ne s'affiche pas après achat

**Cause** : AsyncStorage non persisté

**Solution** :
```bash
# Réinstaller l'app
npm run android # ou npm run ios

# Ou vérifier les logs
[MockSubscription] Mock purchase successful
```

### ❌ "resetMockSubscription is not a function"

**Cause** : Mode mock non activé

**Solution** :
- Cette fonction n'existe que dans `useSubscriptionMock`
- Vérifier que le mode mock est bien activé

---

## ⚠️ Important : Désactiver en production

**AVANT de déployer en production**, vérifier que le mode mock est désactivé :

```typescript
// hooks/useSubscription.ts
const USE_MOCK = __DEV__ && false; // ← Mettre false

// Ou supprimer complètement la condition
```

**Checklist avant production** :
- [ ] Mode mock désactivé (`USE_MOCK = false`)
- [ ] Tests réussis sur appareil réel iOS (Sandbox)
- [ ] Tests réussis sur appareil réel Android (License Tester)
- [ ] Variable d'environnement `USE_MOCK_SUBSCRIPTION` retirée

---

## 🎯 Workflow recommandé

### Phase 1 : Développement (Mode Mock)

```bash
# Activer le mode mock
# Développer l'UI sur émulateur Android
npm run android

# Tester :
# - Page d'abonnement s'affiche
# - Achat fonctionne (mock)
# - Badge Premium apparaît
# - Pubs masquées
```

### Phase 2 : Validation iOS (StoreKit)

```bash
# Configurer StoreKit (voir TESTING_IAP.md)
open ios/EsportNews.xcworkspace

# Tester sur simulateur iOS
# Vérifier les achats réels StoreKit
```

### Phase 3 : Validation Android (Appareil réel)

```bash
# Emprunter un téléphone Android
# Ou utiliser Internal Testing Google Play
eas build --platform android --profile development

# Tester les achats réels (License Tester)
```

### Phase 4 : Production

```bash
# Désactiver le mode mock
# Build production
eas build --platform ios --profile production
eas build --platform android --profile production

# Soumettre à App Store + Google Play
```

---

## 🔗 Ressources

- **Mode Mock créé** : [hooks/useSubscriptionMock.ts](hooks/useSubscriptionMock.ts)
- **Hook principal** : [hooks/useSubscription.ts](hooks/useSubscription.ts)
- **Guide iOS StoreKit** : [TESTING_IAP.md](TESTING_IAP.md)
- **Guide Android complet** : [SETUP_ANDROID_IAP.md](SETUP_ANDROID_IAP.md)

---

**Mode Mock = Développement rapide sans appareil physique** 🚀
