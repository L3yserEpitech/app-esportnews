# 🤖 Configuration des achats in-app Android (Google Play)

Ce guide explique comment configurer les abonnements Premium sur Android via Google Play Console.

---

## 📋 Prérequis

- ✅ Compte Google Play Console actif (inscription : 25 $ unique)
- ✅ Application créée dans Google Play Console
- ✅ Package name : `com.esportnewsapp.mobile` (déjà configuré dans [app.json:28](app.json))
- ✅ Au moins 1 APK/AAB uploadé (internal/closed test minimum)

---

## 🚀 Étape 1 : Créer l'abonnement dans Google Play Console

### 1.1 Accéder à la section Abonnements

1. Se connecter à [Google Play Console](https://play.google.com/console)
2. Sélectionner votre app **Esport News**
3. Dans le menu de gauche : **Monetization > Subscriptions** (ou **Monétisation > Abonnements**)
4. Cliquer sur **Create subscription** (Créer un abonnement)

### 1.2 Configurer l'abonnement

#### Informations de base

| Champ | Valeur recommandée |
|-------|-------------------|
| **Product ID** | `premium_monthly` |
| **Name** | Premium Subscription |
| **Description** | Abonnement Premium mensuel - Zéro pub et support prioritaire |

⚠️ **Important** : Le **Product ID** doit être :
- Unique (ne peut pas être modifié après création)
- Minuscules uniquement
- Format : `snake_case` ou `kebab-case`

**Exemple de Product ID** :
- ✅ `premium_monthly`
- ✅ `esport_premium`
- ✅ `no_ads_subscription`
- ❌ `PremiumMonthly` (majuscules interdites)
- ❌ `premium monthly` (espaces interdits)

#### Plans de tarification

1. Cliquer sur **Add base plan**
2. **Base plan ID** : `monthly` (ou `base`)
3. **Billing period** : `1 month` (Période mensuelle)
4. **Price** : `0.99 EUR`
5. **Auto-renewing** : ✅ Oui (activé par défaut)

#### Configuration avancée (optionnel)

- **Grace period** : 3 jours (période de grâce si paiement échoue)
- **Free trial** : 7 jours (essai gratuit pour nouveaux utilisateurs)
  - Note : Les utilisateurs sandbox peuvent tester gratuitement sans limite
- **Introductory pricing** : 0.49 EUR pendant 1 mois (prix promotionnel)

### 1.3 Activer l'abonnement

1. Sauvegarder le brouillon : **Save draft**
2. **Activer** l'abonnement : bouton **Activate**
3. ⚠️ Une fois activé, l'abonnement peut prendre **quelques heures** avant d'être disponible en prod

---

## 🔧 Étape 2 : Configurer le code React Native

### 2.1 Ajouter le Product ID Android

Éditer [hooks/useSubscription.ts:19-22](hooks/useSubscription.ts) :

```typescript
const SUBSCRIPTION_SKUS = Platform.select({
  ios: ['13801972972'],
  android: ['premium_monthly'], // ← Ajouter votre Product ID ici
}) ?? [];
```

### 2.2 Vérifier la configuration Expo

Le fichier [app.json](app.json) doit contenir :

```json
{
  "expo": {
    "android": {
      "package": "com.esportnewsapp.mobile"
    },
    "plugins": [
      "react-native-iap"
    ]
  }
}
```

✅ Déjà configuré dans votre projet !

---

## 🧪 Étape 3 : Tester avec des comptes License Testers

### 3.1 Ajouter des testeurs

1. Dans Google Play Console : **Settings > License testing**
2. Section **License testers** : ajouter des emails Gmail
   - Exemple : `votreemail@gmail.com`
3. **Response for license checks** : Sélectionner **RESPOND_NORMALLY**
4. Sauvegarder

**Important** : Les testeurs doivent utiliser le **même compte Gmail** configuré ici pour télécharger l'app.

### 3.2 Créer une version de test (Internal Testing)

1. Dans Google Play Console : **Testing > Internal testing**
2. **Create new release**
3. Uploader votre APK/AAB :

```bash
cd /Users/jules/Code/freelance/esportnews/mobile-app

# Build de développement Android
npm run build:dev:android

# Ou build de production
eas build --platform android --profile production
```

4. **Release name** : `1.0.0 (Test IAP)`
5. **Release notes** : "Test abonnements Premium"
6. **Save** puis **Review release** puis **Start rollout to Internal testing**

### 3.3 Installer l'app sur appareil Android

#### Option A : Via Google Play (recommandé)

1. Ajouter votre compte Gmail dans **License testers** (étape 3.1)
2. Dans Google Play Console : **Internal testing** → copier le lien d'opt-in
3. Ouvrir ce lien sur votre téléphone Android (connecté avec le compte testeur)
4. Accepter l'invitation
5. Télécharger l'app depuis Google Play

#### Option B : Installation directe (APK)

```bash
# Build APK local
cd /Users/jules/Code/freelance/esportnews/mobile-app
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease

# Installer sur appareil connecté
adb install -r app/build/outputs/apk/release/app-release.apk
```

⚠️ **Important** : L'appareil Android doit être connecté avec un compte **License Tester**.

### 3.4 Tester l'abonnement

1. Lancer l'app sur l'appareil Android
2. Se connecter avec un compte utilisateur
3. Aller sur **Profil → Abonnement Premium**
4. Vérifier que le produit se charge :
   - Logs : `Products loaded: [{...}]`
   - Prix affiché : `0.99€/mois`
5. Cliquer sur **S'abonner maintenant**
6. Une fenêtre Google Play s'ouvre avec la mention **"ITEM_ALREADY_OWNED TEST"** (pour les testeurs)
7. Confirmer l'achat (gratuit pour les testeurs)
8. Vérifier que le badge **Premium** apparaît sur le profil

---

## 🐛 Troubleshooting

### ❌ Erreur : "Product not found"

**Cause** : L'abonnement n'est pas encore disponible

**Solutions** :
1. Vérifier que l'abonnement est **Activé** dans Google Play Console
2. Attendre 2-24h après activation (propagation Google)
3. Vérifier que le Product ID dans le code correspond exactement à celui de Google Play
4. S'assurer qu'au moins 1 APK est uploadé (internal/closed test minimum)

### ❌ Erreur : "This version of the application is not configured for billing through Google Play"

**Cause** : L'app n'est pas signée correctement ou pas uploadée sur Play Console

**Solutions** :
1. Uploader un APK/AAB signé sur Google Play Console (Internal Testing minimum)
2. Attendre 2-3 heures après upload
3. Vérifier que le package name correspond : `com.esportnewsapp.mobile`

### ❌ Erreur : "You are not licensed to make purchases"

**Cause** : Compte Google non configuré comme License Tester

**Solutions** :
1. Ajouter votre email Gmail dans **Settings > License testing**
2. Vous déconnecter/reconnecter sur l'appareil Android
3. Réinstaller l'app depuis le lien Internal Testing

### ❌ Produit affiché comme "1000000.00 ₹" (prix incorrect)

**Cause** : Prix non configuré pour votre région

**Solutions** :
1. Google Play Console : **Subscriptions** → votre abonnement
2. **Pricing** → Ajouter des prix pour toutes les régions cibles
3. Minimum : EUR, USD, GBP

### ❌ L'achat se complète mais `isSubscribed = false`

**Cause** : Problème de vérification de receipt

**Solutions** :
1. Vérifier les logs : `[useSubscription] Purchase updated`
2. Appeler `restorePurchases()` manuellement
3. Vérifier que `finishTransaction()` est bien appelé

---

## 📊 Tester les renouvellements (accélérés)

Pour les **License Testers**, Google accélère les renouvellements :

| Période réelle | Période de test |
|----------------|-----------------|
| 1 semaine | 5 minutes |
| 1 mois | 5 minutes |
| 3 mois | 10 minutes |
| 6 mois | 15 minutes |
| 1 an | 30 minutes |

**Comment tester** :
1. S'abonner sur l'appareil de test
2. Attendre 5 minutes
3. L'abonnement se renouvelle automatiquement (jusqu'à 6 fois maximum)
4. Après 6 renouvellements, l'abonnement est annulé automatiquement

