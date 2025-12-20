# Plan d'Implémentation Mobile - Esportnews

## Contexte

Migration de l'application web Next.js vers React Native + Expo pour créer une application mobile iOS/Android partageant le même backend Go (backend-go).

**Branche actuelle:** `migration-mobile`
**Backend partagé:** `/backend-go` (port 4000)
**Nouveau dossier:** `/mobile-app`

---

## Architecture Cible

### Stack Mobile
- **Expo SDK 52+** avec React Native 0.76+
- **Expo Router v4** (file-based routing comme Next.js)
- **UI:** React Native Paper (Material Design) ou NativeBase
- **State:** React Context + AsyncStorage
- **API Client:** Axios (réutilisation des services web)
- **Animations:** Reanimated v3
- **Push Notifications:** Firebase Cloud Messaging
- **Paiements:** Stripe React Native SDK
- **i18n:** react-i18next (réutilisation des traductions web)

### Backend (Déjà Existant)
- Go 1.24 + Echo framework (port 4000)
- PostgreSQL 15 + Redis 7
- 15 endpoints fonctionnels (auth, games, tournaments, matches, articles, ads, etc.)
- CORS configuré, rate limiting actif
- Déploiement Docker Compose

---

## Phases d'Implémentation (10 Paliers)

### **Palier 1: Setup Expo + Configuration Initiale**

**Objectif:** Créer le projet Expo avec structure de base

**Actions:**
1. Initialiser projet Expo dans `/mobile-app`
   ```bash
   npx create-expo-app@latest mobile-app --template tabs
   cd mobile-app
   npx expo install expo-router expo-status-bar
   ```

2. Configuration TypeScript stricte
   - `tsconfig.json` avec strict mode
   - Types partagés depuis `/frontend/types`

3. Configuration environnement
   - `.env.local` avec `EXPO_PUBLIC_API_URL=http://localhost:4000`
   - `.env.production` avec URL production backend

4. Structure de dossiers initiale
   ```
   /mobile-app
     /app                    # Expo Router routes
     /components
       /ui                   # Composants UI génériques
       /features             # Composants métier
     /services               # API clients
     /constants              # Theme, colors, config
     /types                  # TypeScript types
     /assets                 # Images, fonts
   ```

5. Configuration ESLint + Prettier (cohérence avec web)

**Tests:**
- [ ] `npm run android` lance l'app sur émulateur
- [ ] `npm run ios` lance l'app sur simulateur
- [ ] Hot reload fonctionne
- [ ] TypeScript compile sans erreur

**Commit:** `feat(mobile): setup expo project with typescript and basic structure`

---

### **Palier 2: Design System + Thème**

**Objectif:** Implémenter le design system cohérent avec la web app

**Actions:**
1. Installation React Native Paper
   ```bash
   npx expo install react-native-paper react-native-safe-area-context
   ```

