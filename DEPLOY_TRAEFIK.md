# 🚀 Déploiement HTTPS avec Traefik (Dokploy)

## ✅ Solution finale : Utiliser Traefik au lieu de Nginx

Puisque Dokploy utilise déjà **Traefik** comme reverse proxy sur les ports 80 et 443, on va l'utiliser pour gérer le SSL automatiquement !

---

## 🎯 Architecture

```
Internet
    ↓ HTTPS
Traefik :443 (géré par Dokploy)
    ├─→ www.esportnews.fr      → Frontend :3002
    └─→ www.esportnews.fr/api  → Backend :4000
```

**Avantages** :
- ✅ Pas de conflit de ports
- ✅ SSL automatique avec Let's Encrypt
- ✅ Renouvellement auto des certificats
- ✅ Pas de script SSL à exécuter manuellement
- ✅ Configuration via labels Docker

---

## 📝 Étapes de déploiement

### 1️⃣ Vérifier la configuration DNS

```bash
dig www.esportnews.fr +short
# Doit retourner : 51.38.36.120
```

### 2️⃣ Mettre à jour les variables d'environnement dans Dokploy

**Dans Dokploy → Ton projet → Environment Variables** :

```bash
# Frontend URLs
NEXT_PUBLIC_BACKEND_URL=https://www.esportnews.fr
NEXT_PUBLIC_API_URL=https://www.esportnews.fr/api
FRONTEND_URL=https://www.esportnews.fr

# CORS
CORS_ORIGINS=https://www.esportnews.fr,https://esportnews.fr,http://localhost:3002

# JWT
JWT_SECRET=super-secret-jwt-key-change-in-production-2025
NEXTAUTH_SECRET=cWuNvF!dwen44tup^yWA77wSdm@r!gQA
```

### 3️⃣ Push le code mis à jour

```bash
git add docker-compose.prod.yml .env
git commit -m "feat: Configurer Traefik pour HTTPS automatique"
git push
```

### 4️⃣ Redéployer dans Dokploy

1. Aller dans **Dokploy** → Ton projet
2. Cliquer sur **Redeploy**
3. Attendre la fin du build (5-10 min)

Traefik va automatiquement :
- Détecter les labels `traefik.*` dans le docker-compose
- Obtenir un certificat SSL Let's Encrypt pour `www.esportnews.fr`
- Router les requêtes HTTPS vers les bons services

---

## 🧪 Tests

### Test 1 : API en HTTPS

```bash
curl -s https://www.esportnews.fr/api/games | jq '.[0]'
```

**Résultat attendu** : Un jeu JSON (Valorant, CS2, etc.)

### Test 2 : Frontend en HTTPS

```bash
curl -I https://www.esportnews.fr
```

**Résultat attendu** : `200 OK`

### Test 3 : Redirection HTTP → HTTPS

```bash
curl -I http://www.esportnews.fr
```

**Résultat attendu** : `301 Moved Permanently` → `https://www.esportnews.fr`

### Test 4 : Certificat SSL valide

```bash
openssl s_client -connect www.esportnews.fr:443 -servername www.esportnews.fr < /dev/null 2>/dev/null | grep "Verify return code"
```

**Résultat attendu** : `Verify return code: 0 (ok)`

---

## 📊 Labels Traefik expliqués

### Backend (API)

```yaml
labels:
  - "traefik.enable=true"
  # Route : www.esportnews.fr/api/*
  - "traefik.http.routers.esportnews-backend.rule=Host(`www.esportnews.fr`) && PathPrefix(`/api`)"
  # Utilise le point d'entrée HTTPS (443)
  - "traefik.http.routers.esportnews-backend.entrypoints=websecure"
  # Active le SSL
  - "traefik.http.routers.esportnews-backend.tls=true"
  # Utilise Let's Encrypt
  - "traefik.http.routers.esportnews-backend.tls.certresolver=letsencrypt"
  # Le backend écoute sur le port 4000
  - "traefik.http.services.esportnews-backend.loadbalancer.server.port=4000"
```

### Frontend

```yaml
labels:
  - "traefik.enable=true"
  # Route : www.esportnews.fr (toutes les autres URLs)
  - "traefik.http.routers.esportnews-frontend.rule=Host(`www.esportnews.fr`)"
  - "traefik.http.routers.esportnews-frontend.entrypoints=websecure"
  - "traefik.http.routers.esportnews-frontend.tls=true"
  - "traefik.http.routers.esportnews-frontend.tls.certresolver=letsencrypt"
  # Priorité 1 (plus basse que le backend, donc traité après)
  - "traefik.http.routers.esportnews-frontend.priority=1"
  - "traefik.http.services.esportnews-frontend.loadbalancer.server.port=3002"
```

---

## 🔧 Dépannage

### Erreur : "502 Bad Gateway"

**Cause** : Le backend ou frontend ne répond pas

**Solution** :
```bash
sudo docker logs esportnews-backend-prod --tail 100
sudo docker logs esportnews-frontend-prod --tail 100
sudo docker restart esportnews-backend-prod esportnews-frontend-prod
```

### Erreur : "Certificate error"

**Cause** : Traefik n'a pas pu obtenir le certificat Let's Encrypt

**Solution** :
```bash
# Vérifier les logs Traefik
sudo docker logs dokploy-traefik --tail 100 | grep "acme"

# Vérifier que le DNS pointe bien vers le serveur
dig www.esportnews.fr +short
```

### Erreur : "CORS policy"

**Cause** : CORS_ORIGINS mal configuré dans le backend

**Solution** :
```bash
# Vérifier les variables du backend
sudo docker exec esportnews-backend-prod printenv | grep CORS

# Mettre à jour dans Dokploy et redéployer
CORS_ORIGINS=https://www.esportnews.fr,https://esportnews.fr
```

### Frontend appelle encore http:// au lieu de https://

**Cause** : Variables NEXT_PUBLIC_* compilées au build avec anciennes valeurs

**Solution** :
```bash
# Vérifier les variables du frontend
sudo docker exec esportnews-frontend-prod printenv | grep NEXT_PUBLIC

# Si incorrectes, mettre à jour dans Dokploy et redéployer
```

---

## ✅ Checklist finale

- [ ] DNS configuré (`www.esportnews.fr` → `51.38.36.120`)
- [ ] Variables d'environnement mises à jour (HTTPS)
- [ ] Code pushé sur Git
- [ ] Redéploiement dans Dokploy terminé
- [ ] Test API HTTPS (`/api/games`)
- [ ] Test frontend HTTPS
- [ ] Test redirection HTTP → HTTPS
- [ ] Certificat SSL valide (vérif navigateur)

---

## 🎉 Avantages de cette solution

✅ **Pas de script SSL à exécuter** : Traefik gère tout automatiquement
✅ **Renouvellement automatique** : Certificats renouvelés tous les 90 jours
✅ **Pas de conflit de ports** : Traefik est déjà sur 80/443
✅ **Configuration simple** : Juste des labels Docker
✅ **Géré par Dokploy** : Interface web pour tout monitorer

Bon déploiement ! 🚀
