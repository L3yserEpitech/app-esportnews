# Guide de Test - Backend Go + Base de Données

## 🧪 Tester le Backend et la Base de Données

### Phase 1: Démarrer les Services (5 minutes)

#### Étape 1a: Démarrer PostgreSQL et Redis
```bash
cd /Users/jules/Code/freelance/esportnews

# Démarrer les conteneurs Docker
docker-compose up -d postgres redis

# Vérifier que tout est démarré
docker-compose ps
```

Vous devriez voir:
```
NAME                COMMAND                  SERVICE             STATUS
esportnews-db       "docker-entrypoint.s…"   postgres            Up (healthy)
esportnews-cache    "redis-server"           redis               Up (healthy)
```

#### Étape 1b: Vérifier la connexion PostgreSQL
```bash
# Tester la connexion à la base
psql -h localhost -U esportnews -d esportnews -c "SELECT version();"

# Mot de passe: secret
# Vous devriez voir la version de PostgreSQL
```

#### Étape 1c: Vérifier Redis
```bash
# Tester la connexion Redis
redis-cli ping

# Devrait répondre: PONG
```

---

### Phase 2: Démarrer le Backend (5 minutes)

#### Option A: Avec Docker Compose (Recommandé)
```bash
cd /Users/jules/Code/freelance/esportnews

# Démarrer tout (postgres + redis + backend + frontend)
docker-compose up

# Attendez pour voir:
# "Server starting on :4000"
# "PandaScore poller started (5 minute interval)"
```

#### Option B: Démarrer localement (Sans Docker)
```bash
cd /Users/jules/Code/freelance/esportnews/backend-go

# Configurer les variables d'environnement
export DATABASE_URL="postgres://esportnews:secret@localhost:5432/esportnews"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="jz0t+KB0qyBF/hsv4r0MCdEMYJGSfdFxpJ0V5usLuu8="
export PANDASCORE_API_KEY="rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk"

# Compiler et lancer
go run ./cmd/server
```

Vous devriez voir:
```
{"level":"info","msg":"Server starting on :4000","time":"..."}
{"level":"info","msg":"PandaScore poller started (5 minute interval)","time":"..."}
```

---

### Phase 3: Tester les Endpoints API (10 minutes)

#### Test 1: Health Check (Vérifier que le serveur fonctionne)
```bash
curl http://localhost:4000/health

# Réponse attendue:
# {"status":"ok"}
```

#### Test 2: Créer un utilisateur (Signup)
```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jules Test",
    "email": "jules@example.com",
    "password": "password123"
  }'

# Réponse:
{
  "id": 1,
  "name": "Jules Test",
  "email": "jules@example.com",
  "avatar": null,
  "admin": false,
  "favorite_teams": null,
  "created_at": "2025-11-09T..."
}
```

#### Test 3: Se connecter (Login)
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jules@example.com",
    "password": "password123"
  }'

# Réponse:
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": 1,
    "name": "Jules Test",
    "email": "jules@example.com",
    ...
  }
}
```

**Sauvegardez le `access_token` pour les prochains tests!**

#### Test 4: Récupérer le profil utilisateur
```bash
# Remplacez TOKEN par le access_token de l'étape précédente
TOKEN="eyJhbGc..."

curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Réponse: Les infos de l'utilisateur connecté
```

#### Test 5: Récupérer les jeux
```bash
curl http://localhost:4000/api/games

# Réponse:
[
  {
    "id": 1,
    "name": "Valorant",
    "acronym": "valorant",
    "selected_image": "...",
    "unselected_image": "..."
  },
  ...
]
```

#### Test 6: Récupérer les articles
```bash
curl http://localhost:4000/api/articles

# Réponse:
[
  {
    "id": 1,
    "title": "Article Title",
    "slug": "article-title",
    "content": "...",
    "views": 0,
    ...
  },
  ...
]
```

#### Test 7: Récupérer les annonces
```bash
curl http://localhost:4000/api/ads

# Réponse:
[
  {
    "id": 1,
    "title": "Ad Title",
    "url": "...",
    "position": 1,
    ...
  },
  ...
]
```

#### Test 8: Récupérer les tournois
```bash
curl "http://localhost:4000/api/tournaments?limit=5&offset=0"

# Réponse: Liste des tournois avec pagination
```

#### Test 9: Récupérer les matchs du jour
```bash
curl "http://localhost:4000/api/matches?date=$(date +%Y-%m-%d)"

