# ⚡ Déploiement rapide HTTPS - esportnews.fr

## 🎯 Ce qu'on va faire

Activer HTTPS sur www.esportnews.fr avec Nginx comme reverse proxy.

**Avant** :
```
Frontend : https://www.esportnews.fr (OK)
Backend  : http://51.38.36.120:4000 (PAS OK - mixed content)
```

**Après** :
```
Frontend : https://www.esportnews.fr → Nginx → Frontend :3002
Backend  : https://www.esportnews.fr/api → Nginx → Backend :4000
```

---

## 📋 Commandes à exécuter

### 1️⃣ Sur ton VPS (SSH)

```bash
# Se connecter
ssh root@51.38.36.120

# Aller dans le dossier projet (à adapter selon ton chemin)
cd /path/to/esportnews

# Obtenir le certificat SSL
chmod +x setup-ssl.sh
./setup-ssl.sh
# → Confirmer que les DNS sont OK quand demandé

# Déployer avec Nginx
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# Vérifier
docker-compose -f docker-compose.prod.yml ps
# Tous les services doivent être "Up"
```

### 2️⃣ Sur Dokploy (Interface web)

**Modifier les Environment Variables** :

```bash
NEXT_PUBLIC_BACKEND_URL=https://www.esportnews.fr
NEXT_PUBLIC_API_URL=https://www.esportnews.fr/api
CORS_ORIGINS=https://www.esportnews.fr,https://esportnews.fr,http://localhost:3002
```

**Puis redéployer** backend et frontend depuis l'interface Dokploy.

### 3️⃣ Tester

```bash
# Test API
curl https://www.esportnews.fr/api/games

# Test frontend
curl -I https://www.esportnews.fr
```

✅ Si tu vois les jeux en JSON, c'est bon !

---

## 📝 Fichiers créés

- `nginx.conf` - Configuration Nginx reverse proxy
- `setup-ssl.sh` - Script pour obtenir certificat SSL
- `docker-compose.prod.yml` - Mis à jour avec service Nginx
- `.env` - Mis à jour avec URLs HTTPS

---

## ⚠️ Prérequis

1. **DNS configuré** : `www.esportnews.fr` doit pointer vers `51.38.36.120`
2. **Ports ouverts** : 80, 443, 4000, 3002, 5432, 6379

Vérifie le DNS :
```bash
dig www.esportnews.fr +short
# Doit afficher : 51.38.36.120
```

---

## 🆘 Problème ?

Voir le guide complet : [DEPLOY_SSL.md](./DEPLOY_SSL.md)