---

## 🔐 Configuration avancée : Service Account (optionnel)

Pour vérifier les receipts côté serveur (recommandé en production) :

### 1. Créer un Service Account

1. Google Play Console : **Settings > API access**
2. Cliquer sur **Create new service account**
3. Suivre le lien vers Google Cloud Console
4. Créer un service account : `esport-news-iap-validator`
5. Télécharger la clé JSON (gardez-la secrète !)

### 2. Donner les permissions

1. Retourner sur Google Play Console : **API access**
2. Trouver votre service account
3. **Grant access**
4. Permissions minimales :
   - ✅ **View financial data** (Voir données financières)
   - ✅ **Manage orders and subscriptions** (Gérer commandes et abonnements)

### 3. Intégrer côté backend (Go)

```go
// backend-go/internal/handlers/subscription.go
import "google.golang.org/api/androidpublisher/v3"

func VerifySubscription(purchaseToken string, productID string) (bool, error) {
    // Utiliser la clé JSON du service account
    // Valider le receipt avec Google Play API
}
```

⚠️ **Note** : Cette étape est optionnelle pour la V1. En dev, `react-native-iap` gère la validation localement.

---

## 🎯 Checklist finale avant production

Avant de publier l'app sur Google Play :

- [ ] Abonnement **activé** dans Google Play Console
- [ ] Product ID ajouté dans [useSubscription.ts](hooks/useSubscription.ts)
- [ ] Tests réussis avec un compte License Tester
- [ ] Achat complété et badge Premium affiché
- [ ] Restauration d'achats fonctionne (`restorePurchases()`)
- [ ] Prix configurés pour toutes les régions cibles (EUR, USD, etc.)
- [ ] Grace period configuré (3-7 jours recommandés)
- [ ] CGU/CGV accessibles depuis l'app (lien `/legal`)
- [ ] Service Account créé (si validation serveur nécessaire)

---

## 🔗 Ressources officielles

- [Google Play Console - Subscriptions](https://play.google.com/console)
- [React Native IAP - Documentation](https://github.com/dooboolab-community/react-native-iap)
- [Google Play Billing - Testing](https://developer.android.com/google/play/billing/test)
- [License Testing Guide](https://developer.android.com/google/play/billing/test#test-purchases)

---

## 📞 Besoin d'aide ?

Si vous rencontrez un problème :

1. Vérifier les logs React Native : `npx react-native log-android`
2. Vérifier les logs du hook : `[useSubscription]` dans la console
3. Tester avec un **nouveau compte Gmail** ajouté en License Tester
4. Attendre 24h après activation de l'abonnement (propagation Google)

---

**Prêt pour iOS** : Pour tester sur iOS, suivez le guide [TESTING_IAP.md](TESTING_IAP.md)
