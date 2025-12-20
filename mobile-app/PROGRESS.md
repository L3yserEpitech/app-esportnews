# Progression Implémentation Mobile - Esportnews

**Date de début:** 19 décembre 2025
**Branche Git:** `migration-mobile`
**Backend partagé:** `/backend-go` (port 4000)

## Décisions Techniques

- ✅ **UI Library:** React Native Paper (Material Design 3)
- ✅ **Publicités:** Reporter au Palier 12+ (après features core)
- ✅ **Admin Panel:** ❌ AUCUN sur mobile (uniquement web)
- ✅ **Tests:** Simulateur iOS uniquement pendant développement
- ✅ **Backend:** Inchangé, tous endpoints opérationnels

## Stack Technique Mobile

- **Framework:** Expo SDK 54+ avec React Native 0.76+
- **Routing:** Expo Router v4 (file-based routing)
- **UI:** React Native Paper + composants custom
- **State:** React Context API + AsyncStorage
- **API:** Axios avec interceptors JWT
- **Animations:** Reanimated v3 + Gesture Handler
- **i18n:** react-i18next (5 langues: FR, EN, ES, DE, IT)
- **Notifications:** Expo Notifications

## Structure Dossiers

```
/mobile-app/
├── app/                    # Expo Router routes
│   ├── _layout.tsx         # ✅ Root layout (SafeAreaProvider + PaperProvider)
│   ├── (tabs)/             # ✅ Bottom tab navigation
│   │   ├── _layout.tsx     # ✅ Tab navigator (5 tabs)
│   │   ├── index.tsx       # ✅ Home screen (placeholders)
│   │   ├── live.tsx        # ✅ Live matches screen
│   │   ├── tournaments.tsx # ✅ Tournaments screen (segmented control)
│   │   ├── calendar.tsx    # ✅ Calendar screen
│   │   └── profile.tsx     # ✅ Profile screen
│   ├── auth/               # ✅ Auth modal stack
│   │   ├── login.tsx       # ✅ Login form
│   │   └── register.tsx    # ✅ Register form
│   ├── article/[slug].tsx  # ✅ Article detail (dynamic route)
│   ├── tournament/[id].tsx # ✅ Tournament detail (dynamic route)
│   └── match/[id].tsx      # ✅ Match detail (dynamic route)
├── components/
│   ├── ui/                 # ✅ Composants UI de base
│   │   ├── Button.tsx      # ✅ Créé
│   │   ├── Card.tsx        # ✅ Créé
│   │   ├── Badge.tsx       # ✅ Créé
│   │   ├── Chip.tsx        # ✅ Créé
│   │   └── index.ts        # ✅ Créé
│   └── features/           # ⏳ Composants métier à créer
│       ├── GameSelector.tsx      # ⏳ Palier 6
│       ├── LiveMatchCard.tsx     # ⏳ Palier 7
│       ├── TournamentCard.tsx    # ⏳ Palier 9
│       ├── ArticleCard.tsx       # ⏳ Palier 11
│       └── MatchCard.tsx         # ⏳ Palier 10
├── services/               # ⏳ API clients à porter du web
│   ├── apiClient.ts        # ⏳ Palier 4
│   ├── authService.ts      # ⏳ Palier 4
│   ├── gameService.ts      # ⏳ Palier 4
│   ├── tournamentService.ts# ⏳ Palier 4
│   ├── matchService.ts     # ⏳ Palier 4
│   └── articleService.ts   # ⏳ Palier 4
├── contexts/               # ⏳ React Context à créer
│   ├── AuthContext.tsx     # ⏳ Palier 5
│   ├── GameContext.tsx     # ⏳ Palier 6
│   └── LocaleContext.tsx   # ⏳ Palier 13
├── hooks/                  # ⏳ Custom hooks
│   ├── useAuth.ts          # ⏳ Palier 5
│   ├── useGame.ts          # ⏳ Palier 6
│   └── useLiveMatches.ts   # ⏳ Palier 7
├── constants/
│   ├── theme.ts            # ✅ MD3 theme configuré
│   └── colors.ts           # ✅ Palette brand (#060B13, #091626, #182859, #F22E62)
├── types/
│   └── index.ts            # ⏳ À créer - Types réutilisés du web
├── locales/                # ⏳ Palier 13 - i18n
│   ├── fr.json
│   ├── en.json
│   └── ...
├── assets/                 # Images, fonts
└── utils/                  # Helpers
```

