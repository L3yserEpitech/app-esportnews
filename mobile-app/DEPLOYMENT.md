# 🚀 Déploiement Mobile App - Esport News

## 📋 Prérequis

- [ ] Compte Expo configuré (`eas login`)
- [ ] Apple Developer Account (pour iOS)
- [ ] Google Play Console Account (pour Android)
- [ ] Backend de production accessible sur `https://esportnews.fr/api`

---

## 🔧 Configuration des Variables d'Environnement

Les variables sont configurées dans `eas.json` pour chaque profil de build.

### Development (local)
```json
{
  "developmentClient": true,
  "env": {
    "EXPO_PUBLIC_API_URL": "http://localhost:4000",
    "EXPO_PUBLIC_ENVIRONMENT": "development"
  }
}
```

**Usage** :
- Émulateur iOS : `http://localhost:4000`
- Émulateur Android : automatiquement mappé à `http://10.0.2.2:4000` (voir `apiClient.ts`)

### Preview (test interne)
```json
{
  "distribution": "internal",
  "env": {
    "EXPO_PUBLIC_API_URL": "https://esportnews.fr/api",
    "EXPO_PUBLIC_ENVIRONMENT": "preview"
  }
}
```

**Usage** : Builds de test pour QA/beta-testers (TestFlight, Internal Testing)

### Production (stores)
```json
{
  "autoIncrement": true,
  "env": {
    "EXPO_PUBLIC_API_URL": "https://esportnews.fr/api",
    "EXPO_PUBLIC_ENVIRONMENT": "production"
  }
}
```

**Usage** : Builds pour App Store et Google Play

---

## 🏗️ Commandes de Build

### 1. Build Development (émulateur local)
```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android
```

Installer le build sur ton émulateur :
```bash
# iOS Simulator
eas build:run --profile development --platform ios

# Android Emulator
eas build:run --profile development --platform android
```

### 2. Build Preview (test interne)
```bash
# iOS (TestFlight internal)
eas build --profile preview --platform ios

# Android (Internal Testing)
eas build --profile preview --platform android

# Les deux plateformes en parallèle
eas build --profile preview --platform all
```

### 3. Build Production (stores)
```bash
# iOS (App Store)
eas build --profile production --platform ios

# Android (Google Play)
eas build --profile production --platform android

# Les deux plateformes
eas build --profile production --platform all
```

---

## 📦 Soumission aux Stores

### iOS - App Store
```bash
# 1. Build production
eas build --profile production --platform ios

# 2. Soumettre à App Store Connect
eas submit --platform ios --latest
```

**Checklist App Store** :
- [ ] Icônes et screenshots préparés
- [ ] Privacy Policy URL configurée
- [ ] App Store description/keywords rédigés
- [ ] Version number incrémentée (auto avec `autoIncrement: true`)

### Android - Google Play
```bash
# 1. Build production
eas build --profile production --platform android

# 2. Soumettre à Google Play Console
eas submit --platform android --latest
```

**Checklist Google Play** :
- [ ] Keystore configuré (`eas credentials`)
- [ ] Privacy Policy URL configurée
- [ ] Google Play screenshots/description
- [ ] Version code incrémenté (auto avec `autoIncrement: true`)

---

## 🔐 Gestion des Credentials

### Première fois (setup)
```bash
# Configurer credentials iOS
eas credentials --platform ios

# Configurer credentials Android
eas credentials --platform android
```

EAS gère automatiquement :
- **iOS** : Distribution Certificate, Provisioning Profiles
- **Android** : Keystore (génération automatique)

### Visualiser les credentials
```bash
eas credentials
```

---

## 🧪 Test des Builds

### 1. Vérifier l'URL du backend

Dans chaque build, vérifie les logs au démarrage :
```
🌐 [apiClient] Final BACKEND_URL set to: https://esportnews.fr/api
🚀 [apiClient] PRODUCTION MODE - Using https://esportnews.fr/api
```

### 2. Test de connectivité

Lance l'app et ouvre les Dev Tools (shake device) :
```javascript
// Dans la console Expo
fetch('https://esportnews.fr/api/health')
  .then(r => r.json())
  .then(console.log)
```

Réponse attendue :
```json
{"status": "ok"}
```

### 3. Test authentification

- Créer un compte
- Se connecter
- Vérifier que le token JWT est stocké
- Tester une requête authentifiée (favoris, notifications)