# Réponse: Liste des matchs d'aujourd'hui
```

---

### Phase 4: Tester la Base de Données (10 minutes)

#### Connexion à PostgreSQL
```bash
psql -h localhost -U esportnews -d esportnews

# Mot de passe: secret
```

#### Requêtes à tester dans psql

**1. Vérifier les utilisateurs créés**
```sql
SELECT id, name, email, created_at FROM public.users;
```

**2. Compter les articles**
```sql
SELECT COUNT(*) as total_articles FROM public.articles;
```

**3. Vérifier les jeux**
```sql
SELECT id, name, acronym FROM public.games;
```

**4. Vérifier les tournois**
```sql
SELECT id, name, videogame_id FROM public.tournaments LIMIT 5;
```

**5. Vérifier les matchs**
```sql
SELECT id, name, tournament_id FROM public.matches LIMIT 5;
```

**6. Vérifier les annonces**
```sql
SELECT id, title, position FROM public.ads;
```

**7. Voir la taille des tables**
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**8. Vérifier les index**
```sql
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
```

---

### Phase 5: Tester Redis (Cache) (5 minutes)

```bash
# Lancer le client Redis
redis-cli

# Une fois dans redis-cli, tester:

# 1. Vérifier la connexion
PING
# Réponse: PONG

# 2. Voir toutes les clés
KEYS *
# Devrait montrer les clés de cache

# 3. Voir les stats
INFO stats
# Montrera: nombre de commandes, clés, etc.

# 4. Voir la mémoire utilisée
INFO memory
# Montrera: used_memory, max_memory, etc.

# 5. Voir les clés de cache spécifiques
KEYS "games:*"
KEYS "tournaments:*"
KEYS "matches:*"

# 6. Voir le contenu d'une clé
GET "games:list"

# 7. Voir la durée de vie d'une clé (TTL)
TTL "tournaments:valorant"
# Négatif = pas d'expiration
# Positif = secondes restantes

# Quitter redis-cli
QUIT
```

---

### Phase 6: Tester les Logs (5 minutes)

#### Logs du Backend
```bash
# En temps réel
docker logs esportnews-backend -f

# Chercher les erreurs
docker logs esportnews-backend | grep ERROR

# Chercher le poller PandaScore
docker logs esportnews-backend | grep PandaScore

# Voir les 50 dernières lignes
docker logs esportnews-backend --tail 50
```

#### Logs de PostgreSQL
```bash
docker logs esportnews-db -f

# Chercher les erreurs
docker logs esportnews-db | grep ERROR
```

#### Logs de Redis
```bash
docker logs esportnews-cache -f

# Chercher les erreurs
docker logs esportnews-cache | grep ERROR
```

---

### Phase 7: Tester la Performance (10 minutes)

#### Tester les temps de réponse
```bash
# Installer ab (Apache Bench) si pas installé
brew install httpd  # macOS
# ou
apt-get install apache2-utils  # Ubuntu/Debian

# Tester 100 requêtes sur l'endpoint /games
ab -n 100 -c 10 http://localhost:4000/api/games

# Résultats à vérifier:
# - Requests per second: Devrait être > 100
# - Time per request: Devrait être < 50ms
# - Failed requests: Devrait être 0
```

#### Tester avec curl (Plus simple)
```bash
# Mesurer le temps de réponse
time curl http://localhost:4000/api/games > /dev/null

# Mesurer avec plus de détails
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:4000/api/games
```

#### Test de concurrence (avec Apache Bench)
```bash
# 1000 requêtes avec 100 requêtes concurrentes
ab -n 1000 -c 100 http://localhost:4000/api/games

# Vérifier:
# - Pas d'erreurs (Failed requests = 0)
# - Temps moyen < 100ms
# - Requests/sec > 100
```

---

### Phase 8: Tester la Migration Supabase (10 minutes)

#### Avant de migrer
```bash
# Vérifier que la base est vide
psql -h localhost -U esportnews -d esportnews \
  -c "SELECT COUNT(*) FROM public.users;"

# Devrait retourner: 0
```

#### Lancer la migration
```bash
cd /Users/jules/Code/freelance/esportnews/backend-go

# Lancer le script de migration
./scripts/migrate-from-supabase.sh

# Quand demandé, entrer le mot de passe Supabase
# Le script va:
# 1. Faire un dump de Supabase
# 2. Restaurer dans la base locale
# 3. Créer un backup
```

#### Vérifier les données migrées
```bash
# Vérifier les utilisateurs
psql -h localhost -U esportnews -d esportnews \
  -c "SELECT COUNT(*) as total_users FROM public.users;"

