# 🚀 Guide Complet d'Installation et Sécurisation VPS Esportnews

> Documentation exhaustive pour réinstaller et configurer un VPS Ubuntu 24.04 LTS avec Dokploy, PostgreSQL, Redis, Backend Go et Frontend Next.js

---

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Choix et Installation du Système](#choix-et-installation-du-système)
3. [Première Connexion SSH](#première-connexion-ssh)
4. [Sécurisation SSH](#sécurisation-ssh)
5. [Configuration du Firewall (UFW)](#configuration-du-firewall-ufw)
6. [Installation Fail2Ban](#installation-fail2ban)
7. [Mises à Jour Automatiques](#mises-à-jour-automatiques)
8. [Installation Dokploy](#installation-dokploy)
9. [Configuration DNS](#configuration-dns)
10. [Déploiement de l'Application](#déploiement-de-lapplication)
11. [Import des Données en Base](#import-des-données-en-base)
12. [Troubleshooting](#troubleshooting)
13. [Commandes Utiles](#commandes-utiles)

---

## Prérequis

### Matériel
- **VPS OVH** (ou équivalent)
- **RAM** : Minimum 4GB recommandé
- **Stockage** : Minimum 100GB
- **IP publique** : Fournie par OVH

### Accès
- Accès au panel OVH
- Clé SSH générée sur votre machine locale
- Accès DNS de votre domaine (esportnews.fr)

### Sur votre machine locale
- Terminal avec accès SSH
- Git installé
- Clé SSH ED25519 générée

---

## Choix et Installation du Système

### 1. Sélection de l'OS dans le Panel OVH

**OS recommandé** : **Ubuntu 24.04 LTS**

**Pourquoi Ubuntu 24.04 LTS ?**
- ✅ Support Long Term (5 ans jusqu'en 2029)
- ✅ Compatibilité Dokploy optimale
- ✅ Dépendances Docker bien gérées
- ✅ Kernel récent (6.8+)
- ✅ Documentation abondante

**Alternatives** :
- Ubuntu 22.04 LTS (fonctionne mais support plus court)
- Debian 12 (moins testé avec Dokploy)

**À éviter** :
- Distributions non-Debian (Fedora, CentOS)
- Versions non-LTS

### 2. Installation

1. Connectez-vous au panel OVH
2. Sélectionnez votre VPS
3. Choisissez **"Réinstaller mon VPS"**
4. Sélectionnez **Ubuntu 24.04 LTS**
5. Choisissez un mot de passe root temporaire
6. Lancez l'installation (10-15 minutes)

---

## Première Connexion SSH

### 1. Connexion initiale avec mot de passe

```bash
ssh ubuntu@VOTRE_IP_VPS
```

**Note** : Si vous avez réinstallé le VPS, vous verrez un warning "REMOTE HOST IDENTIFICATION HAS CHANGED".

**Solution** :
```bash
ssh-keygen -R VOTRE_IP_VPS
```

### 2. Changement du mot de passe obligatoire

Lors de la première connexion, le système vous demandera de changer le mot de passe.

```
Current password: [mot de passe temporaire OVH]
New password: [votre nouveau mot de passe fort]
Retype new password: [confirmation]
```

### 3. Reconnexion après changement

```bash
ssh ubuntu@VOTRE_IP_VPS
```

### 4. Mise à jour du système

```bash
sudo apt update && sudo apt upgrade -y
```

**Durée** : 2-5 minutes selon les packages à mettre à jour.

---

## Sécurisation SSH

### 1. Génération de clé SSH sur votre machine locale

**Si vous n'avez pas déjà de clé ED25519** :

```bash
ssh-keygen -t ed25519 -C "esportnews-vps"
```

- Appuyez sur **Entrée** pour l'emplacement par défaut (`~/.ssh/id_ed25519`)
- Choisissez une **passphrase** (recommandé mais optionnel)

### 2. Copie de la clé publique vers le VPS

```bash
ssh-copy-id ubuntu@VOTRE_IP_VPS
```

Entrez le mot de passe ubuntu quand demandé.

**Output attendu** :
```
Number of key(s) added: 1
```

### 3. Test de connexion sans mot de passe

```bash
ssh ubuntu@VOTRE_IP_VPS
```

Vous devriez vous connecter **sans demande de mot de passe**.

### 4. Désactivation de l'authentification par mot de passe

**⚠️ IMPORTANT** : Ne faites cette étape qu'après avoir vérifié que la connexion par clé SSH fonctionne !

```bash
sudo vim /etc/ssh/sshd_config
```

**Modifications à faire** :

Cherchez et modifiez ces lignes (supprimez le `#` si présent) :

```conf
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
```

**Enregistrez** : `Esc` → `:wq` → `Entrée`

### 5. Redémarrage du service SSH

```bash
sudo systemctl restart ssh
```

**Vérification** :
```bash
sudo systemctl status ssh
```

Output attendu : `Active: active (running)`

---

## Configuration du Firewall (UFW)

### 1. Autoriser SSH avant d'activer UFW

```bash
sudo ufw allow OpenSSH
```

### 2. Activer le firewall

```bash
sudo ufw enable
```

Tapez `y` pour confirmer.

### 3. Autoriser HTTP et HTTPS

```bash
sudo ufw allow 80,443/tcp
```

### 4. Vérifier le statut

```bash
sudo ufw status verbose
```

**Output attendu** :
```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), deny (routed)

To                         Action      From
--                         ------      ----
22/tcp (OpenSSH)           ALLOW IN    Anywhere
80,443/tcp                 ALLOW IN    Anywhere
22/tcp (OpenSSH (v6))      ALLOW IN    Anywhere (v6)
80,443/tcp (v6)            ALLOW IN    Anywhere (v6)
```

---

## Installation Fail2Ban

### 1. Installation du package

```bash
sudo apt install fail2ban -y
```

### 2. Vérification du service

```bash
sudo systemctl status fail2ban
```

**Output attendu** :
```
● fail2ban.service - Fail2Ban Service
   Active: active (running)
```

### 3. Configuration par défaut

Fail2Ban est configuré automatiquement pour protéger SSH.

**Vérifier les jails actifs** :
```bash
sudo fail2ban-client status
```

---

## Mises à Jour Automatiques

### 1. Installation du package

```bash
sudo apt install unattended-upgrades -y
```

### 2. Configuration interactive

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Sélectionnez **"Yes"** avec les flèches et Entrée.

### 3. Vérification de la configuration

```bash
cat /etc/apt/apt.conf.d/20auto-upgrades
```

**Output attendu** :
```
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

### 4. Configuration des notifications email (optionnel)

```bash
sudo vim /etc/apt/apt.conf.d/50unattended-upgrades
```

**Modifications** :

Cherchez et modifiez :
```conf
Unattended-Upgrade::Mail "votreemail@example.com";
Unattended-Upgrade::MailReport "only-on-error";
```

### 5. Test en dry-run

```bash
sudo unattended-upgrades --dry-run --debug
```

**Output attendu** :
```
No packages found that can be upgraded unattended and no pending auto-removals
```

---

## Installation Dokploy

### 1. Exécution du script d'installation

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

**Durée** : 2-3 minutes

**Output final attendu** :
```
Congratulations, Dokploy is installed!
Wait 15 seconds for the server to start
Please go to http://VOTRE_IP_VPS:3000
```

### 2. Premier accès à Dokploy

Ouvrez votre navigateur :
```
http://VOTRE_IP_VPS:3000
```

**Configuration initiale** :
- Créez un compte admin
- Configurez le mot de passe

### 3. Redémarrage du VPS (mise à jour kernel)

```bash
sudo reboot
```

Attendez 30-60 secondes, puis reconnectez-vous :
```bash
ssh ubuntu@VOTRE_IP_VPS
```

### 4. Vérification Docker

```bash
docker --version
```

**Output attendu** :
```
Docker version 28.5.0, build 887030f
```

```bash
docker ps
```

Vous devriez voir les conteneurs Dokploy actifs.

---

## Configuration DNS

### 1. Enregistrements DNS requis

Dans votre interface DNS (OVH, Cloudflare, etc.), ajoutez :

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | @ | VOTRE_IP_VPS | 300 |
| A | www | VOTRE_IP_VPS | 300 |
| A | api | VOTRE_IP_VPS | 300 |
| A | admin-vps | VOTRE_IP_VPS | 300 |

**Pour Esportnews** :
- `esportnews.fr` → VOTRE_IP_VPS
- `www.esportnews.fr` → VOTRE_IP_VPS
- `api.esportnews.fr` → VOTRE_IP_VPS
- `admin-vps.space` → VOTRE_IP_VPS (domaine séparé pour Dokploy)

### 2. Vérification DNS

```bash
dig esportnews.fr +short
dig api.esportnews.fr +short
dig admin-vps.space +short
```

**Output attendu** : votre IP VPS pour chaque domaine.

### 3. Configuration du domaine Dokploy

1. Accédez à Dokploy : `http://VOTRE_IP_VPS:3000`
2. Allez dans **Settings → Server → Domain**
3. Remplissez :
   - **Domain** : `admin-vps.space`
   - **Let's Encrypt Email** : votre email
   - Activez **HTTPS** (toggle ON)
   - **Certificate Provider** : Let's Encrypt
4. Cliquez sur **Save**

**Attendez 1-2 minutes** pour la génération du certificat SSL.

### 4. Test HTTPS

```bash
curl -I https://admin-vps.space
```

**Output attendu** : `HTTP/2 200` avec certificat SSL valide.

### 5. Fermeture du port 3000 (optionnel)

Le port 3000 n'est normalement pas exposé publiquement si vous utilisez Dokploy correctement via Traefik.

**Vérification** :
```bash
sudo ufw status
```

Le port 3000 ne devrait **PAS** apparaître dans la liste.

---

## Déploiement de l'Application

### 1. Préparation du code en local

#### a. Vérifier le fichier `.env.prod`

Créez/modifiez `/votre/projet/esportnews/.env.prod` :

```env
# ============================================
# ESPORT NEWS - Variables d'environnement PRODUCTION
# ============================================

# ===================
# Server / Backend Go
# ===================
PORT=4000
ENV=production
ENVIRONMENT=production
SERVER_PORT=4000
SERVER_HOST=0.0.0.0
LOG_LEVEL=info

# ===================
# Database (PostgreSQL)
# ===================
DB_USER=postgres
DB_PASSWORD=VOTRE_PASSWORD_POSTGRES_SECURISE
DB_NAME=esportnews
POSTGRES_USER=postgres
POSTGRES_PASSWORD=VOTRE_PASSWORD_POSTGRES_SECURISE
POSTGRES_DB=esportnews
DATABASE_URL=postgresql://postgres:VOTRE_PASSWORD_POSTGRES_SECURISE@postgres:5432/esportnews?sslmode=disable

# ===================
# Redis
# ===================
REDIS_PASSWORD=VOTRE_PASSWORD_REDIS_SECURISE
REDIS_URL=redis://:VOTRE_PASSWORD_REDIS_SECURISE@redis:6379/0

# ===================
# JWT
# ===================
JWT_SECRET=VOTRE_JWT_SECRET_SECURISE

# ===================
# Frontend (Next.js) - URLs PRODUCTION
# ===================
NEXT_PUBLIC_BACKEND_URL=https://api.esportnews.fr
NEXT_PUBLIC_API_URL=https://api.esportnews.fr/api
NEXTAUTH_SECRET=VOTRE_NEXTAUTH_SECRET_SECURISE
NEXTAUTH_URL=https://esportnews.fr
FRONTEND_URL=https://esportnews.fr
CORS_ORIGINS=https://esportnews.fr,https://www.esportnews.fr,https://api.esportnews.fr

# ===================
# APIs Externes
# ===================
PANDASCORE_API_KEY=VOTRE_CLE_API_PANDASCORE
SPORTDEVS_API_KEY=VOTRE_CLE_API_SPORTDEVS

# ===================
# Stripe
# ===================
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=VOTRE_CLE_PUBLIQUE_STRIPE
STRIPE_SECRET_KEY_LIVE=VOTRE_CLE_SECRETE_STRIPE_LIVE
STRIPE_SECRET_KEY=VOTRE_CLE_SECRETE_STRIPE_TEST
STRIPE_PRICE_ID=VOTRE_PRICE_ID_STRIPE
STRIPE_WEBHOOK_SECRET=VOTRE_WEBHOOK_SECRET_STRIPE

# ===================
# Email (Resend)
# ===================
RESEND_API_KEY=VOTRE_CLE_API_RESEND
EMAIL_FROM=noreply@esportnews.fr

# ===================
# Cloudflare R2 Storage
# ===================
CLOUDFLARE_ACCOUNT_ID=VOTRE_ACCOUNT_ID
CLOUDFLARE_R2_ENDPOINT=https://VOTRE_ACCOUNT_ID.r2.cloudflarestorage.com
CLOUDFLARE_R2_BUCKET_NAME=esportnews-bucket
CLOUDFLARE_R2_ACCESS_KEY_ID=VOTRE_ACCESS_KEY
CLOUDFLARE_R2_SECRET_ACCESS_KEY=VOTRE_SECRET_KEY
CLOUDFLARE_R2_PUBLIC_URL=https://pub-XXXXXXXXX.r2.dev

# ===================
# Upload Configuration
# ===================
MAX_UPLOAD_SIZE=524288000
UPLOAD_TIMEOUT=600

# ===================
# Performance
# ===================
CACHE_TTL=3600
DB_MAX_CONNECTIONS=50
```

**⚠️ IMPORTANT** : Remplacez toutes les valeurs `VOTRE_*` par vos vraies valeurs.

#### b. Vérifier les migrations SQL

Vérifiez que tous les fichiers de migrations sont présents dans `/backend-go/migrations/` :

```bash
ls -lh backend-go/migrations/
```

**Fichiers requis** :
- `00000_init.sh`
- `00000_init_user.sql`
- `00001_initial_schema.sql`
- `00001a_add_age_to_users.sql`
- `00001b_add_stripe_fields_to_users.sql`
- `00002_users.sql` (dump complet avec 39 users)
- `00003_games.sql` (10 jeux)
- `00004_ads.sql` (2 publicités)
- `00005_add_article_content.sql`
- `00006_add_credit_to_articles.sql`
- `00007_import_articles.sql` (72 articles, ~13MB)
- `00009_create_page_views.sql`
- `00010_notifications.sql`
- `00011_page_views.sql`

#### c. Commit et push sur GitHub

```bash
git add .
git commit -m "Production ready: migrations + .env.prod"
git push origin main
```

**Si erreur "Permission denied (publickey)"** :

1. Générez une clé SSH si pas déjà fait :
   ```bash
   ssh-keygen -t ed25519 -C "votre@email.com"
   ```

2. Ajoutez la clé à l'agent SSH :
   ```bash
   ssh-add ~/.ssh/id_ed25519
   ```

3. Copiez la clé publique :
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

4. Ajoutez la clé sur GitHub :
   - https://github.com/settings/keys
   - **New SSH key**
   - Collez la clé

5. Testez :
   ```bash
   ssh -T git@github.com
   ```

### 2. Déploiement via Dokploy

#### a. Création du projet dans Dokploy

1. Connectez-vous à `https://admin-vps.space`
2. Cliquez sur **New Project**
3. Remplissez :
   - **Project Name** : `esportnews`
   - **Type** : **Docker Compose**
4. Cliquez sur **Create**

#### b. Configuration du repository

1. Allez dans l'onglet **Git**
2. Remplissez :
   - **Repository URL** : `https://github.com/VOTRE_USERNAME/esportnews.git`
   - **Branch** : `main`
   - **Compose File Path** : `docker-compose.prod.yml`
3. Cliquez sur **Save**

#### c. Configuration des variables d'environnement

1. Allez dans l'onglet **Environment Variables**
2. Choisissez **Load from file**
3. Sélectionnez `.env.prod`
4. Cliquez sur **Import**

#### d. Déploiement

1. Allez dans l'onglet **Deployments**
2. Cliquez sur **Deploy**
3. Attendez 5-10 minutes

**Vérification** :
```bash
docker ps
```

**Output attendu** :
```
CONTAINER ID   IMAGE                    STATUS
xxxxxxxxxxxx   esportnews-frontend-prod   Up X minutes
xxxxxxxxxxxx   esportnews-backend-prod    Up X minutes
xxxxxxxxxxxx   esportnews-db-prod         Up X minutes
xxxxxxxxxxxx   esportnews-cache-prod      Up X minutes
```

---

## Import des Données en Base

### ⚠️ PROBLÈME CONNU : Dokploy n'exécute pas init-db.sh

Le script `init-db.sh` n'est **pas monté** correctement par Dokploy dans le conteneur PostgreSQL.

**Solution** : Import manuel des migrations.

### 1. Vérifier que les migrations sont présentes

```bash
sudo docker exec esportnews-backend-prod ls -la /app/migrations/
```

**Output attendu** : tous les fichiers `.sql` listés.

### 2. Import du schéma initial

```bash
sudo docker exec -i esportnews-db-prod psql -U postgres -d esportnews < <(sudo docker exec esportnews-backend-prod cat /app/migrations/00001_initial_schema.sql)
```

**Output attendu** :
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
```

### 3. Ajout des colonnes Stripe

```bash
sudo docker exec -i esportnews-db-prod psql -U postgres -d esportnews < <(sudo docker exec esportnews-backend-prod cat /app/migrations/00001b_add_stripe_fields_to_users.sql)
```

### 4. Import des utilisateurs

```bash
sudo docker exec -i esportnews-db-prod psql -U postgres -d esportnews < <(sudo docker exec esportnews-backend-prod cat /app/migrations/00002_users.sql)
```

**Output attendu** :
```
COPY 39
```

**Vérification** :
```bash
sudo docker exec esportnews-db-prod psql -U postgres -d esportnews -c "SELECT COUNT(*) FROM users;"
```

**Output** : `39`

### 5. Import des jeux

```bash
sudo docker exec -i esportnews-db-prod psql -U postgres -d esportnews < <(sudo docker exec esportnews-backend-prod cat /app/migrations/00003_games.sql)
```

**Output attendu** :
```
COPY 10
```

**Vérification** :
```bash
sudo docker exec esportnews-db-prod psql -U postgres -d esportnews -c "SELECT COUNT(*) FROM games;"
```

**Output** : `10`

### 6. Import des publicités

```bash
sudo docker exec -i esportnews-db-prod psql -U postgres -d esportnews < <(sudo docker exec esportnews-backend-prod cat /app/migrations/00004_ads.sql)
```

**Output attendu** :
```
COPY 2
```

### 7. Ajout de la colonne credit

```bash
sudo docker exec -i esportnews-db-prod psql -U postgres -d esportnews < <(sudo docker exec esportnews-backend-prod cat /app/migrations/00006_add_credit_to_articles.sql)
```

### 8. Import des articles

```bash
sudo docker exec -i esportnews-db-prod psql -U postgres -d esportnews < <(sudo docker exec esportnews-backend-prod cat /app/migrations/00007_import_articles.sql)
```

**Output attendu** :
```
COPY 72
```

**Vérification** :
```bash
sudo docker exec esportnews-db-prod psql -U postgres -d esportnews -c "SELECT COUNT(*) FROM articles;"
```

**Output** : `72`

### 9. Vidage du cache Redis

```bash
sudo docker exec esportnews-cache-prod redis-cli -a VOTRE_REDIS_PASSWORD FLUSHALL
```

**⚠️ Remplacez `VOTRE_REDIS_PASSWORD` par votre mot de passe Redis.**

### 10. Redémarrage du backend

```bash
sudo docker restart esportnews-backend-prod
```

Attendez 10 secondes.

### 11. Vérification finale des APIs

```bash
curl -s https://esportnews.fr/api/games | jq 'length'
curl -s https://esportnews.fr/api/articles | jq 'length'
```

**Output attendu** :
```
10  # pour games
20  # pour articles (pagination par défaut)
```

---

## Troubleshooting

### Problème : Port 3000 toujours ouvert

**Symptôme** : Le port 3000 est accessible publiquement.

**Solution** :
```bash
sudo ufw delete allow 3000/tcp
sudo ufw status
```

### Problème : Certificat SSL non généré

**Symptôme** : `https://admin-vps.space` ne fonctionne pas.

**Solution** :
1. Vérifiez les logs Traefik dans Dokploy
2. Assurez-vous que le DNS pointe bien vers l'IP
3. Attendez 2-3 minutes après la configuration

### Problème : API retourne tableau vide

**Symptôme** : `curl https://esportnews.fr/api/games` retourne `[]`.

**Causes possibles** :
1. **Cache Redis** : Videz le cache
   ```bash
   sudo docker exec esportnews-cache-prod redis-cli -a PASSWORD FLUSHALL
   ```

2. **Backend pas redémarré** :
   ```bash
   sudo docker restart esportnews-backend-prod
   ```

3. **Données pas importées** :
   Vérifiez en base :
   ```bash
   sudo docker exec esportnews-db-prod psql -U postgres -d esportnews -c "SELECT COUNT(*) FROM games;"
   ```

### Problème : Migrations échouent avec "duplicate key"

**Symptôme** : `ERROR: duplicate key value violates unique constraint`

**Solution** : Videz la table et réimportez
```bash
sudo docker exec esportnews-db-prod psql -U postgres -d esportnews -c "TRUNCATE TABLE_NAME RESTART IDENTITY CASCADE;"
# Puis réexécutez la migration
```

### Problème : Permission denied sur Docker

**Symptôme** : `permission denied while trying to connect to the Docker daemon socket`

**Solution** :
```bash
sudo usermod -aG docker ubuntu
# Déconnectez-vous et reconnectez-vous
exit
ssh ubuntu@VOTRE_IP_VPS
```

### Problème : Connexion SSH refusée après sécurisation

**Symptôme** : `Permission denied (publickey)`

**Solution** :
1. Vérifiez que votre clé SSH est chargée :
   ```bash
   ssh-add -l
   ```

2. Si vide, ajoutez la clé :
   ```bash
   ssh-add ~/.ssh/id_ed25519
   ```

3. En dernier recours, connectez-vous via la console OVH et réactivez temporairement `PasswordAuthentication yes`.

---

## Commandes Utiles

### Docker

```bash
# Lister tous les conteneurs
sudo docker ps -a

# Voir les logs d'un conteneur
sudo docker logs CONTAINER_NAME --tail 100

# Redémarrer un conteneur
sudo docker restart CONTAINER_NAME

# Se connecter à un conteneur
sudo docker exec -it CONTAINER_NAME sh

# Voir l'utilisation des ressources
sudo docker stats
```

### PostgreSQL

```bash
# Se connecter à PostgreSQL
sudo docker exec -it esportnews-db-prod psql -U postgres -d esportnews

# Lister les tables
\dt

# Compter les lignes d'une table
SELECT COUNT(*) FROM table_name;

# Voir la structure d'une table
\d table_name

# Exécuter une requête SQL
sudo docker exec esportnews-db-prod psql -U postgres -d esportnews -c "SELECT * FROM games LIMIT 5;"
```

### Redis

```bash
# Se connecter à Redis
sudo docker exec -it esportnews-cache-prod redis-cli -a PASSWORD

# Lister toutes les clés
KEYS *

# Vider tout le cache
FLUSHALL

# Obtenir une valeur
GET cache:games

# Voir les infos Redis
INFO
```

### UFW

```bash
# Voir le statut
sudo ufw status verbose

# Autoriser un port
sudo ufw allow PORT/tcp

# Supprimer une règle
sudo ufw delete allow PORT/tcp

# Réinitialiser UFW
sudo ufw reset
```

### Fail2Ban

```bash
# Voir le statut
sudo systemctl status fail2ban

# Voir les jails actives
sudo fail2ban-client status

# Débannir une IP
sudo fail2ban-client set sshd unbanip IP_ADDRESS
```

### Système

```bash
# Voir l'utilisation disque
df -h

# Voir l'utilisation RAM
free -h

# Voir les processus
htop

# Voir les logs système
sudo journalctl -xe

# Redémarrer le VPS
sudo reboot
```

---

## Checklist de Déploiement

### Avant le déploiement

- [ ] OS Ubuntu 24.04 LTS installé
- [ ] Première connexion SSH réussie
- [ ] Système mis à jour (`apt update && apt upgrade`)
- [ ] Clé SSH générée et copiée sur le VPS
- [ ] SSH sécurisé (mot de passe désactivé)
- [ ] UFW configuré et actif
- [ ] Fail2Ban installé et actif
- [ ] Mises à jour automatiques configurées
- [ ] Dokploy installé
- [ ] VPS redémarré (nouveau kernel)
- [ ] DNS configurés et propagés
- [ ] SSL Dokploy généré (`https://admin-vps.space`)
- [ ] Code pushé sur GitHub (branche `main`)
- [ ] Fichier `.env.prod` configuré

### Déploiement

- [ ] Projet créé dans Dokploy (type Docker Compose)
- [ ] Repository GitHub connecté
- [ ] Variables d'environnement importées
- [ ] Déploiement lancé
- [ ] 4 conteneurs actifs (frontend, backend, postgres, redis)

### Import données

- [ ] Schéma initial créé (`00001_initial_schema.sql`)
- [ ] Colonnes Stripe ajoutées (`00001b`)
- [ ] 39 utilisateurs importés (`00002_users.sql`)
- [ ] 10 jeux importés (`00003_games.sql`)
- [ ] 2 publicités importées (`00004_ads.sql`)
- [ ] Colonne `credit` ajoutée (`00006`)
- [ ] 72 articles importés (`00007_import_articles.sql`)
- [ ] Cache Redis vidé
- [ ] Backend redémarré

### Vérification

- [ ] `https://esportnews.fr` accessible
- [ ] `https://api.esportnews.fr/api/games` retourne 10 jeux
- [ ] `https://api.esportnews.fr/api/articles` retourne 20 articles
- [ ] `https://admin-vps.space` accessible (Dokploy)
- [ ] Certificats SSL valides (cadenas vert)
- [ ] Aucune erreur dans les logs backend
- [ ] Firewall actif avec bonnes règles

---

## Sécurité Post-Déploiement

### Recommandations supplémentaires

1. **Backups automatiques** :
   - Configurer des snapshots OVH hebdomadaires
   - Script de backup PostgreSQL quotidien
   - Stockage distant des backups (S3, Backblaze)

2. **Monitoring** :
   - Uptime monitoring (UptimeRobot, Pingdom)
   - Alertes par email en cas de downtime
   - Surveillance des ressources (CPU, RAM, disque)

3. **Rate limiting** :
   - Configurer Traefik pour limiter les requêtes par IP
   - Protection DDoS basique

4. **Logs** :
   - Rotation des logs Docker
   - Conservation limitée (7-30 jours)
   - Analyse régulière des logs d'accès

5. **Mises à jour** :
   - Vérifier les logs de `unattended-upgrades`
   - Tester les mises à jour en staging avant prod
   - Redémarrer le VPS mensuellement (kernel updates)

---

## Informations de Contact & Support

### Documentation officielle

- **Dokploy** : https://docs.dokploy.com
- **Ubuntu** : https://help.ubuntu.com
- **Docker** : https://docs.docker.com
- **PostgreSQL** : https://www.postgresql.org/docs/
- **Redis** : https://redis.io/docs/

### Support OVH

- Panel : https://www.ovh.com/manager/
- Documentation : https://help.ovhcloud.com/
- Support : via le panel OVH

---

## Changelog

### 2025-12-26 - Installation initiale
- Configuration complète VPS Ubuntu 24.04 LTS
- Sécurisation SSH + UFW + Fail2Ban
- Installation Dokploy
- Déploiement Esportnews (Frontend + Backend Go + PostgreSQL + Redis)
- Import complet des données (39 users, 10 games, 72 articles, 2 ads)
- Configuration DNS et SSL

---

## Notes Importantes

### Mots de passe à conserver

**⚠️ CONSERVEZ CES INFORMATIONS EN LIEU SÛR** :

- Mot de passe utilisateur `ubuntu` du VPS
- Mot de passe PostgreSQL (`POSTGRES_PASSWORD` dans `.env.prod`)
- Mot de passe Redis (`REDIS_PASSWORD` dans `.env.prod`)
- JWT Secret (`JWT_SECRET` dans `.env.prod`)
- Clés API (PandaScore, SportDevs, Stripe, Resend, Cloudflare)
- Mot de passe admin Dokploy

### Fichiers critiques à ne jamais commit

- `.env` (local)
- `.env.prod` (contient secrets)
- `*.key` (clés privées)
- `*.pem` (certificats privés)

**Ajoutez dans `.gitignore`** :
```
.env
.env.prod
.env.local
*.key
*.pem
```

### Sauvegarde de la configuration

**Exportez votre configuration régulièrement** :

```bash
# Sauvegarde PostgreSQL
sudo docker exec esportnews-db-prod pg_dump -U postgres esportnews > backup_$(date +%Y%m%d).sql

# Sauvegarde du .env.prod (chiffré)
gpg -c .env.prod

# Sauvegarde des fichiers de config UFW
sudo cp /etc/ufw/user.rules ~/ufw-backup.rules
```

---

**Document créé le 26 décembre 2025**
**Version** : 1.0.0
**Auteur** : Configuration automatisée avec Claude Code
**Dernière mise à jour** : 2025-12-26

