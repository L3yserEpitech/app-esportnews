# Architecture Backend - Structure Modulaire

## Vue d'ensemble

Le backend a été refactorisé d'un monolithe à une architecture modulaire organisée par domaines métier.

## Structure des dossiers

```
backend/api/
├── index.js                    # Point d'entrée principal (léger)
├── ARCHITECTURE.md             # Ce fichier
│
├── constants/
│   └── games.js               # Constantes : jeux, tiers, configurations API
│
├── middleware/
│   └── auth.js                # Middleware JWT + verifyToken
│
├── utils/
│   ├── errorHandler.js        # Gestion centralisée des erreurs
│   └── sortTournaments.js     # Logique de tri des tournois
│
├── services/
│   └── tournamentService.js   # Logique métier pour les tournois PandaScore
│
└── routes/                    # Routes organisées par domaine
    ├── health.js              # GET / , /health , /api/test
    ├── games.js               # GET /api/games*
    ├── tournaments.js         # GET /api/tournaments*
    ├── news.js                # GET /api/news
    ├── articles.js            # GET /api/articles*
    ├── ads.js                 # GET /api/ads
    ├── matches.js             # GET /api/live-matches , /api/matches/by-date
    ├── auth.js                # POST/GET /api/auth/*
    ├── teams.js               # GET/POST/DELETE /api/teams* , /api/users/favorite-teams*
    └── notifications.js       # GET/PATCH/POST /api/notifications/*
```

## Routes par domaine

### Health Check
- `GET /` - Status API
- `GET /health` - Santé du serveur
- `GET /api/test` - Test de connexion

### Jeux (Games)
- `GET /api/games` - Tous les jeux
- `GET /api/games/:id` - Jeu par ID
- `GET /api/games/acronyme/:acronyme` - Jeu par acronyme

### Tournois (Tournaments)
- `GET /api/tournaments/filtered` - Tournois filtrés par jeu, statut, tier
- `GET /api/tournaments` - Tournois d'un jeu (running)
- `GET /api/tournaments/all` - Tous les tournois (running)
- `GET /api/tournaments/upcoming` - Tournois à venir d'un jeu
- `GET /api/tournaments/upcoming/all` - Tous les tournois à venir
- `GET /api/tournaments/finished` - Tournois terminés d'un jeu
- `GET /api/tournaments/finished/all` - Tous les tournois terminés
- `GET /api/tournaments/by-date` - Tournois par date

### Articles
- `GET /api/articles` - Tous les articles
- `GET /api/articles/:slug` - Article par slug
- `GET /api/articles/:slug/similar` - Articles similaires

### Actualités & Matchs
- `GET /api/news` - Actualités SportDevs
- `GET /api/live-matches` - Matchs en direct
- `GET /api/matches/by-date` - Matchs par date

### Publicités
- `GET /api/ads` - Liste des publicités valides

### Authentification
- `POST /api/auth/signup` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil utilisateur (protégé)
- `POST /api/auth/me` - Mise à jour profil (protégé)
- `POST /api/auth/avatar` - Mettre à jour l'avatar (protégé)
- `DELETE /api/auth/avatar` - Supprimer l'avatar (protégé)

### Équipes
- `GET /api/teams/search` - Rechercher des équipes
- `GET /api/users/favorite-teams/ids` - IDs des équipes favorites (protégé)
- `GET /api/users/favorite-teams` - Détails des équipes favorites (protégé)
- `POST /api/users/favorite-teams/:teamId` - Ajouter aux favoris (protégé)
- `DELETE /api/users/favorite-teams/:teamId` - Retirer des favoris (protégé)

### Notifications
- `GET /api/notifications/preferences` - Préférences (protégé)
- `PATCH /api/notifications/preferences` - Mettre à jour (protégé)
- `POST /api/notifications/:type/toggle` - Basculer une préférence (protégé)

## Avantages de cette architecture

✅ **Séparation des responsabilités** - Chaque fichier a une seule responsabilité
✅ **Maintenabilité** - Code organisé et facile à naviguer
✅ **Scalabilité** - Ajouter une nouvelle route est simple : créer un nouveau fichier
✅ **Réutilisabilité** - Les services et utilitaires sont partagés
✅ **Testabilité** - Chaque module peut être testé indépendamment

## Processus d'ajout d'une nouvelle route

1. Créer un nouveau fichier dans `routes/`
2. Exporter une fonction async qui prend `fastify` en paramètre
3. Importer et enregistrer dans `index.js`
4. Si besoin de logique métier complexe, créer un service dans `services/`

Exemple :
```javascript
// routes/example.js
async function exampleRoutes(fastify) {
  fastify.get('/api/example', async (request, reply) => {
    return { message: 'Hello' };
  });
}
module.exports = exampleRoutes;

// Dans index.js
const exampleRoutes = require('./routes/example');
// ...
await exampleRoutes(fastify);
```

## Variables d'environnement requises

- `API_PANDASCORE` - Token PandaScore API
- `API_SPORTDEVS` - Token SportDevs API
- `JWT_SECRET` - Secret JWT (valeur par défaut en dev, à changer en prod)
- Voir `.env.example` pour la liste complète

## Authentification

Les routes protégées utilisent le middleware `verifyToken` du fichier `middleware/auth.js`.

Le JWT est vérifié et l'utilisateur est attaché à `request.user`.

Exemple d'utilisation :
```javascript
fastify.get('/api/protected-route', { preHandler: verifyToken }, async (request, reply) => {
  const userId = request.user.id;
  // ...
});
```

## Performance

- **Lazy loading** : Les routes sont chargées à la demande
- **Parallélisation** : `Promise.allSettled()` pour les requêtes API parallèles
- **Cache** : Considérer pour les données fréquemment accédées
- **Compression** : @fastify/compress peut être ajouté si nécessaire

## À faire future

- [ ] Ajouter des tests unitaires (Jest)
- [ ] Ajouter des tests d'intégration
- [ ] Implémenter le caching (Redis)
- [ ] Ajouter la validation des inputs (Joi/Zod)
- [ ] Logger structuré (winston/pino)
- [ ] Monitoring (Sentry)