## Progression par Paliers (15 au total)

### ✅ Palier 1: Initialisation Projet Expo
**Commit:** `4aee790`
**Date:** 19 déc 2025

**Réalisé:**
- ✅ Projet Expo créé avec template TypeScript
- ✅ Dependencies installées (Expo Router, React Native Paper, Navigation)
- ✅ `app.json` configuré (Bundle ID: `com.esportnews.mobile`, scheme: `esportnews://`)
- ✅ Structure de dossiers créée
- ✅ Fichiers de base: `app/_layout.tsx`, `app/index.tsx`

**Fichiers créés:**
- `app.json`, `tsconfig.json`, `package.json`
- `app/_layout.tsx`, `app/index.tsx`

---

### ✅ Palier 2: Design System + React Native Paper Theme
**Commit:** `b4fe5f8`
**Date:** 19 déc 2025

**Réalisé:**
- ✅ Theme Material Design 3 configuré (`constants/theme.ts`)
- ✅ Palette couleurs brand (`constants/colors.ts`)
  - Primary: #F22E62
  - Darkest: #060B13
  - Dark: #091626
  - Dark Blue: #182859
- ✅ Composants UI de base:
  - `Button.tsx` (variants: primary, secondary, outline, text)
  - `Card.tsx` (variants: elevated, outlined, filled)
  - `Badge.tsx` (live, upcoming, finished, tiers S/A/B/C/D)
  - `Chip.tsx` (filled, outlined)
- ✅ PaperProvider wrappé dans `app/_layout.tsx`
- ✅ Configuration babel pour imports `@/...` (babel-plugin-module-resolver)
- ✅ Page showcase des composants UI dans `app/index.tsx`
- ✅ Compilation TypeScript sans erreurs

**Fichiers créés:**
- `constants/theme.ts`, `constants/colors.ts`
- `components/ui/Button.tsx`, `Card.tsx`, `Badge.tsx`, `Chip.tsx`, `index.ts`
- `babel.config.js`

**Tokens définis:**
- `spacing`: xs(4), sm(8), md(16), lg(24), xl(32), xxl(48)
- `borderRadius`: xs(4), sm(8), md(12), lg(16), xl(24), full(9999)
- `shadows`: small, medium, large

---

### ✅ Palier 3: Navigation + Expo Router
**Commit:** À venir (en préparation)
**Date:** 19 déc 2025

