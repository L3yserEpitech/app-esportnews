# ⚡ Quick Start : Configuration Android IAP (15 minutes)

Guide ultra-rapide pour configurer les achats Android.

---

## 📋 Checklist 5 étapes

### ☐ Étape 1 : Google Play Console (5 min)

1. Aller sur https://play.google.com/console
2. **Monetization > Subscriptions > Create subscription**
3. Remplir :
   ```
   Product ID: premium_monthly
   Name: Premium Subscription
   Price: 0.99 EUR
   Billing period: 1 month
   ```
4. **Save** puis **Activate**

### ☐ Étape 2 : Ajouter Product ID dans le code (1 min)

Éditer `mobile-app/hooks/useSubscription.ts` ligne 21 :

```typescript
android: ['premium_monthly'],  // ← Ajouter cette ligne
```

### ☐ Étape 3 : Ajouter un testeur (2 min)

1. Google Play Console : **Settings > License testing**
2. Ajouter votre email Gmail dans **License testers**
3. Save

### ☐ Étape 4 : Uploader un APK de test (5 min)

```bash
cd /Users/jules/Code/freelance/esportnews/mobile-app
eas build --platform android --profile development
```

Uploader le build sur **Testing > Internal testing**

### ☐ Étape 5 : Tester sur appareil (2 min)

1. Télécharger l'app via le lien Internal Testing
2. Se connecter dans l'app
3. Aller sur **Profil → Abonnement Premium**
4. Vérifier que le prix s'affiche : `0.99€/mois`
5. S'abonner (gratuit pour les testeurs)

---

## ✅ Résultat attendu

Après configuration :

```typescript
// Console logs
Products loaded: [{
  productId: "premium_monthly",
  title: "Premium Subscription",
  price: "0.99€"
}]

Subscribing to: premium_monthly
Purchase successful!
```

Badge Premium visible sur le profil ⭐

---

## 🐛 Problème ?

### "Products loaded: []" (liste vide)

**Causes** :
- L'abonnement n'est pas **activé** dans Google Play Console
- Attendre 2-24h après activation
- Vérifier que le Product ID est identique : `premium_monthly`

**Solution rapide** :
```bash
# Vérifier les logs
npx react-native log-android

# Chercher les erreurs [useSubscription]
```

### "Not licensed to make purchases"

**Cause** : Compte non configuré comme testeur

**Solution** :
1. Ajouter votre email dans **Settings > License testing**
2. Redémarrer l'appareil Android
3. Réinstaller l'app

---

## 📚 Guides complets

- **Configuration détaillée** : [SETUP_ANDROID_IAP.md](SETUP_ANDROID_IAP.md)
- **Troubleshooting** : [SETUP_ANDROID_IAP.md#troubleshooting](SETUP_ANDROID_IAP.md#troubleshooting)
- **Tests iOS** : [TESTING_IAP.md](TESTING_IAP.md)
- **Vue d'ensemble** : [IAP_SETUP_SUMMARY.md](IAP_SETUP_SUMMARY.md)

---

**Temps estimé** : 15 minutes (hors attente activation Google)
