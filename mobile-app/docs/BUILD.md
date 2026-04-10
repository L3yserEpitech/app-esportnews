# 📱 Esport News Mobile App - Build Instructions

## Configuration des Variables d'Environnement

L'application mobile utilise **EAS Build** pour gérer les variables d'environnement selon l'environnement de build.

### Fichiers de Configuration

- **`.env`** : Variables de développement local (gitignored)
- **`.env.production`** : Variables de production (gitignored)
- **`app.config.js`** : Configuration Expo avec injection des variables d'env
- **`eas.json`** : Configuration EAS Build avec variables par environnement

### Variables Disponibles

| Variable | Development | Production |
|----------|-------------|------------|
| `EXPO_PUBLIC_API_URL` | `http://localhost:4000` | `https://esportnews.fr/api` |
| `EXPO_PUBLIC_ENVIRONMENT` | `development` | `production` |

## 🔨 Commandes de Build

### Development Build (Local Simulator/Emulator)
> **Recommandé pour le développement quotidien**

Ces commandes génèrent le code natif temporaire et l'installent directement sur votre simulateur.

```bash
# iOS Simulator
npx expo run:ios

# Android Emulator
npx expo run:android
```

### Development Build (EAS / Cloud)
> Pour partager le build avec l'équipe ou tester sur device physique sans Xcode/Android Studio.

```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android
```

### Preview Build (testing production behavior)
```bash
# iOS
eas build --profile preview --platform ios

# Android
eas build --profile preview --platform android
```

### Production Build (App Store / Google Play)
```bash
# iOS
eas build --profile production --platform ios

# Android
eas build --profile production --platform android
```

## 🚀 Rebuild Production

Si votre build iOS actuel n'a pas les bonnes variables d'environnement :

```bash
# 1. Nettoyer le cache EAS
eas build:clean

# 2. Rebuild pour production
eas build --profile production --platform ios --clear-cache

# 3. Vérifier les logs de build pour confirmer EXPO_PUBLIC_API_URL
```

## 🔍 Vérification de la Configuration

Dans votre app mobile, vous pouvez logger l'URL utilisée :

```typescript
import Constants from 'expo-constants';

console.log('API URL:', Constants.expoConfig?.extra?.apiUrl);
console.log('Environment:', Constants.expoConfig?.extra?.environment);
```

## 📝 Notes Importantes

### Backend CORS
Le backend Go est **déjà configuré** pour accepter les requêtes des apps mobiles :
- ✅ Origine vide (`""`) autorisée → apps mobiles natives
- ✅ Production URL whitelisted : `https://esportnews.fr`
- ✅ Headers CORS corrects pour JWT authentication

Configuration CORS dans `backend-go/cmd/server/main.go:90-109` :
```go
AllowOriginFunc: func(origin string) (bool, error) {
    if origin == "" {
        // Apps mobiles natives - pas de credentials autorisées
        return true, nil
    }
    // Navigateurs web - vérifier whitelist stricte
    return corsOriginsSet[origin], nil
}
```

### URLs API

| Environnement | Base URL | API Endpoint |
|--------------|----------|--------------|
| Development (iOS) | `http://localhost:4000` | `/api/*` |
| Development (Android) | `http://10.0.2.2:4000` | `/api/*` |
| Production | `https://esportnews.fr` | `/api/*` |

**Note**: L'URL de production dans `apiClient.ts` était incorrecte (`https://api.esportnews.com`) et a été corrigée en `https://esportnews.fr/api`.

### Gestion Platform-Specific (Development)

Le code `apiClient.ts` gère automatiquement :
- **iOS Simulator** → `http://localhost:4000`
- **Android Emulator** → `http://10.0.2.2:4000`
- **Production Build** → `https://esportnews.fr/api` (via env var)

### Premier Build après Changements

Après modification de `app.config.js` ou `eas.json`, toujours faire :
```bash
eas build --profile production --platform ios --clear-cache
```

Cela garantit que les nouvelles variables d'environnement sont appliquées.

## 🐛 Troubleshooting

### Erreur de connexion API en production
- Vérifier que `EXPO_PUBLIC_API_URL=https://esportnews.fr/api` dans les logs de build EAS
- Confirmer que le backend est accessible depuis `https://esportnews.fr/api/health`
- Vérifier les logs réseau dans l'app (React Native Debugger)

### Variables d'env non appliquées
- Rebuild avec `--clear-cache`
- Vérifier que `app.config.js` est bien utilisé (pas `app.json`)
- Confirmer que les variables sont dans `eas.json` sous le bon profil

### CORS errors
- Vérifier que le backend est démarré en production avec `.env.prod`
- Confirmer que `CORS_ORIGINS=https://esportnews.fr,https://www.esportnews.fr` dans `.env.prod`
- Les apps mobiles n'envoient **pas** d'en-tête `Origin`, donc le backend accepte origin vide

### Erreur Build iOS Local (`iOS 26.2 is not installed`)
Si `npx expo run:ios` échoue avec cette erreur, votre Xcode manque le Runtime 26.2.

**Solution 1 : Installer le runtime**
Dans Xcode > Settings > Components, téléchargez "iOS 26.2 Simulator".

**Solution 2 : Build Cloud pour Simulateur**
Utilisez EAS pour compiler dans le cloud sans utiliser votre Xcode local :
```bash
eas build --profile development:simulator --platform ios
```
Une fois terminé, téléchargez l'archive, décompressez-la, et glissez le fichier `.app` sur votre simulateur.