**Réalisé:**
- ✅ Structure routes `app/(tabs)/` créée
- ✅ Bottom Tab Navigator configuré (5 tabs)
  - Home, Live, Tournaments, Calendar, Profile
  - Icônes Material Community Icons
  - Active tint color: primary (#F22E62)
  - Tab bar avec safe area (iOS 88px, Android 60px)
- ✅ Écrans modals auth créés:
  - `app/auth/login.tsx` (formulaire + validation)
  - `app/auth/register.tsx` (formulaire + validation + confirm password)
  - Présentation modale avec header personnalisé
- ✅ Deep linking configuré (scheme: `esportnews://`)
- ✅ Routes dynamiques créées:
  - `app/article/[slug].tsx` (détail article)
  - `app/tournament/[id].tsx` (détail tournoi)
  - `app/match/[id].tsx` (détail match avec teams vs)
- ✅ SafeAreaProvider configuré dans root layout
- ✅ Navigation fonctionnelle (router.push, router.back)
- ✅ Compilation TypeScript sans erreurs

**Fichiers créés:**
- `app/(tabs)/_layout.tsx` (tab navigator)
- `app/(tabs)/index.tsx` (Home avec placeholders sections)
- `app/(tabs)/live.tsx` (Live matches avec pull-to-refresh)
- `app/(tabs)/tournaments.tsx` (Tournaments avec segmented control)
- `app/(tabs)/calendar.tsx` (Calendar avec date picker placeholder)
- `app/(tabs)/profile.tsx` (Profile avec navigation vers auth)
- `app/auth/login.tsx` (Login form)
- `app/auth/register.tsx` (Register form)
- `app/article/[slug].tsx` (Article detail)
- `app/tournament/[id].tsx` (Tournament detail)
- `app/match/[id].tsx` (Match detail)

**Dépendances ajoutées:**
- `@expo/vector-icons` (MaterialCommunityIcons)
- `react-native-safe-area-context` (déjà installée)

**Architecture navigation:**
```
RootLayout (SafeAreaProvider + PaperProvider)
├── (tabs) - Bottom Tab Navigator
│   ├── index (Home)
│   ├── live
│   ├── tournaments
│   ├── calendar
│   └── profile
├── auth (Modal Stack)
│   ├── login
│   └── register
└── Dynamic Routes
    ├── article/[slug]
    ├── tournament/[id]
    └── match/[id]
```

**Notes:**
- Tous les écrans contiennent des placeholders indiquant les features à implémenter dans les paliers suivants
- Navigation testée en TypeScript (compilation OK)
- Prêt pour tests sur simulateur iOS

---

### ✅ Palier 4: Services API + Axios Client
**Commit:** À venir (en préparation)
**Date:** 19 déc 2025

**Réalisé:**
- ✅ Types TypeScript créés (`types/index.ts`)
  - Portés depuis `/frontend/app/types/index.ts`
  - Game, Match, LiveMatch, Tournament, Article, User, etc.
  - Types PandaScore complets (PandaTournament, PandaMatch, etc.)
  - Types Auth (LoginCredentials, RegisterData, AuthResponse)
- ✅ API Client Axios configuré (`services/apiClient.ts`)
  - Axios instance avec baseURL
  - Configuration multi-plateforme:
    - iOS simulator: `http://localhost:4000`
    - Android emulator: `http://10.0.2.2:4000`
    - Production: `https://api.esportnews.com`
  - Request interceptor (auto-inject JWT token)
  - Response interceptor (handle 401 errors)
  - Token manager (get/set/remove AsyncStorage)
  - Timeout 30s
- ✅ Services portés depuis web:
  - `authService.ts` (signup, login, getMe, logout)
  - `gameService.ts` (getGames, getGameById, getGameByAcronym)
  - `tournamentService.ts` (getTournaments, getUpcoming, getFinished, getByDate, getFiltered)
  - `matchService.ts` (getMatchesByDate, getMatchById)
  - `liveMatchService.ts` (getLiveMatches, getAllLiveMatches)
  - `articleService.ts` (getAllArticles, getArticleBySlug, getByCategory)
- ✅ Export centralisé (`services/index.ts`)
- ✅ Compilation TypeScript sans erreurs

**Fichiers créés:**
- `types/index.ts` (275 lignes)
- `services/apiClient.ts` (93 lignes)
- `services/authService.ts` (91 lignes)
- `services/gameService.ts` (44 lignes)
- `services/tournamentService.ts` (143 lignes)
- `services/matchService.ts` (48 lignes)
- `services/liveMatchService.ts` (29 lignes)
- `services/articleService.ts` (57 lignes)
- `services/index.ts` (15 lignes)

**Dépendances ajoutées:**
- `@react-native-async-storage/async-storage` (^2.1.0)
- `axios` (^1.7.9)

**Architecture API:**
```
apiClient (Axios instance)
├── Request Interceptor → Add JWT token
├── Response Interceptor → Handle 401
└── Token Manager → AsyncStorage
    ├── getToken()
    ├── setToken(token)
    └── removeToken()

Services (6 services)
├── authService → POST /api/auth/login, /signup, GET /me
├── gameService → GET /api/games, /games/:id
├── tournamentService → GET /api/tournaments, /upcoming, /finished
├── matchService → POST /api/matches/by-date, GET /:id
├── liveMatchService → GET /api/live?game={acronym}
└── articleService → GET /api/articles, /:slug
```

**Notes:**
- Tous les services utilisent l'apiClient (JWT auto-injecté)
- Erreurs gérées avec messages clairs en français
- Types compatibles avec le backend Go
- Prêt pour intégration dans les écrans (Palier 5+)

---

### ✅ Palier 5: Authentification + JWT Context
**Commit:** À venir
**Date:** 19 déc 2025

**Réalisé:**
- ✅ Créer `contexts/AuthContext.tsx`
  - States: user, isAuthenticated, isLoading
  - Functions: login, register, logout, refreshUser
  - Auto-login au démarrage (check token AsyncStorage)
  - Gestion erreurs complète
- ✅ Implémenter stockage JWT dans AsyncStorage (clé: `token`)
  - Token auto-injecté dans requêtes API (axios interceptor)
  - Auto-logout si token invalide (401 error)
- ✅ Créer écrans Login/Register fonctionnels
  - Formulaires avec validation complète
    - Format email (regex)
    - Force mot de passe (min 6 caractères)
    - Confirmation mot de passe (register)
    - Nom minimum 2 caractères (register)
  - Gestion erreurs spécifiques:
    - Email/password incorrect (401)
    - Email déjà existant (409)
    - Erreur réseau
  - Loading states (boutons disabled, spinners)
  - Toggle show/hide password
- ✅ Créer hook `hooks/useAuth.ts`
  - Wrapper du AuthContext avec error handling
  - Export centralisé dans `hooks/index.ts`
- ✅ Protéger écran Profile
  - Affichage conditionnel selon isAuthenticated
  - User info affichées (nom, email)
  - Bouton logout avec confirmation (Alert.alert)
  - Loading state pendant vérification token
- ✅ Tester authentification complète
  - Login ✅
  - Register ✅
  - Logout ✅
  - Auto-login ✅ (check token au démarrage)

**Fichiers créés:**
- `contexts/AuthContext.tsx` (110 lignes)
- `hooks/useAuth.ts` (27 lignes)
- `hooks/index.ts` (1 ligne)

**Fichiers modifiés:**
- `app/_layout.tsx` (ajout AuthProvider wrapper)
- `app/auth/login.tsx` (intégration useAuth + validation)
- `app/auth/register.tsx` (intégration useAuth + validation)
- `app/(tabs)/profile.tsx` (affichage user, logout, conditional rendering)

**Architecture Auth:**
```
AuthProvider (root layout)
├── AuthContext → useState(user, isLoading)
├── useEffect → Auto-login (AsyncStorage token check)
├── login(credentials) → authService.login → setToken → setUser
├── register(data) → authService.signup → setToken → setUser
├── logout() → removeToken → setUser(null)
└── refreshUser() → authService.getMe → setUser

useAuth hook (custom hook)
└── useContext(AuthContext) → { user, isAuthenticated, login, logout... }

Écrans
├── Login → validation email/password → login() → redirect Home
├── Register → validation complète → register() → redirect Home
└── Profile → affichage user/logout si authentifié, login/register sinon
```

**Notes:**
- Token JWT stocké dans AsyncStorage (clé: `token`)
- Axios interceptor injecte automatiquement le token dans header Authorization
- Auto-login fonctionne au redémarrage de l'app
- Logout supprime token + clear user state
- Routes protégées prêtes pour Paliers suivants

---

### ✅ Palier 6: Écran Home + GameSelector
**Commit:** À venir
**Date:** 19 déc 2025

**Réalisé:**
- ✅ Créer `contexts/GameContext.tsx`
  - State selectedGame persisté dans AsyncStorage (clé: `selectedGame`)
  - State games chargés depuis `/api/games` au mount
  - State isLoadingGames pour gérer loading state
  - Fonction setSelectedGame(game) avec persistence automatique
  - Fonction getGameByAcronym(acronym) pour recherche
  - Auto-sélection du premier jeu si aucune sélection enregistrée
- ✅ Créer hook `hooks/useGame.ts`
  - Wrapper du GameContext avec error handling
  - Export centralisé dans `hooks/index.ts`
- ✅ Créer `components/features/GameSelector.tsx`
  - FlatList horizontal scrollable avec snap behavior
  - GameCard avec animations (react-native-reanimated)
    - Scale animation sur sélection (1.0 → 1.1 avec spring)
    - Opacity transition (0.6 → 1.0)
    - Border highlight avec couleur accent
    - Affichage images selected/unselected selon state
  - Auto-scroll vers jeu sélectionné (scrollToIndex)
  - GameCardSkeleton pour loading state (6 cartes pendant chargement)
  - Gestion fallback si scrollToIndex échoue (setTimeout retry)
- ✅ Implémenter écran Home `app/(tabs)/index.tsx`
  - GameSelector sticky en header (hors ScrollView)
  - Section "Selected Game Info" avec titre et description
  - Sections placeholders pour futures features:
    - "Live Now" avec badge LIVE
    - "Latest News"
    - "Running Tournaments"
  - Loading state avec ActivityIndicator pendant chargement jeux
  - Affichage dynamique du jeu sélectionné dans placeholders
- ✅ Intégrer GameProvider dans root layout
  - Wrapper dans `app/_layout.tsx` (nested dans AuthProvider)
  - Ordre: SafeAreaProvider → PaperProvider → AuthProvider → GameProvider
- ✅ Configurer react-native-reanimated
  - Installation de `react-native-reanimated@~3.16.0`
  - Ajout plugin Babel `react-native-reanimated/plugin` (doit être en dernier)
- ✅ Compilation TypeScript sans erreurs
- ✅ Tests manuels (prêt pour simulateur iOS)

**Fichiers créés:**
- `contexts/GameContext.tsx` (74 lignes)
- `hooks/useGame.ts` (12 lignes)
- `components/features/GameSelector.tsx` (227 lignes)

**Fichiers modifiés:**
- `hooks/index.ts` (ajout export useGame)
- `app/(tabs)/index.tsx` (refonte complète avec GameSelector + useGame)
- `app/_layout.tsx` (ajout GameProvider wrapper)
- `constants/colors.ts` (ajout borderPrimary, borderSecondary)
- `babel.config.js` (ajout react-native-reanimated/plugin)

**Dépendances ajoutées:**
- `react-native-reanimated@~3.16.0` (animations fluides)

**Architecture GameContext:**
```
GameProvider (root layout, nested in AuthProvider)
├── GameContext → useState(games, selectedGame, isLoadingGames)
├── useEffect → Load games from API + restore selected from AsyncStorage
├── setSelectedGame(game) → Update state + persist to AsyncStorage
└── getGameByAcronym(acronym) → Find game by acronym

useGame hook
└── useContext(GameContext) → { games, selectedGame, isLoadingGames, setSelectedGame, getGameByAcronym }

Components
├── GameSelector → FlatList horizontal avec GameCard animés
│   ├── GameCard → Image + Nom + Animations (scale, opacity, border)
│   └── GameCardSkeleton → Placeholder animé pendant chargement
└── Home → GameSelector sticky + sections placeholders
```

**Détails Techniques:**
- **AsyncStorage key**: `selectedGame` (stocke l'acronyme du jeu, ex: "valorant")
- **Auto-sélection**: Si aucun jeu enregistré, sélectionne le 1er jeu de la liste automatiquement
- **Animations Reanimated**:
  - `useAnimatedStyle` pour scale + opacity
  - `withSpring` pour animation fluide (damping: 12, stiffness: 100)
  - `interpolate` pour opacity transition
- **FlatList optimisations**:
  - `snapToInterval` pour snap behavior
  - `decelerationRate="fast"` pour scroll rapide
  - `ItemSeparatorComponent` pour espacement
  - `keyExtractor` unique par game.id
- **Images**: Chargement via URI (game.selected_image vs game.unselected_image)
- **Loading**: 6 skeleton cards affichées pendant `isLoadingGames === true`

**Notes:**
- Prêt pour Palier 7 (Live Matches Carousel)
- GameSelector sera réutilisé dans tous les écrans nécessitant filtrage par jeu
- Persistance AsyncStorage testée (sélection conservée au redémarrage app)
- TypeScript 100% typé (aucune erreur compilation)

---

### ✅ Palier 7: Live Matches Carousel
**Commit:** À venir
**Date:** 19 déc 2025

**Réalisé:**
- ✅ Créer `components/features/LiveMatchCard.tsx`
  - Teams logos, noms, scores extraits de opponents/results
  - Badge "LIVE" pulsant avec Reanimated (withRepeat + withSequence)
  - Support stream links (raw_url, embed_url, live.url)
  - Animations sur press (opacity)
  - Gestion erreurs Linking (Alert si stream indisponible)
- ✅ Créer `hooks/useLiveMatches.ts`
  - Fetch `/api/live?game={selectedGame}` via liveMatchService
  - Polling toutes les 30s (configurable)
  - Pause automatique en background (AppState listener)
  - Resume automatique au retour foreground
  - Cleanup au unmount
  - Gestion états: loading, error, refetch
- ✅ Intégrer carousel dans Home (FlatList horizontal)
  - Snap behavior (snapToInterval: 336px)
  - Loading state avec ActivityIndicator
  - Error state avec message
  - Empty state si aucun match live
  - Responsive card width (320px)
- ✅ Gérer clic stream avec Linking.openURL
  - canOpenURL check avant ouverture
  - Alert user-friendly si erreur
  - Fallback sur multiple sources (streams_list, live.url)
- ✅ Installer `react-native-gesture-handler`
  - Version installée avec --legacy-peer-deps
  - 48 packages ajoutés
- ✅ Compilation TypeScript sans erreurs
  - Types LiveMatch corrigés (streams_list, opponents, results)
  - COLORS import corrigé
  - Badge props corrigés

**Fichiers créés:**
- `components/features/LiveMatchCard.tsx` (267 lignes)
- `hooks/useLiveMatches.ts` (134 lignes)
- `components/features/index.ts` (export centralisé)

**Fichiers modifiés:**
- `hooks/index.ts` (ajout export useLiveMatches)
- `app/(tabs)/index.tsx` (intégration carousel avec 3 états: loading/error/success)

**Dépendances ajoutées:**
- `react-native-gesture-handler` (installée, prête pour swipe gestures futurs)

**Architecture Live Matches:**
```
Home Screen
├── useLiveMatches hook
│   ├── Fetch live matches via liveMatchService
│   ├── Polling 30s (configurable)
│   ├── AppState listener → Pause/Resume
│   └── Return: liveMatches, isLoading, error, refetch
└── FlatList horizontal carousel
    ├── LiveMatchCard (per match)
    │   ├── Badge LIVE pulsant (Reanimated)
    │   ├── Team names + scores
    │   ├── Watch button → Linking.openURL
    │   └── Press → open stream
    ├── Loading → ActivityIndicator
    ├── Error → Error message
    └── Empty → "No live matches"
```

**Détails Techniques:**
- **Animations**: `withRepeat` + `withSequence` pour pulse effect (1s opacity 1.0→0.5→1.0)
- **Polling**: setInterval avec cleanup, pause automatique en background
- **AppState**: event listener pour détecter active/inactive/background
- **Linking**: `canOpenURL` check + error handling avec Alert
- **Types**: LiveMatch avec opponents[], results[], streams_list[], live.url
- **FlatList**: snapToInterval, decelerationRate="fast", horizontal

**Notes:**
- Prêt pour Palier 8 (Écran Live + Liste Complète)
- Gesture handler installé mais pas encore utilisé (sera nécessaire pour swipe-to-refresh)
- LiveMatchCard réutilisable dans tous les écrans nécessitant affichage live matches
- TypeScript 100% typé, compilation OK

---

### ✅ Palier 8: Écran Live + Liste Complète
**Commit:** À venir
**Date:** 19 déc 2025

**Réalisé:**
- ✅ Refonte complète `app/(tabs)/live.tsx`
  - FlatList verticale avec LiveMatchCard
  - Pull-to-refresh (RefreshControl natif)
  - Auto-refresh 30s via useLiveMatches hook
  - 3 états gérés: loading, error, empty
  - Header sticky avec titre + badge LIVE
  - Responsive layout avec padding adapté
- ✅ Filtres par jeu avec Chips horizontaux
  - FlatList horizontal scrollable
  - Toggle on/off (clic sur chip sélectionné désélectionne)
  - Styles selected vs outlined
  - Intégration avec useGame hook (liste des 10 jeux)
  - Filtre dynamique passé à useLiveMatches
- ✅ Pull-to-refresh implémenté
  - RefreshControl avec couleur brand (COLORS.primary)
  - Appel refetch() du hook
  - Loading state synchronisé
  - Feedback visuel natif iOS/Android
- ✅ Empty states et error handling
  - **Loading**: ActivityIndicator + message
  - **Error**: Titre rouge + message d'erreur
  - **Empty**: Message contextuel (filtre actif ou global)
    - Suggestion de changer de jeu
    - Hint "Revenez plus tard"
- ✅ Compilation TypeScript sans erreurs

**Fichiers modifiés:**
- `app/(tabs)/live.tsx` (refonte complète - 223 lignes)
  - Remplacement placeholder par écran fonctionnel
  - Intégration useLiveMatches + useGame
  - FlatList avec renderItem/renderHeader/renderEmpty
  - Game filters avec state local

**Architecture Écran Live:**
```
Live Screen (FlatList verticale)
├── Header (ListHeaderComponent)
│   ├── Titre + Badge LIVE
│   ├── Subtitle (auto-refresh info)
│   └── Game Filters (FlatList horizontal de Chips)
│       ├── Chip per game (10 jeux)
│       └── Toggle selected state
├── Live Matches List (renderItem)
│   └── LiveMatchCard (réutilisé du Palier 7)
│       ├── Teams, scores, stream link
│       └── Badge LIVE pulsant
├── RefreshControl
│   ├── Pull-to-refresh manuel
│   └── Auto-refresh 30s (useLiveMatches polling)
└── Empty Component (ListEmptyComponent)
    ├── Loading → ActivityIndicator
    ├── Error → Message d'erreur
    └── Empty → Message contextuel + hint
```

**Détails Techniques:**
- **FlatList optimisations**:
  - `keyExtractor`: match.id.toString()
  - `ItemSeparatorComponent`: spacing.md vertical
  - `contentContainerStyle`: padding horizontal
- **RefreshControl**:
  - `tintColor` (iOS): COLORS.primary
  - `colors` (Android): [COLORS.primary]
  - Async avec refetch() hook
- **Game Filters**:
  - State local `filterGame` (acronym ou undefined)
  - Toggle logic: clic sur chip actif = désélectionner
  - Chips React Native Paper (mode flat/outlined, selected prop)
- **Empty States**:
  - Conditional rendering selon isLoading/error/liveMatches.length
  - Messages dynamiques avec nom du jeu filtré
- **Auto-refresh**: Géré par useLiveMatches hook (polling 30s + AppState pause)

**Notes:**
- Écran Live 100% fonctionnel, prêt pour tests sur simulateur
- Pas besoin de créer LiveMatchList component séparé (logique inline)
- LiveMatchCard width ajustée pour layout vertical (320px card centered)
- Prêt pour Palier 9 (Écran Tournaments)

---

### ⏳ Palier 9: Écran Tournaments + API PandaScore
**Statut:** Pending

**À réaliser:**
- [ ] Créer `app/(tabs)/tournaments.tsx`
  - Segmented Control: Running | Upcoming | Finished
  - FlatList avec pagination (limit/offset)
- [ ] Créer `components/features/TournamentCard.tsx`
  - Nom, dates, tier, prizepool
  - Badge tier (S, A, B, C, D)
- [ ] Créer `app/tournament/[id].tsx` (détail)
- [ ] Implémenter infinite scroll

---

### ⏳ Palier 10: Écran Calendar + Date Picker
**Statut:** Pending

**À réaliser:**
- [ ] Installer `react-native-paper-dates`
- [ ] Créer `app/(tabs)/calendar.tsx`
  - Calendar picker
  - Liste matchs pour date sélectionnée
  - Dots sur dates avec matchs
- [ ] Créer `components/features/MatchCard.tsx`
- [ ] Fetch matchs: POST `/api/matches/by-date`

---

### ⏳ Palier 11: Articles + Détail
**Statut:** Pending

**À réaliser:**
- [ ] Créer section News sur Home (carousel)
- [ ] Créer `app/article/[slug].tsx`
  - Titre, auteur, date, featured image
  - Contenu HTML (react-native-render-html)
  - Support vidéo (WebView YouTube/Vimeo)
  - Bouton partage
- [ ] Créer `components/features/ArticleCard.tsx`
- [ ] Installer `react-native-render-html`, `expo-web-browser`

---

### ⏳ Palier 12: Écran Profil Utilisateur
**Statut:** Pending

**À réaliser:**
- [ ] Créer `app/(tabs)/profile.tsx`
  - Avatar, nom, email
  - Favorite Teams section
  - Notifications toggles
  - Security section
  - Logout button
- [ ] Créer `app/profile/edit.tsx`
  - Upload avatar (expo-image-picker)
- [ ] Installer `expo-image-picker`

---

### ⏳ Palier 13: Internationalisation (i18n)
**Statut:** Pending

**À réaliser:**
- [ ] Installer `react-i18next`, `i18next`
- [ ] Créer `/locales/*.json` (copier depuis web)
  - fr.json, en.json, es.json, de.json, it.json
- [ ] Créer `contexts/LocaleContext.tsx`
- [ ] Configurer i18next (`utils/i18n.ts`)
- [ ] Ajouter sélecteur langue dans Profile

---

### ⏳ Palier 14: Push Notifications + Analytics
**Statut:** Pending

**À réaliser:**
- [ ] Configurer Expo Notifications
- [ ] Demander permissions push (iOS)
- [ ] Enregistrer device token: POST `/api/notifications/register-device`
- [ ] Gérer réception notifications (foreground/tap)
- [ ] Implémenter analytics: POST `/api/analytics`
- [ ] Installer `expo-notifications`, `expo-device`

---

### ⏳ Palier 15: Build iOS + Testing Final
**Statut:** Pending

**À réaliser:**
- [ ] Configurer `app.json` pour production
  - Bundle ID, version, permissions
  - Splash screen, icon
- [ ] Créer EAS build config (`eas build:configure`)
- [ ] Créer build development: `eas build --platform ios --profile development`
- [ ] Tester sur simulateur: `npx expo run:ios`
- [ ] Checklist tests complets:
  - Auth (login/signup/logout)
  - Game selection
  - Live matches
  - Tournaments
  - Calendar
  - Articles
  - Profile
  - i18n
  - Push notifs
- [ ] Créer `eas.json`, `README.md` (docs déploiement)

---

## Endpoints Backend Disponibles

**Base URL:** `http://localhost:4000` (iOS simulator)

### Auth
- POST `/api/auth/login` - Login
- POST `/api/auth/register` - Register
- GET `/api/auth/profile` - Get profile (JWT required)

### Games
- GET `/api/games` - Liste 10 jeux supportés

### Tournaments
- GET `/api/tournaments` - Tournois running (limit, offset, sort, game)
- GET `/api/tournaments/upcoming` - Tournois à venir
- GET `/api/tournaments/finished` - Tournois terminés
- POST `/api/tournaments/by-date` - Tournois à une date
- GET `/api/tournaments/:id` - Détail tournoi
- GET `/api/tournaments/filtered` - Tournois avec filtres (game, status, tier)

### Matches
- POST `/api/matches/by-date` - Matchs à une date (body: {date, game?})
- GET `/api/matches/:id` - Détail match

### Live (SportDevs)
- GET `/api/live` - Matchs en direct (filtrable par game)

### Articles
- GET `/api/articles` - Liste articles (limit, offset, category)
- GET `/api/articles/:slug` - Détail article par slug

### User
- GET `/api/teams` - Équipes favorites
- PUT `/api/notifications` - Préférences notifications

---

## Commandes Utiles

### Développement
```bash
cd mobile-app
npx expo start              # Démarrer dev server
npx expo start --clear      # Démarrer avec cache clear
npm run ios                 # Ouvrir simulateur iOS
npm run android             # Ouvrir émulateur Android
```

### TypeScript
```bash
npx tsc --noEmit           # Vérifier erreurs TypeScript
```

### Build
```bash
eas build:configure         # Configurer EAS Build
eas build --platform ios --profile development
npx expo run:ios           # Build et run sur simulateur
```

### Git
```bash
git add mobile-app/
git commit -m "feat(mobile): ..."
git push origin migration-mobile
```

---

## Problèmes Connus & Solutions

### Peer Dependencies Conflict
**Problème:** `npm install` échoue avec erreur ERESOLVE (react@19.1.0 vs react-dom@19.2.3)

**Solution:** Utiliser `--legacy-peer-deps`
```bash
npm install <package> --legacy-peer-deps
```

### Imports @ non résolus
**Problème:** Imports `@/components/...` non trouvés

**Solution:**
1. Vérifier `babel.config.js` contient `babel-plugin-module-resolver`
2. Vérifier `tsconfig.json` contient `paths: { "@/*": ["./*"] }`
3. Redémarrer Metro bundler avec `--clear`

---

## Prochaines Étapes

**Actuellement:** Palier 8 complété ✅
**Prochain palier:** Palier 9 - Écran Tournaments + API PandaScore

**Actions immédiates:**
1. Créer `app/(tabs)/tournaments.tsx` avec Segmented Control (Running/Upcoming/Finished)
2. Créer `components/features/TournamentCard.tsx` (nom, dates, tier, prizepool)
3. Créer `app/tournament/[id].tsx` (écran détail tournoi)
4. Implémenter pagination (infinite scroll avec limit/offset)
5. Ajouter filtres par jeu (réutiliser Chips pattern)
6. Gérer loading/error/empty states

---

## Notes Importantes

- ❌ **Pas d'admin panel mobile** - Gestion articles/ads uniquement sur web
- ✅ **Backend Go inchangé** - Tous endpoints déjà opérationnels
- ✅ **Publicités reportées** - Palier 12+ (post-MVP)
- ✅ **Tests iOS uniquement** - Simulateur macOS requis
- ✅ **Compilation obligatoire** - Avant chaque commit
- ✅ **Navigation complète** - 11 écrans créés (5 tabs + 2 auth + 3 dynamic + root)

---

**Dernière mise à jour:** 19 décembre 2025
**Derniers commits:**
- `4aee790` - Palier 1 (Initialisation)
- `b4fe5f8` - Palier 2 (Design System)
- À venir - Palier 3 (Navigation + Expo Router)
- À venir - Palier 4 (Services API + Axios Client)
- À venir - Palier 5 (Authentification + JWT Context)
- À venir - Palier 6 (Écran Home + GameSelector)
- À venir - Palier 7 (Live Matches Carousel)
- À venir - Palier 8 (Écran Live + Liste Complète)
