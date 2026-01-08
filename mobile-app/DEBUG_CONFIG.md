# 🐛 Debug Configuration - Mobile App iOS

## Modifications Effectuées

### ✅ 1. apiClient.ts - URL Hardcodée

**Fichier** : `services/apiClient.ts`

**Changement** :
```typescript
// AVANT (logique complexe avec env var qui ne fonctionnait pas)
const getBackendUrl = () => {
  const envApiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (envApiUrl && envApiUrl !== 'http://localhost:4000') {
    return envApiUrl;
  }
  // ...
  return 'https://esportnews.fr/api';
};

// APRÈS (logique simple et hardcodée)
const getBackendUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'ios') {
      return 'http://localhost:4000';
    } else if (Platform.OS === 'android') {
      return 'http://10.0.2.2:4000';
    }
  }
  // Production mode - HARDCODED
  return 'https://esportnews.fr/api';
};
```

**Résultat attendu** :
- En **development** (`__DEV__ = true`) → `http://localhost:4000` (iOS)
- En **production** (`__DEV__ = false`) → `https://esportnews.fr/api` ✅

### ✅ 2. Backend CORS - Configuration

**Fichier** : `backend-go/cmd/server/main.go:94-96`

```go
if origin == "" {
    // Apps mobiles et outils - pas de credentials autorisées
    return true, nil
}
```

**Résultat** : Les apps mobiles (qui n'envoient pas d'en-tête `Origin`) sont **automatiquement acceptées**. ✅

### ✅ 3. Production Environment Variables

**Fichier** : `.env.prod:45`

```bash
CORS_ORIGINS=https://esportnews.fr,https://www.esportnews.fr,
```

**Résultat** : Le backend en production accepte les requêtes depuis les URLs de production. ✅

## 🔍 Vérification sur iPhone

### Étape 1 : Ouvrir les logs React Native

Sur votre iPhone, **secouez l'appareil** pour ouvrir le menu de développement, puis :
1. Tap "Show Inspector"
2. Tap "Console" en bas
3. Ou utilisez Safari → Develop → [Votre iPhone] → [L'app]

### Étape 2 : Vérifier l'URL utilisée

Au démarrage de l'app, vous devriez voir dans les logs :

```
🚀 [apiClient] PRODUCTION MODE - Using https://esportnews.fr/api
🌐 [apiClient] Final BACKEND_URL set to: https://esportnews.fr/api
```

Si vous voyez ceci, l'URL est **correcte** ✅

### Étape 3 : Tester un appel API

Dans n'importe quelle page qui charge des données (Tournois, Matchs, Articles), vous devriez voir :

```
📡 API Call: GET /api/tournaments
✅ API Response: [données]
```

## 🚨 Si ça ne fonctionne toujours pas

### Test 1 : Vérifier __DEV__

Ajoutez temporairement ce code dans `app/_layout.tsx` :

```typescript
import { BACKEND_URL } from '@/services/apiClient';

console.log('=== DEBUG INFO ===');
console.log('__DEV__:', __DEV__);
console.log('BACKEND_URL:', BACKEND_URL);
console.log('Platform.OS:', Platform.OS);
```

**Résultat attendu en production** :
```
__DEV__: false
BACKEND_URL: https://esportnews.fr/api
Platform.OS: ios
```

### Test 2 : Vérifier la connectivité réseau

Ouvrez Safari sur votre iPhone et naviguez vers :
```
https://esportnews.fr/api/health
```

**Réponse attendue** :
```json
{"status":"ok"}
```

Si vous obtenez une erreur ici, le problème vient du backend, pas de l'app.

### Test 3 : Vérifier le build EAS

Dans les logs de votre dernier build (`eas build:view`), confirmez :
```
✓ Incremented buildNumber from 10 to 11
```

Assurez-vous que vous avez bien **installé le build 11** sur votre iPhone, pas un ancien build.

### Test 4 : Hardcoder complètement (test ultime)

Si rien ne fonctionne, modifiez `apiClient.ts` ligne 22 :

```typescript
// Test temporaire - hardcode total
export const BACKEND_URL = 'https://esportnews.fr/api';
console.log('🌐 [apiClient] HARDCODED BACKEND_URL:', BACKEND_URL);
```

Puis rebuild :
```bash
npm run build:prod:ios
```

## 🔧 Vérification Backend

### Vérifier que le backend tourne en production

```bash
# Sur votre serveur de production
docker-compose ps
# Devrait montrer : backend-go, postgres, redis (UP)

docker-compose logs backend-go | tail -50
# Devrait montrer : Server started on :4000
```

### Tester l'endpoint health depuis l'extérieur

```bash
curl https://esportnews.fr/api/health
# Devrait retourner : {"status":"ok"}
```

### Vérifier CORS pour mobile

```bash
curl -v https://esportnews.fr/api/health
# Vérifier la présence de : Access-Control-Allow-Origin: *
# (Ou absence d'en-tête Origin dans la requête)
```

## 📋 Checklist Complète

- [ ] Build 11 installé sur iPhone (pas build 10 ou antérieur)
- [ ] Logs console montrent `https://esportnews.fr/api`
- [ ] `__DEV__ = false` dans les logs
- [ ] Backend accessible via `https://esportnews.fr/api/health`
- [ ] Backend tourne en production avec `.env.prod`
- [ ] Pas d'erreur CORS dans les logs backend
- [ ] iPhone connecté à Internet (4G/5G ou WiFi)

## 🎯 Prochaines Étapes

1. **Rebuild l'app** avec le nouveau code hardcodé :
   ```bash
   cd mobile-app
   npm run build:prod:ios
   ```

2. **Installer le nouveau build** sur votre iPhone

3. **Tester immédiatement** en ouvrant la page Tournois ou Matchs

4. **Vérifier les logs** dans la console Safari

Si après toutes ces étapes ça ne fonctionne toujours pas, il faudra vérifier :
- Les règles firewall de votre serveur
- La configuration Nginx/reverse proxy (si présent)
- Les certificats SSL