# Vérifier les articles
psql -h localhost -U esportnews -d esportnews \
  -c "SELECT COUNT(*) as total_articles FROM public.articles;"

# Vérifier les annonces
psql -h localhost -U esportnews -d esportnews \
  -c "SELECT COUNT(*) as total_ads FROM public.ads;"
```

---

### Phase 9: Test Complet d'Intégration (15 minutes)

Script de test complet:
```bash
#!/bin/bash

echo "🧪 TEST COMPLET D'INTÉGRATION"
echo "=============================="
echo ""

# 1. Vérifier la santé
echo "✓ Test 1: Health Check"
curl -s http://localhost:4000/health | jq '.'
echo ""

# 2. Créer un utilisateur
echo "✓ Test 2: Créer un utilisateur"
SIGNUP=$(curl -s -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }')
echo "$SIGNUP" | jq '.'
USER_ID=$(echo "$SIGNUP" | jq '.id')
echo ""

# 3. Se connecter
echo "✓ Test 3: Se connecter"
LOGIN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')
echo "$LOGIN" | jq '.'
TOKEN=$(echo "$LOGIN" | jq -r '.access_token')
echo ""

# 4. Récupérer le profil
echo "✓ Test 4: Récupérer le profil"
curl -s http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# 5. Tester les jeux
echo "✓ Test 5: Récupérer les jeux"
curl -s http://localhost:4000/api/games | jq '.[] | {id, name, acronym}' | head -20
echo ""

# 6. Tester les articles
echo "✓ Test 6: Récupérer les articles"
curl -s http://localhost:4000/api/articles | jq '.[] | {id, title, slug}' | head -20
echo ""

echo "✅ Tests complétés!"
```

Sauvegardez ce script dans `test.sh` et exécutez:
```bash
chmod +x test.sh
./test.sh
```

---

## 🐛 Dépannage

### Erreur: "Connection refused" sur le port 4000
```bash
# Vérifier que le backend est en cours d'exécution
docker ps | grep esportnews-backend

# Ou si lancé localement:
ps aux | grep "go run"

# Relancer:
docker-compose up backend
# ou
go run ./cmd/server
```

### Erreur: "Database connection failed"
```bash
# Vérifier PostgreSQL
docker-compose ps postgres

# Vérifier les logs
docker logs esportnews-db

# Tester la connexion
psql -h localhost -U esportnews -d esportnews -c "SELECT 1;"

# Redémarrer si nécessaire
docker-compose restart postgres
```

### Erreur: "Redis connection refused"
```bash
# Vérifier Redis
docker-compose ps redis

# Tester la connexion
redis-cli ping

# Redémarrer si nécessaire
docker-compose restart redis
```

### Pas de données dans la base
```bash
# Vérifier qu'une migration a eu lieu
psql -h localhost -U esportnews -d esportnews \
  -c "SELECT COUNT(*) FROM public.users;"

# Si 0 users, lancer la migration:
cd backend-go && ./scripts/migrate-from-supabase.sh
```

---

## ✅ Checklist Complète de Test

- [ ] PostgreSQL démarre et est accessible
- [ ] Redis démarre et répond à PING
- [ ] Backend démarre sur le port 4000
- [ ] Health check répond avec {"status":"ok"}
- [ ] Création d'utilisateur fonctionne
- [ ] Login fonctionne et retourne token
- [ ] Récupération du profil fonctionne
- [ ] Les jeux s'affichent
- [ ] Les articles s'affichent
- [ ] Les annonces s'affichent
- [ ] Les tournois s'affichent
- [ ] Les matchs s'affichent
- [ ] Temps de réponse < 50ms
- [ ] Pas d'erreurs dans les logs
- [ ] PandaScore poller tourne
- [ ] Cache Redis fonctionne

---

## 📊 Résultats Attendus

### Performance
- **Response Time (P50)**: < 10ms (Redis cached), < 50ms (DB queries)
- **Response Time (P95)**: < 50ms (Redis), < 100ms (DB)
- **Requests/sec**: > 100
- **Error Rate**: 0%

### Logs
```
{"level":"info","msg":"Server starting on :4000","time":"..."}
{"level":"info","msg":"PandaScore poller started (5 minute interval)","time":"..."}
```

### Base de données
```
users table:        Contient vos utilisateurs créés
articles table:     Contient vos articles (si migration Supabase)
games table:        Contient 10 jeux
tournaments table:  Contient les tournois de PandaScore
matches table:      Contient les matchs de PandaScore
```

---

**Bon test!** 🚀 Si vous avez des problèmes, consultez la section Dépannage.
