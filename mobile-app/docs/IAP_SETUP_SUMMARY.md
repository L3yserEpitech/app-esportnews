# 📱 Résumé : Configuration des achats in-app (iOS + Android)

## 🎯 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                     ESPORT NEWS - IAP SETUP                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  iOS (App Store)              Android (Google Play)             │
│  ────────────────              ───────────────────              │
│                                                                 │
│  Product ID:                   Product ID:                      │
│  13801972972                   premium_monthly                  │
│                                                                 │
│  Prix: 0.99€/mois              Prix: 0.99€/mois                │
│  Type: Subscription            Type: Subscription              │
│  Plateforme: StoreKit          Plateforme: Google Play Billing │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 Configuration actuelle

### ✅ Déjà configuré

| Composant | Statut | Fichier |
|-----------|--------|---------|
| **Hook d'abonnement** | ✅ Créé | [hooks/useSubscription.ts](hooks/useSubscription.ts) |
| **Page d'abonnement** | ✅ Créée | [app/profile/subscription.tsx](app/profile/subscription.tsx) |
| **Badge Premium** | ✅ Ajouté | [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx) |
| **Blocage pubs abonnés** | ✅ Configuré | [hooks/useAdPopup.ts](hooks/useAdPopup.ts) |
| **Product ID iOS** | ✅ Configuré | `13801972972` |
| **StoreKit Config** | ✅ Créé | [ios/Products.storekit](ios/Products.storekit) |

### ⚠️ À configurer

| Composant | Statut | Action requise |
|-----------|--------|----------------|
| **Product ID Android** | ⚠️ Vide | Créer abonnement dans Google Play Console |
| **Google Play Console** | ⚠️ Manquant | Créer + activer l'abonnement |
| **License Testers** | ⚠️ Non configurés | Ajouter emails de test |

---

## 🚀 Prochaines étapes

### Étape 1 : Configurer Google Play Console (30 min)