---

## 🔄 Workflow de Déploiement Complet

### Étape 1 : Préparation
```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
cd mobile-app
npm install

# 3. Vérifier que backend prod est accessible
curl https://esportnews.fr/api/health
```

### Étape 2 : Build Preview (optionnel)
```bash
# Build preview pour test interne
eas build --profile preview --platform all

# Partager le lien de téléchargement avec QA
# Le lien est disponible sur https://expo.dev/accounts/[account]/projects/esportnews/builds
```

### Étape 3 : Build Production
```bash
# Build production pour les stores
eas build --profile production --platform all

# Attendre la fin des builds (~10-20 min)
```

### Étape 4 : Soumission
```bash
# Soumettre iOS
eas submit --platform ios --latest

# Soumettre Android
eas submit --platform android --latest
```

### Étape 5 : Validation
- [ ] Vérifier dans App Store Connect (iOS)
- [ ] Vérifier dans Google Play Console (Android)
- [ ] Attendre review (~1-3 jours iOS, ~1-7 jours Android)

---

## 📊 Monitoring Post-Déploiement

### 1. Vérifier les logs backend
```bash
# Logs du backend Go
docker-compose logs -f backend --tail=100

# Filtrer les requêtes mobiles (User-Agent contient "Expo" ou package name)
docker-compose logs backend | grep "esportnews"
```

### 2. Monitorer les erreurs

Dans le backend, surveiller :
- Requêtes `/api/auth/login` (authentifications)
- Requêtes `/api/tournaments` (chargement data)
- Requêtes `/api/matches/by-date` (calendrier matchs)
- Codes erreur 401/403 (problèmes auth)
- Codes erreur 500 (bugs backend)

### 3. Crashlytics (à configurer)

Ajouter Firebase Crashlytics pour monitorer les crashes :
```bash
npx expo install expo-firebase-core expo-firebase-crashlytics
```

---

## 🐛 Troubleshooting

### Problème : "Network request failed"

**Cause** : Backend inaccessible ou CORS mal configuré

**Solution** :
1. Vérifier que backend répond : `curl https://esportnews.fr/api/health`
2. Vérifier CORS backend (doit accepter origin vide pour mobile)
3. Vérifier `EXPO_PUBLIC_API_URL` dans les logs app

### Problème : "Unauthorized (401)"

**Cause** : Token JWT expiré ou invalide

**Solution** :
1. Vérifier que `JWT_SECRET` est identique backend/mobile
2. Nettoyer AsyncStorage : `await AsyncStorage.clear()`
3. Re-login dans l'app

### Problème : Build échoue

**Cause** : Dependencies ou credentials manquants

**Solution** :
```bash
# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install

# Re-run build
eas build --profile production --platform [ios/android] --clear-cache
```

### Problème : App Store Reject

**Causes communes** :
- Privacy Policy manquante
- Permissions mal expliquées (notifications, etc.)
- Bugs/crashes lors de la review

**Solution** :
1. Lire le message de rejet dans App Store Connect
2. Corriger le problème
3. Incrémenter version : `"version": "1.0.1"` dans `app.json`
4. Re-build et re-submit

---

## 📝 Checklist Avant Chaque Release

- [ ] Backend prod accessible et stable
- [ ] Tests de l'app sur device réel (pas émulateur)
- [ ] Version number incrémentée dans `app.json`
- [ ] Changelog rédigé (pour stores)
- [ ] Screenshots mis à jour si UI a changé
- [ ] Privacy Policy à jour
- [ ] Tester flow complet : login → navigation → logout
- [ ] Vérifier que notifications push fonctionnent (si activées)
- [ ] Build preview testé par QA avant build prod

---

## 🔗 Liens Utiles

- **EAS Dashboard** : https://expo.dev/accounts/[account]/projects/esportnews
- **EAS Docs** : https://docs.expo.dev/eas/
- **App Store Connect** : https://appstoreconnect.apple.com
- **Google Play Console** : https://play.google.com/console
- **Backend Health Check** : https://esportnews.fr/api/health

---

## 📞 Support

En cas de problème :
1. Vérifier les logs EAS build : `eas build:view [build-id]`
2. Consulter Expo forums : https://forums.expo.dev
3. Vérifier status Expo : https://status.expo.dev
