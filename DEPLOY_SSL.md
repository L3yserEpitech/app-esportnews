# 🚀 Guide de déploiement HTTPS pour esportnews.fr

Ce guide explique comment déployer l'application avec HTTPS via Nginx + Let's Encrypt.

---

## ✅ Prérequis

1. **DNS configuré** :
   ```
   www.esportnews.fr → A record → 51.38.36.120
   esportnews.fr     → A record → 51.38.36.120
   ```

2. **Ports ouverts sur le serveur** :
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
   - Port 4000 (Backend - optionnel si tu veux accès direct)
   - Port 3002 (Frontend - optionnel si tu veux accès direct)
   - Port 5432 (PostgreSQL)
   - Port 6379 (Redis)

3. **Docker et Docker Compose installés** sur le VPS

---

## 📝 Étape 1 : Vérifier la configuration DNS

```bash
# Sur ton ordinateur local
dig www.esportnews.fr +short
# Doit retourner : 51.38.36.120

dig esportnews.fr +short
# Doit retourner : 51.38.36.120
```

---

## 📝 Étape 2 : Obtenir le certificat SSL

**Sur le VPS (via SSH) :**

```bash
# Se connecter au VPS
ssh root@51.38.36.120

# Aller dans le dossier du projet
cd /chemin/vers/esportnews

# Exécuter le script de configuration SSL
chmod +x setup-ssl.sh
./setup-ssl.sh
```

Le script va :
- Installer certbot si nécessaire
- Obtenir un certificat SSL pour www.esportnews.fr et esportnews.fr
- Configurer le renouvellement automatique (cron)

**IMPORTANT** : Le script doit être exécuté **AVANT** de démarrer Nginx via Docker Compose, car il a besoin du port 80 libre.

---

## 📝 Étape 3 : Mettre à jour les variables d'environnement sur Dokploy

**Dans Dokploy → Environment Variables** :

```bash
# Frontend URLs (IMPORTANT : changer pour HTTPS)
NEXT_PUBLIC_BACKEND_URL=https://www.esportnews.fr
NEXT_PUBLIC_API_URL=https://www.esportnews.fr/api
FRONTEND_URL=https://www.esportnews.fr

# CORS (autoriser seulement les domaines HTTPS)
CORS_ORIGINS=https://www.esportnews.fr,https://esportnews.fr,http://localhost:3002
```

---

## 📝 Étape 4 : Déployer avec Docker Compose

**Sur le VPS :**

```bash
# Arrêter les anciens conteneurs
docker-compose -f docker-compose.prod.yml down

# Supprimer les anciennes images (optionnel)
docker image prune -a -f

# Rebuild et redémarrer tous les services
docker-compose -f docker-compose.prod.yml up -d --build

# Vérifier que tous les services sont up
docker-compose -f docker-compose.prod.yml ps
```

**Résultat attendu** :
```
NAME                        STATUS
esportnews-backend-prod     Up (healthy)
esportnews-cache-prod       Up (healthy)
esportnews-db-prod          Up (healthy)
esportnews-frontend-prod    Up
esportnews-nginx-prod       Up
```

---

## 📝 Étape 5 : Vérifier les logs

```bash
# Logs Nginx
docker logs esportnews-nginx-prod --tail 50

# Logs Backend
docker logs esportnews-backend-prod --tail 50

# Logs Frontend
docker logs esportnews-frontend-prod --tail 50
```

---

## 📝 Étape 6 : Tester l'application

### Test 1 : Redirection HTTP → HTTPS
```bash
curl -I http://www.esportnews.fr
# Doit retourner : 301 Moved Permanently
# Location: https://www.esportnews.fr
```

### Test 2 : API en HTTPS
```bash
curl -s https://www.esportnews.fr/api/games | jq '.[0]'
# Doit retourner : un jeu JSON (Valorant, CS2, etc.)
```

### Test 3 : Frontend en HTTPS
```bash
curl -I https://www.esportnews.fr
# Doit retourner : 200 OK
```

### Test 4 : Certificat SSL valide
```bash
openssl s_client -connect www.esportnews.fr:443 -servername www.esportnews.fr < /dev/null 2>/dev/null | grep "Verify return code"
# Doit retourner : Verify return code: 0 (ok)
```

---

## 🔧 Dépannage

### Erreur : "502 Bad Gateway"
- **Cause** : Le backend ou frontend ne répond pas
- **Solution** :
  ```bash
  docker logs esportnews-backend-prod --tail 100
  docker logs esportnews-frontend-prod --tail 100
  docker restart esportnews-backend-prod esportnews-frontend-prod
  ```

### Erreur : "SSL certificate problem"
- **Cause** : Certificat non généré ou expiré
- **Solution** :
  ```bash
  # Vérifier les certificats
  ls -la /etc/letsencrypt/live/www.esportnews.fr/

  # Renouveler manuellement
  certbot renew --force-renewal
  docker restart esportnews-nginx-prod
  ```

### Erreur : "CORS policy: No 'Access-Control-Allow-Origin' header"
- **Cause** : CORS_ORIGINS mal configuré
- **Solution** :
  ```bash
  # Vérifier les variables du backend
  docker exec esportnews-backend-prod printenv | grep CORS

  # Mettre à jour dans Dokploy et redéployer
  ```

### Frontend appelle encore http:// au lieu de https://
- **Cause** : Variables NEXT_PUBLIC_* compilées au build
- **Solution** :
  ```bash
  # Vérifier les variables du frontend
  docker exec esportnews-frontend-prod printenv | grep NEXT_PUBLIC

  # Si incorrectes, rebuild le frontend
  docker-compose -f docker-compose.prod.yml up -d --build frontend
  ```

---

## 🔄 Renouvellement automatique SSL

Le script `setup-ssl.sh` a configuré un cron job pour renouveler automatiquement le certificat :

```bash
# Voir le cron configuré
crontab -l

# Test manuel de renouvellement
certbot renew --dry-run
```

Le certificat sera renouvelé automatiquement 30 jours avant expiration.

---

## 📊 Architecture finale

```
Internet (HTTPS)
       ↓
   Nginx :443
    ├─→ /api/* → Backend Go :4000
    └─→ /*      → Frontend Next.js :3002
                      ↓
                PostgreSQL :5432
                Redis :6379
```

---

## ✅ Checklist finale

- [ ] DNS configuré (www.esportnews.fr → 51.38.36.120)
- [ ] Certificat SSL obtenu (`/etc/letsencrypt/live/www.esportnews.fr/`)
- [ ] Variables d'environnement mises à jour (HTTPS)
- [ ] Docker Compose up avec Nginx
- [ ] Test redirection HTTP → HTTPS
- [ ] Test API HTTPS (`/api/games`, `/api/articles`)
- [ ] Test frontend HTTPS
- [ ] Renouvellement auto SSL configuré

---

## 🆘 Support

Si tu rencontres un problème :

1. Vérifie les logs : `docker-compose logs`
2. Vérifie les DNS : `dig www.esportnews.fr`
3. Vérifie le certificat SSL : `ls -la /etc/letsencrypt/live/`
4. Vérifie les variables d'env : `docker exec <container> printenv`

Bon déploiement ! 🚀
