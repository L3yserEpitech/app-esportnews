# Backend API - Esport News

Backend modulaire et scalable construit avec **Fastify** pour la plateforme Esport News.

## 🏗️ Structure

```
api/
├── 📄 index.js                 # Point d'entrée (56 lignes)
├── 📚 ARCHITECTURE.md          # Guide de l'architecture
├── 📚 MIGRATION.md             # Guide de migration depuis l'ancien code
│
├── 📁 constants/               # Configurations globales
│   └── games.js               # Constantes jeux, tiers, APIs
│
├── 📁 middleware/              # Middlewares réutilisables
│   └── auth.js                # Authentification JWT
│
├── 📁 utils/                   # Fonctions utilitaires
│   ├── errorHandler.js        # Gestion centralisée des erreurs
│   └── sortTournaments.js     # Tri des tournois
│
├── 📁 services/                # Logique métier
│   └── tournamentService.js   # Opérations tournois
│
└── 📁 routes/                  # Routes par domaine
    ├── health.js              # Routes santé
    ├── games.js               # Routes jeux
    ├── tournaments.js         # Routes tournois
    ├── news.js                # Routes actualités
    ├── articles.js            # Routes articles
    ├── ads.js                 # Routes publicités
    ├── matches.js             # Routes matchs
    ├── auth.js                # Routes authentification
    ├── teams.js               # Routes équipes
    └── notifications.js       # Routes notifications
```

## 🚀 Routes Principales

### Health & Test
- `GET /` - Status API
- `GET /health` - Health check
- `GET /api/test` - Test endpoint

### Jeux
- `GET /api/games` - Tous les jeux
- `GET /api/games/:id` - Jeu par ID
- `GET /api/games/acronym/:acronyme` - Jeu par acronyme

### Tournois (PandaScore)
- `GET /api/tournaments/filtered?game=...&status=...&filter[tier]=...`
- `GET /api/tournaments?game=...` (running)
- `GET /api/tournaments/all` (running)
- `GET /api/tournaments/upcoming?game=...`
- `GET /api/tournaments/upcoming/all`
- `GET /api/tournaments/finished?game=...`
- `GET /api/tournaments/finished/all`
- `GET /api/tournaments/by-date?date=YYYY-MM-DD`

### Articles & Actualités
- `GET /api/articles` - Tous les articles
- `GET /api/articles/:slug` - Article par slug
- `GET /api/articles/:slug/similar` - Articles similaires
- `GET /api/news` - Actualités SportDevs

### Matchs & Publicités
- `GET /api/live-matches` - Matchs en direct
- `GET /api/matches/by-date?date=YYYY-MM-DD`
- `GET /api/ads` - Publicités valides

### Authentification 🔐
- `POST /api/auth/signup` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil (protégé)
- `POST /api/auth/me` - Mettre à jour profil (protégé)
- `POST /api/auth/avatar` - Avatar (protégé)
- `DELETE /api/auth/avatar` - Supprimer avatar (protégé)

### Équipes 🔐
- `GET /api/teams/search?query=...` - Rechercher
- `GET /api/users/favorite-teams/ids` - Mes favoris IDs (protégé)
- `GET /api/users/favorite-teams` - Mes favoris (protégé)
- `POST /api/users/favorite-teams/:teamId` - Ajouter (protégé)
- `DELETE /api/users/favorite-teams/:teamId` - Retirer (protégé)

### Notifications 🔐
- `GET /api/notifications/preferences` - Préférences (protégé)
- `PATCH /api/notifications/preferences` - Mettre à jour (protégé)
- `POST /api/notifications/:type/toggle` - Basculer (protégé)

## 🔑 Variables d'environnement

```env
# APIs Tierces
API_PANDASCORE=...           # Token PandaScore
API_SPORTDEVS=...            # Token SportDevs

# JWT
JWT_SECRET=...               # Secret JWT (changez en production!)

# Database
(voir config/supabase.js)
```

## 🏃 Installation & Lancement

```bash
# Installation
npm install

# Dev (avec Vercel CLI)
vercel dev

# Build
npm run build
```

## 📊 Stats de migration

| Métrique | Avant | Après | Gain |
|----------|-------|-------|------|
| Fichiers | 1 monolithe | 16 modules | +1500% modularité |
| Lignes/fichier | 2047 lignes | 56 lignes (index) | -97% complexité |
| Routes intactes | - | 100% | ✅ Zéro régression |
| Duplication code | 5x (tournois) | 1x (service) | -80% duplication |

## 💡 Points clés

✅ **100% des routes préservées** - Migration sans régression
✅ **Code réutilisable** - Services et utils partagés
✅ **Facile à maintenir** - Chaque fichier ~200 lignes max
✅ **Prêt pour les tests** - Modules testables indépendamment
✅ **Scalable** - Structure prête pour l'extension

## 📖 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Guide détaillé de l'architecture
- [MIGRATION.md](./MIGRATION.md) - Comparaison avant/après

## 🤝 Contribution

Lors de l'ajout d'une nouvelle route :

1. Créer un fichier `routes/newdomain.js`
2. Exporter une fonction async `(fastify) => { ... }`
3. Importer et enregistrer dans `index.js`
4. Si logique complexe → créer un service dans `services/`
5. Documenter dans ARCHITECTURE.md

## 📝 Authentification

Les routes marquées 🔐 nécessitent un JWT valide dans le header:

```bash
curl -H "Authorization: Bearer <token>" http://api/protected-route
```

Le middleware `verifyToken` extraira automatiquement l'utilisateur.

## 🔍 Debugging

```bash
# Voir tous les logs
DEBUG=* npm run dev

# Logs spécifiques
DEBUG=tournament:* npm run dev
```

---

**Dernière mise à jour:** Oct 2025
**Mainteneur:** Jules