1. ✅ Se connecter à [Google Play Console](https://play.google.com/console)
2. ✅ Créer un abonnement :
   - Product ID : `premium_monthly`
   - Prix : 0.99 EUR
   - Période : 1 mois
3. ✅ Activer l'abonnement
4. ✅ Ajouter des License Testers (emails Gmail)

**Guide détaillé** : [SETUP_ANDROID_IAP.md](SETUP_ANDROID_IAP.md)

### Étape 2 : Ajouter le Product ID dans le code (2 min)

Éditer [hooks/useSubscription.ts:19-22](hooks/useSubscription.ts) :

```typescript
const SUBSCRIPTION_SKUS = Platform.select({
  ios: ['13801972972'],
  android: ['premium_monthly'], // ← Ajouter ici
}) ?? [];
```

**Guide rapide** : [ANDROID_PRODUCT_ID.md](ANDROID_PRODUCT_ID.md)

### Étape 3 : Tester sur Android (1h)

1. ✅ Build l'app Android :
   ```bash
   eas build --platform android --profile development
   ```
2. ✅ Installer sur appareil Android (compte License Tester)
3. ✅ Tester l'achat : Profil → Abonnement Premium
4. ✅ Vérifier le badge Premium
5. ✅ Vérifier que les pubs sont masquées

---

## 🧪 Tests - Matrice de compatibilité

| Plateforme | Environnement | Product ID | Paiement réel | Guide |
|------------|---------------|------------|---------------|-------|
| **iOS** | Simulateur (Xcode) | `13801972972` | ❌ Non (StoreKit local) | [TESTING_IAP.md](TESTING_IAP.md) |
| **iOS** | Appareil (Sandbox) | `13801972972` | ❌ Non (gratuit) | [TESTING_IAP.md](TESTING_IAP.md) |
| **iOS** | Production | `13801972972` | ✅ Oui (vraie carte) | - |
| **Android** | Émulateur | `premium_monthly` | ❌ Non (License Tester) | [SETUP_ANDROID_IAP.md](SETUP_ANDROID_IAP.md) |
| **Android** | Appareil (Internal Test) | `premium_monthly` | ❌ Non (gratuit) | [SETUP_ANDROID_IAP.md](SETUP_ANDROID_IAP.md) |
| **Android** | Production | `premium_monthly` | ✅ Oui (vraie carte) | - |

---

## 🎨 Fonctionnalités Premium

Quand l'utilisateur s'abonne :

### ✅ Badge Premium sur profil
```
┌─────────────────────┐
│   Photo de profil   │
│                     │
│     Jules Dupont    │
│  jules@example.com  │
│                     │
│  ⭐ Premium         │ ← Badge affiché
└─────────────────────┘
```

### ✅ Aucune publicité

Toutes les pages vérifient le statut d'abonnement :

```typescript
const { isSubscribed } = useSubscription();
const { showAd } = useAdPopup({
  skipIfSubscribed: true,  // ← Skip si Premium
  isSubscribed,
});
```

**Pages concernées** :
- Home (`app/(tabs)/index.tsx`)
- Articles (`app/article/[slug].tsx`)
- Tournois (`app/tournament/[id].tsx`)
- Matchs (`app/match/[id].tsx`)

### ✅ Restauration d'achats

Bouton "Restaurer mes achats" disponible sur la page d'abonnement :
- Restaure les achats iOS (App Store)
- Restaure les achats Android (Google Play)

---

## 🔗 Fichiers de configuration

| Fichier | Description | Plateforme |
|---------|-------------|------------|
| [hooks/useSubscription.ts](hooks/useSubscription.ts) | Hook principal gérant les achats | iOS + Android |
| [app/profile/subscription.tsx](app/profile/subscription.tsx) | UI de la page d'abonnement | iOS + Android |
| [ios/Products.storekit](ios/Products.storekit) | Config StoreKit (tests locaux) | iOS uniquement |
| [TESTING_IAP.md](TESTING_IAP.md) | Guide de test iOS (StoreKit + Sandbox) | iOS uniquement |
| [SETUP_ANDROID_IAP.md](SETUP_ANDROID_IAP.md) | Guide complet configuration Android | Android uniquement |
| [ANDROID_PRODUCT_ID.md](ANDROID_PRODUCT_ID.md) | Guide rapide Product ID Android | Android uniquement |

---

## 📞 Support

### Problème iOS

- Consulter [TESTING_IAP.md](TESTING_IAP.md) → section Troubleshooting
- Vérifier que StoreKit Configuration est lié au scheme Xcode
- Vérifier les logs : `[useSubscription]` dans la console

### Problème Android

- Consulter [SETUP_ANDROID_IAP.md](SETUP_ANDROID_IAP.md) → section Troubleshooting
- Vérifier que l'abonnement est **activé** dans Google Play Console
- Vérifier que le compte est **License Tester**
- Attendre 24h après activation (propagation Google)

---

## ✅ Checklist finale avant production

### iOS (App Store)

- [ ] Product ID `13801972972` créé dans App Store Connect
- [ ] Abonnement approuvé par Apple
- [ ] Tests réussis avec compte Sandbox
- [ ] Restauration d'achats testée

### Android (Google Play)

- [ ] Product ID `premium_monthly` créé dans Google Play Console
- [ ] Abonnement activé (status: Active)
- [ ] Tests réussis avec License Tester
- [ ] Restauration d'achats testée
- [ ] Prix configurés pour toutes les régions (EUR, USD, GBP)

### Code

- [ ] Product ID Android ajouté dans [useSubscription.ts](hooks/useSubscription.ts)
- [ ] Badge Premium s'affiche correctement
- [ ] Publicités masquées pour les abonnés Premium
- [ ] Bouton "Restaurer mes achats" fonctionne
- [ ] CGU/CGV accessibles (`/legal`)

---

**Temps estimé total** : 2-3 heures (configuration + tests)

- iOS : ✅ Déjà configuré (1h)
- Android : ⚠️ À faire (1-2h)
