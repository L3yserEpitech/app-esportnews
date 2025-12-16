# 🚀 Guide de Démarrage - EsportNews

## Prérequis

- **Docker Desktop** installé et en cours d'exécution
- **Git** (pour cloner le projet)
- Au moins **4 GB de RAM** disponible pour Docker

## Démarrage Rapide

### 1. Démarrer Docker Desktop

Assurez-vous que Docker Desktop est lancé avant de continuer.

### 2. Lancer l'application

```bash
./start-dev.sh
```

Ce script va automatiquement :
- ✅ Vérifier que Docker est actif
- ✅ Nettoyer les conteneurs existants
- ✅ Charger les variables d'environnement locales (`.env.local`)
- ✅ Construire et démarrer tous les services (PostgreSQL, Redis, Backend, Frontend)
- ✅ Afficher l'état des services

### 3. Accéder à l'application

Une fois les services démarrés :

- **Frontend** : [http://localhost:3002](http://localhost:3002)
- **Backend API** : [http://localhost:4000](http://localhost:4000)
- **Health Check** : [http://localhost:4000/health](http://localhost:4000/health)

## Commandes Utiles

### Voir les logs en temps réel

```bash
# Tous les services
docker-compose logs -f

# Un service spécifique
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Arrêter l'application

```bash
docker-compose down
```

### Redémarrer un service

```bash
docker-compose restart backend
docker-compose restart frontend
```

### Reconstruire les images (après modification de code)

```bash
docker-compose up --build -d
```

### Vérifier l'état des services

```bash
docker-compose ps
```

### Accéder à la base de données PostgreSQL

```bash
docker-compose exec postgres psql -U postgres -d esportnews
```

Commandes SQL utiles :
```sql
-- Lister les tables
\dt

-- Compter les articles
SELECT COUNT(*) FROM articles;

-- Voir les utilisateurs
SELECT id, email, admin FROM "user";

-- Quitter
\q
```

### Accéder à Redis CLI

```bash
docker-compose exec redis redis-cli

# Vérifier la connexion
PING

# Voir toutes les clés
KEYS *

# Quitter
exit
```

## Structure des Conteneurs

| Service | Container Name | Port | Description |
|---------|---------------|------|-------------|
| **PostgreSQL** | `esportnews-db-dev` | 5432 | Base de données principale |
| **Redis** | `esportnews-cache-dev` | 6379 | Cache et sessions |
| **Backend** | `esportnews-backend-dev` | 4000 | API Go (Echo framework) |
| **Frontend** | `esportnews-frontend-dev` | 3002 | Application Next.js |

## Variables d'Environnement

### Développement Local

Utilisez [.env.local](.env.local) avec les URLs locales :
- `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`
- `NEXT_PUBLIC_API_URL=http://localhost:4000/api`
- `ENVIRONMENT=development`

### Production

Utilisez [.env](.env) avec les URLs de production :
- `NEXT_PUBLIC_BACKEND_URL=https://www.esportnews.fr`
- `NEXT_PUBLIC_API_URL=https://www.esportnews.fr/api`
- `ENVIRONMENT=production`

## Résolution de Problèmes

### Docker n'est pas démarré

```
❌ Erreur: Docker n'est pas démarré.
```

**Solution** : Lancez Docker Desktop et attendez qu'il soit prêt (icône baleine dans la barre de menu).

### Port déjà utilisé

```
Error: port is already allocated
```

**Solution** : Un autre processus utilise le port. Trouvez et arrêtez-le :

```bash
# Trouver le processus sur le port 4000
lsof -ti:4000 | xargs kill -9

# Trouver le processus sur le port 3002
lsof -ti:3002 | xargs kill -9
```

### Base de données non migrée

```
ERROR: relation "articles" does not exist
```

**Solution** : Les migrations SQL doivent s'exécuter automatiquement au démarrage. Si ce n'est pas le cas :

```bash
# Vérifier les logs PostgreSQL
docker-compose logs postgres

# Réinitialiser complètement la base de données
docker-compose down -v
docker-compose up -d
```

### Erreur CORS lors des appels API

```
Access to fetch at 'http://localhost:4000/api/...' has been blocked by CORS
```

**Solution** : Vérifiez que `CORS_ORIGINS` dans `.env.local` contient `http://localhost:3002`.

### Backend ne démarre pas (health check fail)

```bash
# Vérifier les logs du backend
docker-compose logs backend

# Vérifier la connexion à PostgreSQL
docker-compose exec backend wget -q --spider http://localhost:4000/health
```

## Workflow de Développement

### 1. Modifier le code Backend (Go)

```bash
# Après modification, reconstruire le backend
docker-compose up --build -d backend

# Voir les logs
docker-compose logs -f backend
```

### 2. Modifier le code Frontend (Next.js)

```bash
# Après modification, reconstruire le frontend
docker-compose up --build -d frontend

# Voir les logs
docker-compose logs -f frontend
```

### 3. Seeder des données (articles)

```bash
# Importer les 47 articles depuis initial_data/articles_rows.json
docker-compose exec backend ./seed --data=initial_data/articles_rows.json
```

### 4. Commiter avec Git

```bash
git add .
git commit -m "feat: description de la feature"
git push
```

## Déploiement en Production

Utilisez [docker-compose.prod.yml](docker-compose.prod.yml) avec Traefik et Let's Encrypt :

```bash
docker-compose -f docker-compose.prod.yml up -d
```

⚠️ **Important** : En production, les services utilisent des noms différents :
- `esportnews-db-prod`
- `esportnews-cache-prod`
- `esportnews-backend-prod`
- `esportnews-frontend-prod`

## Support

Pour toute question :
1. Vérifiez les logs : `docker-compose logs -f`
2. Consultez le [CLAUDE.md](CLAUDE.md) pour la documentation technique
3. Contactez l'équipe de développement