2. Création `/constants/theme.ts`
   - Palette de couleurs CLAUDE.md (#060B13, #091626, #182859, #F22E62)
   - Typographie (Roboto/System fonts)
   - Spacing, radius, shadows

3. Création composants UI de base
   - `Button.tsx` (primary, secondary, outline variants)
   - `Card.tsx` (match cards, tournament cards)
   - `Input.tsx` (formulaires)
   - `Avatar.tsx` (profil utilisateur)
   - `Badge.tsx` (live indicator, status badges)

4. Provider de thème dans `app/_layout.tsx`

**Tests:**
- [ ] Thème s'applique globalement
- [ ] Dark mode fonctionne (si applicable)
- [ ] Composants UI s'affichent correctement
- [ ] Safe area gérée sur iPhone notch

**Commit:** `feat(mobile): implement design system and ui components`

---

### **Palier 3: Navigation + Routing**

**Objectif:** Configurer Expo Router avec structure de navigation

**Actions:**
1. Structure des routes `/app`
   ```
   /app
     /_layout.tsx           # Root layout avec providers
     /(tabs)
       /_layout.tsx         # Tab navigator
       /index.tsx           # Home
       /live.tsx            # Live matches
       /tournaments.tsx     # Tournaments
       /calendar.tsx        # Calendar
       /profile.tsx         # Profile
     /(auth)
       /login.tsx
       /register.tsx
     /article/[slug].tsx    # Article detail
     /tournament/[id].tsx   # Tournament detail
   ```

2. Bottom Tab Navigator avec icônes
   - Home, Live, Tournaments, Calendar, Profile
   - Active/inactive states
   - Badge pour notifications

3. Stack navigation pour détails
   - Transitions natives iOS/Android
   - Back button behavior

4. Deep linking configuration
   - `app.json` avec scheme `esportnews://`
   - Universal links pour partage articles

**Tests:**
- [ ] Navigation entre tabs fonctionne
- [ ] Navigation vers détails (push/pop)
- [ ] Back button Android fonctionne
- [ ] Deep links ouvrent la bonne screen

**Commit:** `feat(mobile): configure expo router and tab navigation`

---

### **Palier 4: Services API + Authentification**

**Objectif:** Connecter au backend Go et gérer l'authentification

**Actions:**
1. Service API de base `/services/api.ts`
   ```typescript
   import axios from 'axios';
   import { EXPO_PUBLIC_API_URL } from '@env';

   const api = axios.create({
     baseURL: EXPO_PUBLIC_API_URL,
     timeout: 10000,
   });

   // Interceptors pour JWT
   api.interceptors.request.use(async (config) => {
     const token = await AsyncStorage.getItem('token');
     if (token) {
       config.headers.Authorization = `Bearer ${token}`;
     }
     return config;
   });
   ```

2. Service Auth `/services/auth.service.ts`
   - `login(email, password)`
   - `register(name, email, password)`
   - `logout()`
   - `getProfile()`
   - Stockage JWT dans AsyncStorage

3. Context Auth `/contexts/AuthContext.tsx`
   - `user` state
   - `isAuthenticated` boolean
   - `loading` state
   - Auto-login au démarrage (check token)

4. Protected routes (HOC ou middleware)

5. Écrans login/register fonctionnels
   - Formulaires avec validation
   - Gestion erreurs (email déjà utilisé, etc.)
   - Loading states

**Tests:**
- [ ] Login avec credentials valides fonctionne
- [ ] JWT stocké dans AsyncStorage
- [ ] Auto-login au redémarrage app
- [ ] Logout clear le token
- [ ] Protected routes redirigent vers login

**Commit:** `feat(mobile): implement authentication with jwt and protected routes`

---

### **Palier 5: Écran Home + Sélection Jeu**

**Objectif:** Afficher l'écran d'accueil avec sélection de jeu

**Actions:**
1. Service Games `/services/games.service.ts`
   - `getGames()` → GET `/api/games`

2. Context Game Selection `/contexts/GameContext.tsx`
   - `selectedGame` state (persisté dans AsyncStorage)
   - `setSelectedGame(game)`

3. Composant `GameSelector.tsx`
   - Horizontal scroll de jeux
   - Images selected/unselected
   - Highlight sur jeu sélectionné

4. Écran Home `/app/(tabs)/index.tsx`
   - Game selector en header
   - Sections: "Live Now", "Upcoming Tournaments", "Latest News"
   - Skeleton loaders pendant fetch

5. Composant `LiveMatchCard.tsx`
   - Affichage équipes, score, statut live
   - Badge "LIVE" pulsant
   - Tap pour ouvrir stream

**Tests:**
- [ ] Liste jeux s'affiche (10 jeux)
- [ ] Sélection jeu persiste après reload
- [ ] Matchs live filtrés par jeu sélectionné
- [ ] Navigation vers détail match

**Commit:** `feat(mobile): implement home screen with game selector and live matches`

---

### **Palier 6: Écran Live + Matchs en Direct**

**Objectif:** Page dédiée aux matchs en direct (SportDevs)

**Actions:**
1. Service Live `/services/live.service.ts`
   - `getLiveMatches(game?)` → GET `/api/live`
   - Polling toutes les 30s avec `setInterval`

2. Écran Live `/app/(tabs)/live.tsx`
   - Liste matchs live filtrés par jeu
   - Pull-to-refresh
   - Auto-refresh toutes les 30s
   - Empty state si aucun match live

3. Composant `LiveMatchItem.tsx`
   - Team logos, noms, scores
   - Statut match (live, scheduled, finished)
   - Bouton "Watch Stream" (ouvre lien externe)

4. Gestion liens streams
   - `Linking.openURL(streamUrl)` pour ouvrir dans navigateur/app externe

**Tests:**
- [ ] Matchs live s'affichent en temps réel
- [ ] Pull-to-refresh fonctionne
- [ ] Tap sur match ouvre stream externe
- [ ] Filtrage par jeu fonctionne
- [ ] Polling arrêté quand app en background

**Commit:** `feat(mobile): implement live matches screen with auto-refresh`

---

### **Palier 7: Écran Tournaments + Filtres**

**Objectif:** Liste tournois avec filtres (running, upcoming, past)

**Actions:**
1. Service Tournaments `/services/tournaments.service.ts`
   - `getTournaments(status, game, limit, offset)`
   - `getTournamentById(id)`
   - `getTournamentsByDate(date, game?)`

2. Écran Tournaments `/app/(tabs)/tournaments.tsx`
   - Segmented control: "En cours" | "À venir" | "Terminés"
   - Liste tournois avec infinite scroll
   - Filtrage par jeu (via GameContext)

3. Composant `TournamentCard.tsx`
   - Nom, dates, tier, prizepool
   - Badge tier (S, A, B, C, D) avec couleurs
   - Image jeu en background

4. Écran détail tournoi `/app/tournament/[id].tsx`
   - Infos tournoi (dates, prizepool, participants)
   - Liste matchs du tournoi
   - Bouton "Ajouter au calendrier"

**Tests:**
- [ ] Liste tournois charge par pagination
- [ ] Filtres (running/upcoming/past) fonctionnent
- [ ] Détail tournoi affiche matchs
- [ ] Infinite scroll charge plus de résultats

**Commit:** `feat(mobile): implement tournaments screen with filters and detail view`

---

### **Palier 8: Écran Calendar + Matchs par Date**

**Objectif:** Calendrier des matchs avec sélection de date

**Actions:**
1. Installation calendar picker
   ```bash
   npx expo install react-native-calendars
   ```

2. Service Matches `/services/matches.service.ts`
   - `getMatchesByDate(date, game?)`
   - `getMatchById(id)`

3. Écran Calendar `/app/(tabs)/calendar.tsx`
   - Calendar picker en haut
   - Liste matchs du jour sélectionné
   - Dots sur dates avec matchs

4. Composant `MatchCard.tsx`
   - Teams, heure, statut
   - Lien stream si disponible

5. Écran détail match `/app/match/[id].tsx`
   - Détails complets (teams, score, stats)
   - Bouton "Watch Live" si en cours

**Tests:**
- [ ] Sélection date affiche matchs du jour
- [ ] Dots apparaissent sur dates avec matchs
- [ ] Détail match affiche infos complètes
- [ ] Filtrage par jeu fonctionne

**Commit:** `feat(mobile): implement calendar screen with match filtering by date`

---

### **Palier 9: Articles & News**

**Objectif:** Afficher articles éditoriaux avec SEO

**Actions:**
1. Service Articles `/services/articles.service.ts`
   - `getArticles(category?, limit, offset)`
   - `getArticleBySlug(slug)`
   - `incrementViews(id)`

2. Section News sur Home
   - Carrousel articles featured
   - Liste articles récents

3. Écran détail article `/app/article/[slug].tsx`
   - Titre, auteur, date, featured image
   - Contenu HTML (WebView ou Markdown renderer)
   - Support vidéo (YouTube/Vimeo embed)
   - Crédit source (© VCT EMEA, etc.)
   - Bouton partage

4. Composant `ArticleCard.tsx`
   - Image, titre, catégorie, date
   - Badge catégorie avec couleur

**Tests:**
- [ ] Articles s'affichent en liste
- [ ] Détail article affiche contenu HTML
- [ ] Vidéos embedded fonctionnent
- [ ] Partage article fonctionne
- [ ] Vues incrémentées au tap

**Commit:** `feat(mobile): implement articles and news with detail view`

---

### **Palier 10: Profil Utilisateur + Préférences**

**Objectif:** Écran profil avec édition + préférences notifications

**Actions:**
1. Service User `/services/user.service.ts`
   - `updateProfile(data)`
   - `updateAvatar(file)`
   - `updateNotificationPreferences(prefs)`
   - `getFavoriteTeams()`
   - `addFavoriteTeam(teamId)`

2. Écran Profile `/app/(tabs)/profile.tsx`
   - Avatar, nom, email
   - Bouton "Modifier profil"
   - Liste équipes favorites
   - Section "Préférences"
   - Bouton "Déconnexion"

3. Écran édition profil `/app/profile/edit.tsx`
   - Upload avatar (expo-image-picker)
   - Champs nom, email
   - Bouton sauvegarder

4. Écran préférences notifications `/app/profile/notifications.tsx`
   - Toggles: Push, Articles, News, Matchs
   - Sauvegarde auto

5. Section abonnement (si applicable)
   - Affichage statut (gratuit/premium)
   - Bouton "S'abonner" → Stripe checkout

**Tests:**
- [ ] Profil affiche infos utilisateur
- [ ] Upload avatar fonctionne
- [ ] Modification nom/email sauvegardée
- [ ] Préférences notifications persistées
- [ ] Équipes favorites affichées

**Commit:** `feat(mobile): implement user profile with preferences and avatar upload`

---

## Paliers Additionnels (Fonctionnalités Avancées)

### **Palier 11: Push Notifications (Firebase)**
- Setup Firebase Cloud Messaging
- Gestion tokens device
- Notifications matchs favoris

### **Palier 12: Publicités (Sans Popups pour Premium)**
- Bannières publicitaires (react-native-admob ou custom)
- Gestion abonnement premium (désactivation popups)
- Desktop: 3 emplacements pub fixes

### **Palier 13: Admin Panel Mobile**
- Écrans admin (articles, ads management)
- Upload images vers Cloudflare R2
- Gestion rôles (admin check)

### **Palier 14: i18n (5 Langues)**
- react-i18next
- FR, EN, ES, DE, IT
- Réutilisation traductions web

### **Palier 15: Offline Mode**
- AsyncStorage cache
- Sync stratégies
- Indicateur mode hors-ligne

### **Palier 16: Analytics**
- Tracking événements (select_game, view_live, click_ad)
- Firebase Analytics ou custom endpoint

### **Palier 17: Build & Déploiement**
- EAS Build (iOS + Android)
- Store submission (App Store, Google Play)
- CI/CD GitHub Actions

---

## Fichiers Critiques

### Nouveaux fichiers à créer
- `/mobile-app/package.json`
- `/mobile-app/app.json` (config Expo)
- `/mobile-app/tsconfig.json`
- `/mobile-app/.env.local` et `.env.production`
- `/mobile-app/app/_layout.tsx` (root layout)
- `/mobile-app/constants/theme.ts`
- `/mobile-app/services/*.ts` (10 services API)
- `/mobile-app/contexts/AuthContext.tsx`
- `/mobile-app/contexts/GameContext.tsx`

### Fichiers backend existants (réutilisés)
- `/backend-go/cmd/server/main.go` (routes déjà configurées)
- `/backend-go/internal/handlers/*.go` (endpoints fonctionnels)
- `/backend-go/.env` (variables d'environnement backend)

### Configuration Docker
- Potentiellement ajouter service Expo dans `docker-compose.yml` si dev containerisé souhaité

---

## Stratégie de Développement

### Workflow par Palier
1. **Développer** la fonctionnalité
2. **Compiler** avec `npx expo start` et tester sur émulateur
3. **Vérifier** que tous les tests passent
4. **Git add** les fichiers modifiés
5. **Git commit** avec message conventionnel
6. **Git push** vers `migration-mobile`
7. Passer au palier suivant

### Testing
- Test manuel sur émulateurs iOS + Android
- Tests unitaires avec Jest (optionnel pour MVP)
- Tests E2E avec Detox (post-MVP)

### Backend
- **Aucune modification backend requise** (endpoints déjà opérationnels)
- Vérifier CORS permet requêtes depuis app mobile
- Tester endpoints avec Postman avant intégration mobile

---

## Considérations Techniques

### Performance
- Image optimization (expo-image vs React Native Image)
- Lazy loading composants lourds
- Virtualized lists pour grandes listes
- Cache API responses (AsyncStorage + TTL)

### Sécurité
- JWT refresh tokens (si backend le supporte)
- Secure storage pour tokens sensibles (expo-secure-store)
- HTTPS uniquement en production
- Input validation côté client + backend

### UX Mobile-Specific
- Pull-to-refresh sur toutes les listes
- Loading skeletons (pas de spinners seuls)
- Gestion offline gracieuse
- Haptic feedback sur actions importantes
- Safe area insets (iPhone notch, Android gesture bar)

---

## Questions pour l'Utilisateur

Avant de commencer l'implémentation, j'ai quelques clarifications:

1. **UI Library:** Préférez-vous **React Native Paper** (Material Design) ou **NativeBase** (plus personnalisable) ?

2. **Navigation:** Souhaitez-vous une **drawer navigation** en plus des tabs (pour menu latéral) ou tabs uniquement ?

3. **Publicités Mobile:** Les bannières publicitaires doivent-elles être intégrées dès le Palier 1-10 ou reportées au Palier 12 (fonctionnalités avancées) ?

4. **Admin Panel:** L'admin panel mobile est-il prioritaire (Palier 13) ou peut-il être reporté post-lancement ?

5. **Environnement de développement:** Préférez-vous tester sur émulateur Android, simulateur iOS, ou les deux en parallèle ?

---

## Prochaine Étape

Une fois ces questions clarifiées, je procéderai au **Palier 1: Setup Expo + Configuration Initiale** avec compilation et commit.
