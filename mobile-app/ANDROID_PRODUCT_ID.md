# 🔧 Configuration rapide : Product ID Android

## Étape 1 : Créer l'abonnement dans Google Play Console

1. Aller sur [Google Play Console](https://play.google.com/console)
2. Sélectionner l'app **Esport News**
3. **Monetization > Subscriptions**
4. **Create subscription** :
   - **Product ID** : `premium_monthly` (ou votre choix)
   - **Name** : Premium Subscription
   - **Price** : 0.99 EUR / mois
   - **Billing period** : 1 month
5. **Activate** l'abonnement

---

## Étape 2 : Ajouter le Product ID dans le code

Éditer le fichier [hooks/useSubscription.ts](hooks/useSubscription.ts) :

### Avant :
```typescript
const SUBSCRIPTION_SKUS = Platform.select({
  ios: ['13801972972'],
  android: [] as string[], // ← Vide
}) ?? [];
```

### Après :
```typescript
const SUBSCRIPTION_SKUS = Platform.select({
  ios: ['13801972972'],
  android: ['premium_monthly'], // ← Ajouter votre Product ID ici
}) ?? [];
```

⚠️ **Important** : Le Product ID doit être **exactement identique** à celui créé dans Google Play Console.

---

## Étape 3 : Rebuild l'app

```bash
cd /Users/jules/Code/freelance/esportnews/mobile-app

# Rebuild pour Android
npm run android

# Ou build EAS pour tester sur appareil
eas build --platform android --profile development
```

---

## ✅ Vérification

Une fois l'app installée sur Android :

1. Se connecter avec un compte utilisateur
2. Aller sur **Profil → Abonnement Premium**
3. Dans la console, vous devriez voir :
   ```
   Products loaded: [{
     productId: "premium_monthly",
     title: "Premium Subscription",
     description: "...",
     price: "0.99€"
   }]
   ```

Si `products.length = 0`, voir le guide complet : [SETUP_ANDROID_IAP.md](SETUP_ANDROID_IAP.md)

---

## 🎯 Référence rapide

| Plateforme | Product ID | Type |
|------------|------------|------|
| **iOS** | `13801972972` | Auto-Renewable Subscription |
| **Android** | `premium_monthly` | Subscription |

Les deux plateformes partagent :
- Prix : **0.99€/mois**
- Période : **1 mois**
- Type : **Auto-renewing** (renouvellement automatique)
