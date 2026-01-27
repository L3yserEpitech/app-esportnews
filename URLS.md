# Configuration des URLs - Esport News

## 📋 Vue d'ensemble

| Environnement | Frontend | Backend | Mobile App |
|---------------|----------|---------|------------|
| **Développement** | `http://localhost:3002` | `http://localhost:4000` | Émulateur (iOS: localhost / Android: 10.0.2.2) |
| **Production** | `https://esportnews.fr` | `https://esportnews.fr/api` | `https://esportnews.fr/api` |

---

## 🖥️ Frontend (Next.js)

### Développement
Fichier : `/frontend/.env`

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXTAUTH_URL=http://localhost:3002
```

### Production
Fichier : `/frontend/.env.production`

```bash
NEXT_PUBLIC_BACKEND_URL=https://esportnews.fr
NEXT_PUBLIC_API_URL=https://esportnews.fr/api
NEXTAUTH_URL=https://esportnews.fr
```

**Important** : En production, les requêtes passent par le reverse proxy Nginx qui route `/api/*` vers le backend Go.

---

## 📱 Mobile App (React Native / Expo)

### Développement (Local)
Fichier : `/mobile-app/.env`

```bash
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_ENVIRONMENT=development
```

**Notes** :
- iOS Simulator : `http://localhost:4000` fonctionne directement
- Android Emulator : utilise automatiquement `http://10.0.2.2:4000` (voir `apiClient.ts`)
- Logic de mapping automatique dans `/mobile-app/services/apiClient.ts`

### Preview (EAS Build - Test Interne)
Fichier : `/mobile-app/eas.json` → profil `preview`

```json
{
  "env": {
    "EXPO_PUBLIC_API_URL": "https://esportnews.fr/api",
    "EXPO_PUBLIC_ENVIRONMENT": "preview"
  }
}
```

**Build command** :
```bash
eas build --profile preview --platform all
```

### Production (EAS Build - Stores)
Fichier : `/mobile-app/eas.json` → profil `production`

```json
{
  "env": {
    "EXPO_PUBLIC_API_URL": "https://esportnews.fr/api",
    "EXPO_PUBLIC_ENVIRONMENT": "production"
  }
}
```

**Build command** :
```bash
eas build --profile production --platform all
eas submit --platform all --latest
```

**Note importante** : Les fichiers `.env` ne sont **pas utilisés** lors des builds EAS. Seules les variables dans `eas.json` sont prises en compte.

---

## 🔧 Backend (Go)

### Configuration CORS
Fichier : `/backend-go/cmd/server/main.go`

```go
corsOrigins := []string{
    "http://localhost:3000",       // Next.js dev (ancien port)
    "http://localhost:3002",       // Next.js dev (nouveau port)
    "http://127.0.0.1:3002",      // Variante localhost
    "https://esportnews.fr",       // Production
    "https://www.esportnews.fr",   // Production avec www
    "http://esportnews.fr",        // HTTP redirect support
    "http://www.esportnews.fr",    // HTTP redirect support
}
```

### Routes exposées
- Toutes les routes API sont sous `/api/*`
- Exemple : `GET /api/tournaments`, `POST /api/auth/login`, etc.

---

## 🌐 Nginx (Reverse Proxy Production)

Fichier : `/nginx.conf`

```nginx
# Proxy vers Backend Go
location /api {
    proxy_pass http://backend:4000;
    # Headers CORS gérés par le backend Go
}

# Proxy vers Frontend Next.js
location / {
    proxy_pass http://frontend:3002;
}
```

**Flow de requête en production** :
1. Client (browser/mobile) → `https://esportnews.fr/api/tournaments`
2. Nginx reçoit la requête
3. Nginx forward vers `http://backend:4000/api/tournaments`
4. Backend Go répond avec headers CORS
5. Nginx retourne la réponse au client

---

## 🔒 CORS - Origines autorisées

Le backend Go accepte les requêtes depuis :

| Origin | Environnement | Description |
|--------|---------------|-------------|
| `http://localhost:3002` | Dev | Frontend Next.js local |
| `https://esportnews.fr` | Prod | Site web production |
| `https://www.esportnews.fr` | Prod | Site web production (avec www) |
| *Vide* (null origin) | Mobile | Applications mobiles natives |

**Note** : Les apps mobiles n'envoient pas d'origin header, donc le backend accepte les requêtes avec `origin === ""` mais **sans credentials**.

---

## 🐳 Docker Compose

### Services et ports
```yaml
services:
  frontend:
    ports: ["3002:3002"]  # Next.js
  backend:
    ports: ["4000:4000"]  # Go API
  postgres:
    ports: ["5432:5432"]  # PostgreSQL
  redis:
    ports: ["6379:6379"]  # Redis
```

### Accès inter-conteneurs
- Frontend → Backend : `http://backend:4000/api/*`
- Backend → PostgreSQL : `postgresql://postgres@postgres:5432/esportnews`
- Backend → Redis : `redis://redis:6379/0`

---

## ✅ Checklist de déploiement

### Frontend (Vercel / autre)
- [ ] Variable `NEXT_PUBLIC_BACKEND_URL=https://esportnews.fr`
- [ ] Variable `NEXT_PUBLIC_API_URL=https://esportnews.fr/api`
- [ ] Variable `NEXTAUTH_URL=https://esportnews.fr`
- [ ] Variable `NEXTAUTH_SECRET` (identique backend)

### Backend (serveur)
- [ ] Nginx configuré pour proxyer `/api` vers backend
- [ ] Certificats SSL Let's Encrypt installés
- [ ] Variables d'environnement backend configurées (`FRONTEND_URL`, `JWT_SECRET`, etc.)
- [ ] Docker Compose lancé : `docker-compose -f docker-compose.prod.yml up -d`

### Mobile App (EAS Build)
- [ ] Variable `EXPO_PUBLIC_API_URL=https://esportnews.fr/api` dans build profile
- [ ] Build production : `eas build --platform all --profile production`
- [ ] Tester sur device réel (pas émulateur) pour valider HTTPS

---

## 🛠️ Tests de connectivité

### Backend santé
```bash
# Développement
curl http://localhost:4000/health

# Production
curl https://esportnews.fr/api/health
```

### Frontend → Backend
```bash
# Depuis le container frontend
curl http://backend:4000/api/health
```

### CORS test (depuis navigateur)
```javascript
// Console navigateur sur https://esportnews.fr
fetch('https://esportnews.fr/api/tournaments')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

---

## 📝 Notes importantes

1. **Mobile sans origin** : Les apps natives n'envoient pas d'header `Origin`, c'est normal
2. **CORS credentials** : `AllowCredentials: true` requis pour authentification JWT
3. **Double slash** : Éviter `BACKEND_URL + '/api'` si `BACKEND_URL` contient déjà `/api`
4. **Cache CDN** : Invalider cache Cloudflare/CDN après déploiement backend
5. **Protocole HTTPS** : Toujours spécifier `https://` dans les origins CORS (pas juste le domaine)
