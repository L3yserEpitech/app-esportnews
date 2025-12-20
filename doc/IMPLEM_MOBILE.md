# Migration Esport News : Web (Next.js) → Mobile (React Native + Expo)

## 📱 Vue d'ensemble du Projet

Ce document détaille la **migration complète** de l'application web **Esport News** (Next.js 15 + App Router) vers une **application mobile native** développée avec **React Native** et **Expo**, en réutilisant le **backend Go existant** sans modification.

### Objectifs de la Migration

✅ **Portage 1:1** de toutes les fonctionnalités web vers mobile
✅ **Réutilisation du backend Go** (aucune modification API requise)
✅ **Compatibilité iOS + Android** (single codebase)
✅ **Design system cohérent** avec la web app (même DA, couleurs, typographie)
✅ **Performance native** (animations fluides, navigation rapide)
✅ **Features mobile-native** (push notifications, deep linking, biometrics)

### Stack Technique

#### Frontend Web (Actuel)
- **Framework** : Next.js 15 (App Router)
- **React** : 19.1.0
- **UI** : Tailwind CSS v4 + shadcn/ui (Radix UI)
- **i18n** : next-intl (5 langues)
- **State** : Context API (Auth, Game, Preferences)
- **API Client** : Native Fetch
- **Routing** : App Router (32 routes)

#### Frontend Mobile (Cible)
- **Framework** : Expo SDK 52+
- **React Native** : 0.76+
- **UI** : React Native Paper / Native Base + custom components
- **i18n** : react-i18next ou expo-localization
- **State** : Context API (même architecture)
- **API Client** : Axios ou Fetch (réutilisation services)
- **Routing** : Expo Router v4 (structure similaire App Router)
- **Animations** : Reanimated v3 + Gesture Handler
- **Storage** : AsyncStorage (tokens, préférences)
- **Notifications** : expo-notifications + Firebase
- **Analytics** : Firebase Analytics / Sentry

#### Backend (Inchangé)
- **Langage** : Go 1.22 + Echo framework
- **Database** : PostgreSQL 15 (GORM)
- **Cache** : Redis 7
- **APIs Externes** : PandaScore (tournois) + SportDevs (live matches)
- **Déploiement** : Docker Compose local

### Périmètre de la Migration

#### ✅ Ce qui est porté
- **23 écrans** (routes publiques, auth, profile, légales)
- **58 composants** (39 app-specific + 19 UI components)
- **10 services API** (authService, gameService, tournamentService, etc.)
- **3 contexts** (Auth, Game, Preferences)
- **5 langues** (FR, EN, ES, DE, IT)
- **Tous types de données** (games, matches, tournaments, articles, ads, users)
- **Fonctionnalités premium** (abonnement Stripe, no-ads mobile)

#### ❌ Ce qui change
- **Tailwind CSS** → StyleSheet.create() + thème natif
- **shadcn/ui (Radix)** → React Native Paper / custom components
- **Next.js Image** → Expo Image
- **HTML rendering** (articles) → react-native-render-html ou WebView
- **CSS animations** → Reanimated v3
- **localStorage** → AsyncStorage / SecureStore

#### 🚫 Ce qui N'est PAS porté (Web uniquement)
- **Panel Admin** → Gestion articles/publicités reste en web uniquement
- **Rich Text Editor** → Création/édition de contenu en web uniquement
- **Analytics Dashboard** → Statistiques admin en web uniquement

---

## Phase 1 : Configuration Initiale du Projet Expo

### 1.1 Initialisation Expo
- [ ] Créer nouveau projet Expo dans `/mobile-app`
- [ ] Configurer TypeScript strict mode
- [ ] Setup Expo Router (équivalent Next.js App Router)
- [ ] Configurer structure de dossiers (`/app`, `/components`, `/services`, `/hooks`, `/contexts`)
- [ ] Installer dépendances essentielles (Expo 52+, React Native 0.76+)

### 1.2 Configuration Build & Development
- [ ] Configurer `app.json` / `app.config.ts`
- [ ] Setup EAS Build pour iOS/Android
- [ ] Configurer environnement variables (`.env` → Expo constants)
- [ ] Setup Metro bundler optimisations
- [ ] Configurer hot reload et fast refresh

---

## Phase 2 : Design System & Theming

### 2.1 Système de Couleurs
- [ ] Convertir CSS variables en thème React Native
  - Palette primaire (`#060B13`, `#091626`, `#182859`, `#F22E62`)
  - Tokens sémantiques (text-primary, bg-secondary, border-accent, etc.)
  - Couleurs de statut (live, upcoming, finished)
  - Couleurs de tier (S, A, B, C, D)
- [ ] Créer `theme.ts` avec dark/light modes
- [ ] Implémenter ThemeProvider avec Context API

### 2.2 Composants UI de Base (Remplacement Shadcn/UI)
- [ ] **Button** → Variantes (default, destructive, outline, secondary, ghost)
- [ ] **Card** → Container avec variants
- [ ] **Badge** → Status badges (live, tier, category)
- [ ] **Input** → Text input stylisé
- [ ] **Select/Picker** → Dropdown natif
- [ ] **Switch** → Toggle switch
- [ ] **Alert/Dialog** → Modals natifs
- [ ] **Sheet** → Bottom sheet (react-native-bottom-sheet)
- [ ] **Skeleton** → Loading placeholders animés
- [ ] **Separator** → Divider component
- [ ] **Tooltip** → Popover natif

**Bibliothèque suggérée** : React Native Paper ou Native Base (ou custom avec StyleSheet)

### 2.3 Typography & Spacing
- [ ] Définir système de spacing (4, 8, 12, 16, 24, 32, 48, 64)
- [ ] Configurer fonts (system fonts ou custom via Expo Google Fonts)
- [ ] Créer Text components stylisés (H1, H2, H3, Body, Caption)

---

## Phase 3 : Navigation & Routing

### 3.1 Expo Router Setup
- [ ] Installer Expo Router v4
- [ ] Configurer navigation stack/tabs
- [ ] Créer structure de routes (`/app` directory)

### 3.2 Écrans Principaux (23 routes à migrer)
#### Routes Publiques
- [ ] `/` → Home (live matches + news + tournaments)
- [ ] `/live` → Page live matches
- [ ] `/news` → Listing news
- [ ] `/articles` → Listing articles
- [ ] `/article/[slug]` → Détail article
- [ ] `/tournois` → Listing tournois
- [ ] `/tournois/[id]` → Détail tournoi
- [ ] `/match/[id]` → Détail match
- [ ] `/calendrier` → Vue calendrier

#### Routes Auth
- [ ] `/auth/login` → Écran login
- [ ] `/auth/register` → Écran inscription
- [ ] `/auth/signin` → Variante sign in

#### Routes Profile
- [ ] `/profile` → Profil utilisateur
- [ ] `/profile/info` → Informations profil
- [ ] `/profile/teams` → Équipes favorites
- [ ] `/profile/notifications` → Préférences notifications
- [ ] `/profile/security` → Sécurité
- [ ] `/profile/preferences` → Préférences (langue, thème)

#### Routes Légales
- [ ] `/legal/mentions-legales` → Mentions légales
- [ ] `/legal/cookies` → Politique cookies

### 3.3 Navigation Guards
- [ ] Redirection si non authentifié (routes profile)
- [ ] Deep linking configuration

---

## Phase 4 : Services & API Integration

### 4.1 Configuration Backend
- [ ] Créer `constants/config.ts` avec `BACKEND_URL`
- [ ] Setup Axios ou Fetch wrapper
- [ ] Implémenter retry logic et timeouts

### 4.2 Migration Services (10 services à porter)
- [ ] **authService.ts** → Signup, login, getMe, token storage (AsyncStorage)
- [ ] **gameService.ts** → getGames, getGameById, getGameByAcronym
- [ ] **liveMatchService.ts** → getLiveMatches(gameAcronym?)
- [ ] **tournamentService.ts** → getTournamentsByDate, filtered, by status
- [ ] **matchService.ts** → getMatchesByDate, getMatchById
- [ ] **articleService.ts** → getAllArticles, getArticleBySlug, similar
- [ ] **advertisementService.ts** → getActiveAdvertisements
- [ ] **userService.ts** → User profile operations
- [ ] **teamService.ts** → Team operations
- [ ] **subscriptionService.ts** → Stripe payment operations

### 4.3 Type Definitions
- [ ] Copier `/app/types/index.ts` vers `/types/index.ts`
- [ ] Vérifier compatibilité avec React Native
- [ ] Adapter types pour AsyncStorage (vs localStorage)

---

## Phase 5 : State Management & Contexts

### 5.1 Migration Contexts (3 contexts)
- [ ] **AuthContext** → useAuth hook
  - [ ] Token storage via AsyncStorage
  - [ ] Auto-login on mount
  - [ ] User state management
  - [ ] Login/logout/signup handlers
- [ ] **GameContext** → useGame hook
  - [ ] Game selection state
  - [ ] AsyncStorage persistence
  - [ ] Cross-tab sync → Event emitter natif
- [ ] **PreferencesContext** → usePreferences hook
  - [ ] Language persistence
  - [ ] Theme persistence (dark/light/auto)
  - [ ] AsyncStorage pour cookies

### 5.2 Custom Hooks
- [ ] Migrer `use-mobile.ts` → `use-dimensions.ts` (Dimensions API)
- [ ] Créer `use-keyboard.ts` (détection clavier)
- [ ] Créer `use-safe-area.ts` (SafeAreaView)

---

## Phase 6 : Composants Layout

### 6.1 Composants Globaux
- [ ] **ClientLayout** → App wrapper avec providers
- [ ] **Navbar** → Header natif avec navigation
  - [ ] Logo dynamique (thème)
  - [ ] Menu mobile (drawer)
  - [ ] User dropdown
  - [ ] Game selector trigger
- [ ] **Footer** → Footer natif (TabBar alternative)
- [ ] **SettingsModal** → Bottom sheet pour settings

### 6.2 Tab Navigation
- [ ] Bottom tabs (Home, Live, Tournois, Calendrier, Profil)
- [ ] Icons avec react-native-vector-icons
- [ ] Active state styling

---

## Phase 7 : Composants Jeux

### 7.1 Game Selection
- [ ] **GameSelector** → Horizontal FlatList avec scroll
  - [ ] Images selected/unselected
  - [ ] Animations de sélection
  - [ ] Auto-scroll vers sélection
  - [ ] Gradient overlays
- [ ] **MobileGameSelector** → Bottom sheet picker
  - [ ] Liste verticale des jeux
  - [ ] Search bar
  - [ ] Checkmarks pour sélection

### 7.2 Skeletons
- [ ] **GameCardSkeleton** → Animated placeholder

---

## Phase 8 : Composants Matches

### 8.1 Live Matches
- [ ] **LiveMatchesCarousel** → FlatList horizontal paginé
  - [ ] Snap behavior (react-native-snap-carousel alternative)
  - [ ] Pagination dots
  - [ ] Auto-play optionnel
- [ ] **LiveMatchCard** → Card avec équipes, scores, stream
  - [ ] Team logos optimisés
  - [ ] Badge "LIVE" animé
  - [ ] Bouton "Watch" → Linking.openURL
- [ ] **LiveMatchItem** → Variant liste
- [ ] **PandaMatchCard** → Match PandaScore

### 8.2 Interactions
- [ ] Liens de stream → Ouvrir navigateur externe (`Linking.openURL`)
- [ ] Long press pour partager match (Share API)

---

## Phase 9 : Composants Tournois

### 9.1 Tournament Display
- [ ] **RunningTournaments** → Section tournois en cours
- [ ] **TournamentCard** → Card avec tier, prizepool, dates
  - [ ] Badge tier (S/A/B/C/D) avec couleurs
  - [ ] Date formatting (date-fns)
- [ ] **TournamentStats** → Stats tournoi
- [ ] **TournamentFilters** → Filtres (tier, status, game)
  - [ ] Bottom sheet pour filtres mobiles
  - [ ] Pills pour sélection active

### 9.2 Bracket Visualization
- [ ] **BracketDisplay** → SVG bracket natif (react-native-svg)
  - [ ] Zoom/pan gestures (react-native-gesture-handler)
  - [ ] Responsive layout
- [ ] **TeamsRosters** → Rosters équipes

---

## Phase 10 : Composants Articles & News

### 10.1 Article Display
- [ ] **ArticleCard** → Card article (grid/list variants)
  - [ ] Image optimisée (Expo Image)
  - [ ] Category badge
  - [ ] Read time
- [ ] **FeaturedArticleCard** → Hero article
- [ ] **ArticleCover** → Cover avec support vidéo
  - [ ] YouTube embed → WebView ou Linking
  - [ ] Vimeo embed → WebView
  - [ ] MP4 → Expo Video
- [ ] **ArticleContent** → Renderer HTML vers React Native
  - [ ] **Option 1** : react-native-render-html
  - [ ] **Option 2** : WebView avec HTML injecté
  - [ ] Support images, liens, formatting

### 10.2 News Section
- [ ] **NewsSection** → Featured + liste
- [ ] **NewsSkeleton** → Loading state

---

## Phase 11 : Composants Publicité

### 11.1 Ad Display
- [ ] **AdBanner** → Banner publicitaire
  - [ ] Image optimisée (Expo Image)
  - [ ] Click → Linking.openURL
  - [ ] Tracking impression (analytics)
- [ ] **AdColumn** → N/A pour mobile (format différent)
  - [ ] Remplacer par AdCarousel ou interstitiels
- [ ] **AdSkeleton** → Loading placeholder

### 11.2 Logique Abonnement
- [ ] Cacher popups ads pour abonnés Premium
- [ ] Afficher banners pour utilisateurs gratuits

---

## Phase 12 : Composants Profil

### 12.1 Profile Screens
- [ ] **ProfileSidebar** → Remplacer par Stack Navigator
- [ ] **ProfileEditModal** → Modal plein écran
- [ ] **ProfileNavDropdown** → Liste native
- [ ] **TeamSearchResult** → FlatList item

### 12.2 Profile Sections
- [ ] **ProfileInfoSection** → Formulaire avec inputs natifs
- [ ] **FavoriteTeamsSection** → FlatList équipes favorites
  - [ ] Swipe-to-delete (react-native-gesture-handler)
  - [ ] Add button → Modal recherche
- [ ] **NotificationsSection** → Liste de switches
- [ ] **SecuritySection** → Formulaire changement mot de passe
- [ ] **PreferencesSection** → Pickers langue/thème

---

## Phase 13 : Composants Calendrier

### 13.1 Calendar View
- [ ] **Calendar** → Calendrier natif
  - [ ] **Option 1** : react-native-calendars
  - [ ] **Option 2** : Custom avec FlatList
  - [ ] Marqueurs pour jours avec matchs
- [ ] **MatchCard** → Card match dans calendrier
  - [ ] Filtrage par date
  - [ ] Filtrage par jeu

---

## Phase 14 : Internationalisation (i18n)

### 14.1 Setup i18n
- [ ] Installer react-i18next ou expo-localization
- [ ] Migrer fichiers JSON (`/public/locales/`)
  - [ ] fr.json
  - [ ] en.json
  - [ ] es.json
  - [ ] de.json
  - [ ] it.json
- [ ] Créer i18n provider
- [ ] Implémenter hook `useTranslations()`

### 14.2 Language Switching
- [ ] Language picker dans PreferencesSection
- [ ] Persistence dans AsyncStorage
- [ ] Reload app on language change

---

## Phase 15 : Images & Médias

### 15.1 Optimisation Images
- [ ] Installer Expo Image (`expo-image`)
- [ ] Configurer remote patterns (Cloudflare R2, PandaScore CDN)
- [ ] Créer composant `OptimizedImage`
  - [ ] Lazy loading
  - [ ] Placeholder blurhash
  - [ ] Error handling

### 15.2 Vidéos
- [ ] Installer Expo Video (`expo-av`)
- [ ] Support YouTube embeds (WebView ou Linking)
- [ ] Support Vimeo embeds
- [ ] Support MP4 natifs

---

## Phase 16 : Animations & Interactions

### 16.1 Bibliothèques Animation
- [ ] Installer react-native-reanimated v3
- [ ] Installer react-native-gesture-handler
- [ ] Configurer Babel plugin

### 16.2 Animations à Recréer
- [ ] **Fade in** → useSharedValue + withTiming
- [ ] **Slide in** → TranslateY animations
- [ ] **Shimmer** (skeleton) → Linear gradient animé
- [ ] **Scale on press** → useAnimatedStyle
- [ ] **Scroll-triggered animations** → Animated.event

### 16.3 Gestures
- [ ] Swipe-to-delete (FavoriteTeams)
- [ ] Pull-to-refresh (FlatLists)
- [ ] Pan/zoom (BracketDisplay)

---

## Phase 17 : Stockage Local & Cache

### 17.1 AsyncStorage
- [ ] Installer @react-native-async-storage/async-storage
- [ ] Migrer logique localStorage
  - [ ] `authToken`
  - [ ] `esport_language`
  - [ ] `esport_theme`
  - [ ] `selectedGame`

### 17.2 Cache Stratégie
- [ ] Implémenter cache en mémoire (Map ou LRU cache)
- [ ] Cache images (Expo Image auto-cache)
- [ ] Cache API responses (React Query optionnel)

---

## Phase 18 : Notifications Push

### 18.1 Firebase Setup
- [ ] Créer projet Firebase
- [ ] Installer expo-notifications
- [ ] Configurer FCM pour Android
- [ ] Configurer APNs pour iOS

### 18.2 Notification Logic
- [ ] Demander permissions
- [ ] Enregistrer token sur backend
- [ ] Écouter notifications foreground/background
- [ ] Navigation vers match/article au tap

### 18.3 Préférences Notifications
- [ ] Switches dans NotificationsSection
  - [ ] notifi_push
  - [ ] notif_articles
  - [ ] notif_news
  - [ ] notif_matchs
- [ ] Sync préférences avec backend

---

## Phase 19 : Deep Linking

### 19.1 Configuration
- [ ] Configurer app.json scheme (`esportnews://`)
- [ ] Configurer universal links (iOS)
- [ ] Configurer app links (Android)

### 19.2 Routes à Supporter
- [ ] `esportnews://article/{slug}`
- [ ] `esportnews://tournament/{id}`
- [ ] `esportnews://match/{id}`
- [ ] `esportnews://profile`

---

## Phase 20 : Accessibilité (A11y)

### 20.1 React Native A11y
- [ ] accessibilityLabel sur tous les boutons
- [ ] accessibilityHint pour actions complexes
- [ ] accessibilityRole (button, link, header)
- [ ] accessibilityState (selected, disabled)

### 20.2 Tests
- [ ] Tester avec TalkBack (Android)
- [ ] Tester avec VoiceOver (iOS)
- [ ] Contraste couleurs WCAG 2.1 AA

---

## Phase 21 : Performance

### 21.1 Optimisations Listes
- [ ] FlatList avec `getItemLayout` (hauteur fixe)
- [ ] `windowSize`, `maxToRenderPerBatch` tuning
- [ ] `removeClippedSubviews={true}`
- [ ] Memo sur items (`React.memo`)

### 21.2 Optimisations Images
- [ ] Expo Image avec caching
- [ ] Réduire résolution images (resize on server)
- [ ] WebP support

### 21.3 Bundle Size
- [ ] Hermes engine activé
- [ ] Code splitting (Expo Router automatique)
- [ ] Tree shaking (Metro)

### 21.4 Profiling & Monitoring
- [ ] React DevTools Profiler pour identifier re-renders coûteux
- [ ] Flipper Performance plugin
- [ ] Mesure FPS avec `react-native-performance`
- [ ] Monitoring bundle size par build

---

## Phase 22 : Authentification & Sécurité

### 22.1 JWT Storage
- [ ] AsyncStorage pour token (chiffrement si sensible)
- [ ] Secure Store (expo-secure-store) pour production
- [ ] Auto-logout si token expiré

### 22.2 Biometrics
- [ ] Installer expo-local-authentication
- [ ] Option login avec FaceID/TouchID
- [ ] Fallback sur password

---

## Phase 23 : Paiements Stripe

### 23.1 Stripe Setup
- [ ] Installer @stripe/stripe-react-native
- [ ] Configurer merchant identifier (iOS)
- [ ] Configurer Google Pay (Android)

### 23.2 Subscription Flow
- [ ] Écran abonnement Premium
- [ ] Payment sheet natif
- [ ] Gestion statut abonnement (sync backend)
- [ ] Restore purchases

---

## Phase 24 : Analytics & Monitoring

### 24.1 Analytics
- [ ] Installer Firebase Analytics ou Expo Analytics
- [ ] Tracking événements clés
  - [ ] select_game
  - [ ] view_live_list
  - [ ] open_stream
  - [ ] click_ad
  - [ ] view_news
  - [ ] read_article
  - [ ] subscribe_noads

### 24.2 Crash Reporting
- [ ] Installer Sentry (expo-sentry)
- [ ] Capturer errors global
- [ ] Source maps upload

---

## Phase 25 : Tests

### 25.1 Unit Tests
- [ ] Jest configuration
- [ ] Tests services (API calls)
- [ ] Tests utils (formatters, validators)

### 25.2 Component Tests
- [ ] React Native Testing Library
- [ ] Tests composants UI de base
- [ ] Tests snapshot critiques

### 25.3 E2E Tests
- [ ] Detox configuration (iOS/Android)
- [ ] Tests critiques (login, navigation, live matches)

---

## Phase 26 : Build & Déploiement

### 26.1 EAS Build
- [ ] Configurer eas.json
- [ ] Build profiles (development, preview, production)
- [ ] Certificates iOS
- [ ] Keystore Android

### 26.2 App Store
- [ ] Créer compte Apple Developer
- [ ] Screenshots + descriptions (5 langues)
- [ ] Privacy policy URL
- [ ] App Store submission

### 26.3 Google Play
- [ ] Créer compte Google Play Console
- [ ] Screenshots + descriptions
- [ ] Rating questionnaire
- [ ] Play Store submission

---

## Phase 27 : Documentation & Handoff

### 27.1 Documentation Technique
- [ ] README.md avec setup instructions
- [ ] Architecture documentation
- [ ] API integration guide
- [ ] Deployment guide

### 27.2 Documentation Utilisateur
- [ ] Guide d'utilisation app
- [ ] FAQ
- [ ] Support contact

### 27.3 Knowledge Transfer
- [ ] Sessions de formation équipe
- [ ] Documentation des patterns custom
- [ ] Playbook pour troubleshooting commun
- [ ] Roadmap maintenance post-lancement

---

## 🎯 Paliers de Migration (Roadmap Macro)

### Palier 1 : Fondations (Semaines 1-2)
**Objectif** : Infrastructure de base fonctionnelle + design system

✅ **Livrables** :
- Projet Expo initialisé et buildable (iOS + Android)
- Design system complet (colors, theme, spacing, composants UI de base)
- Navigation (Expo Router) avec tabs principales configurées
- Services API connectés au backend Go
- 3 contextes (Auth, Game, Preferences) fonctionnels
- i18n setup (5 langues)

📋 **Phases incluses** : 1, 2, 3 (partiel), 4, 5, 14

🧪 **Critères de validation** :
- Build successful iOS + Android
- Login/logout fonctionnel avec token persistence
- Changement de langue fonctionne
- Sélection de jeu persiste dans AsyncStorage
- Composants UI de base réutilisables (Button, Card, Badge, Input)

---

### Palier 2 : Contenu Principal (Semaines 3-5)
**Objectif** : Écrans publics (home, live, tournois, articles, calendrier) fonctionnels

✅ **Livrables** :
- Home screen avec live matches + news + running tournaments
- Live matches screen avec carousel et filtres par jeu
- Tournois screen avec filtres (tier, status, game)
- Articles listing + détail article (HTML rendering)
- Calendrier avec filtres par date/jeu
- Match detail + Tournament detail

📋 **Phases incluses** : 6 (partiel), 7, 8, 9, 10, 13, 15

🧪 **Critères de validation** :
- Tous les écrans publics navigables et fonctionnels
- Données backend affichées correctement (matchs, tournois, articles)
- Images optimisées (Expo Image) avec placeholders
- HTML articles rendus proprement (react-native-render-html ou WebView)
- Vidéos supportées (YouTube, Vimeo, MP4)
- Calendrier interactif avec marqueurs de matchs

---

### Palier 3 : Profil & Authentification (Semaine 6)
**Objectif** : Écrans profil utilisateur + gestion compte

✅ **Livrables** :
- Login + Register screens
- Profile screen avec sections (info, équipes favorites, notifications, sécurité, préférences)
- CRUD équipes favorites avec swipe-to-delete
- Préférences notifications (4 switches)
- Changement mot de passe
- Biométrie optionnelle (FaceID/TouchID)

📋 **Phases incluses** : 3 (routes auth/profile), 12, 22

🧪 **Critères de validation** :
- Signup + login + logout fonctionnels
- Profil utilisateur éditable (nom, email, avatar)
- Ajout/suppression équipes favorites sync backend
- Préférences notifications sauvegardées
- Biométrie activable (si hardware supporté)

---

### Palier 4 : Monétisation & Premium (Semaine 7)
**Objectif** : Système de publicités + abonnement Stripe

✅ **Livrables** :
- AdBanner component (mobile)
- Logique affichage pubs (cachées pour abonnés Premium)
- Stripe integration (payment sheet natif)
- Subscription flow (iOS + Android)
- Restore purchases

📋 **Phases incluses** : 11, 23

🧪 **Critères de validation** :
- Publicités affichées pour utilisateurs gratuits
- Publicités masquées pour abonnés Premium
- Paiement Stripe iOS + Android fonctionnel
- Statut abonnement synchronisé backend
- Restore purchases fonctionne après réinstall

---

### Palier 5 : Features Natives (Semaine 8)
**Objectif** : Push notifications + deep linking + animations

✅ **Livrables** :
- Firebase setup (iOS + Android)
- Push notifications permissions + token registration
- Notification handlers (foreground/background/tap)
- Deep linking configuration (esportnews://)
- Universal links (iOS) + App links (Android)
- Animations Reanimated (fade, slide, shimmer, gestures)

📋 **Phases incluses** : 16, 18, 19

🧪 **Critères de validation** :
- Notifications push reçues sur device physique
- Navigation correcte au tap notification (article/match/tournament)
- Deep links fonctionnent (esportnews://article/slug)
- Universal links redirect vers app (https://esportnews.com/article/slug)
- Animations fluides (60 FPS minimum)
- Gestures (swipe-to-delete, pull-to-refresh, pan/zoom bracket)

---

### Palier 6 : Qualité & Production (Semaines 9-10)
**Objectif** : Optimisations, tests, accessibilité, builds production

✅ **Livrables** :
- Optimisations performance (listes, images, bundle)
- Tests unitaires services + composants critiques
- Tests E2E (Detox) pour flows critiques
- Accessibilité WCAG 2.1 AA
- EAS builds production (iOS + Android)
- Screenshots + descriptions stores (5 langues)
- Soumission App Store + Google Play

📋 **Phases incluses** : 17, 20, 21, 24, 25, 26, 27

🧪 **Critères de validation** :
- Performance : FPS > 60, LCP < 2.5s, bundle < 50MB
- Tests : Coverage > 70%, E2E flows critiques passent
- Accessibilité : TalkBack + VoiceOver fonctionnels, contraste OK
- Builds : Production builds successful iOS + Android
- Stores : Apps soumises et en review (ou approuvées)

---

## 📊 Résumé des Paliers

| Palier | Durée | Focus | Phases | Complexité |
|--------|-------|-------|--------|------------|
| **1. Fondations** | 2 sem | Infra + Design System | 1-5, 14 | Moyenne |
| **2. Contenu Principal** | 3 sem | Écrans publics | 6-10, 13, 15 | Haute |
| **3. Profil & Auth** | 1 sem | Compte utilisateur | 3, 12, 22 | Moyenne |
| **4. Monétisation** | 1 sem | Pubs + Stripe | 11, 23 | Moyenne |
| **5. Features Natives** | 1 sem | Notifs + Deep links + Animations | 16, 18, 19 | Moyenne |
| **6. Qualité & Prod** | 2 sem | Tests + Optimisations + Deploy | 17, 20, 21, 24-27 | Haute |
| **TOTAL** | **10 semaines** | **Migration complète** | **27 phases** | **—** |

---

## 🚀 Ordre d'Exécution Recommandé

### Phase Parallélisables (Optimisation)

Certaines phases peuvent être travaillées en parallèle pour gagner du temps :

**Palier 1** :
- ✅ Phases 1, 2 peuvent être faites en parallèle (infra + design system indépendants initialement)
- ⚠️ Phase 4 (services) dépend de Phase 1 (config backend URL)
- ⚠️ Phase 5 (contexts) dépend de Phase 4 (services)

**Palier 2** :
- ✅ Phases 7, 8, 9, 10, 13 sont largement indépendantes (composants différents)
- ⚠️ Toutes dépendent de Phase 6 (layout) + Phase 5 (contexts)

**Palier 5** :
- ✅ Phases 18 (notifications), 19 (deep linking), 16 (animations) peuvent être parallélisées
- ⚠️ Toutes nécessitent Palier 1 complété

**Palier 6** :
- ✅ Phases 21 (performance), 24 (analytics), 25 (tests) peuvent être parallélisées
- ⚠️ Phase 26 (build/deploy) doit être la dernière

---

## ⚠️ Risques & Points de Vigilance

### Haute Priorité (Bloquants Potentiels)

1. **Bracket Visualization (Phase 9.2)** ⚠️
   - Complexité : SVG complexe avec zoom/pan gestures
   - Risque : Performance dégradée sur Android
   - Mitigation : Considérer alternative (images statiques ou WebView)

2. **HTML Article Rendering (Phase 10.1)** ⚠️
   - Complexité : Styles CSS custom à recréer en React Native
   - Risque : Rendu incohérent vs web
   - Mitigation : Valider tôt avec articles réels, envisager WebView

3. **Video Embeds (Phase 15.2)** ⚠️
   - Complexité : YouTube/Vimeo embeds nécessitent WebView
   - Risque : Autoplay/fullscreen comportements inconsistants
   - Mitigation : Tests extensifs iOS + Android

### Priorité Moyenne

4. **Performance FlatLists longues (Phase 21.1)**
   - Risque : Lags sur listes 100+ items (tournois passés)
   - Mitigation : Pagination backend + `getItemLayout` + memo

5. **Notifications Push iOS (Phase 18)**
   - Risque : Permissions refusées par user
   - Mitigation : Onboarding explicatif + fallback notifications in-app

6. **Deep Linking conflicts (Phase 19)**
   - Risque : Conflits avec autres apps (schemes identiques)
   - Mitigation : Scheme unique + universal links prioritaires

---

## 🎓 Décisions Techniques Critiques

### À Valider AVANT de Commencer

| Décision | Options | Recommandation |
|----------|---------|----------------|
| **UI Library** | React Native Paper / Native Base / Custom | **React Native Paper** (mature, Material Design) |
| **HTML Rendering** | react-native-render-html / WebView | **react-native-render-html** (meilleure intégration) |
| **Calendar** | react-native-calendars / Custom FlatList | **react-native-calendars** (éprouvé, customizable) |
| **State Management** | Context API / Redux / Zustand | **Context API** (cohérence avec web, suffisant) |
| **Data Fetching** | Fetch natif / Axios / React Query | **Fetch natif** (cohérence web, pas de dépendance) |
| **Analytics** | Firebase Analytics / Expo Analytics | **Firebase Analytics** (déjà setup pour notifs) |

---

## 📝 Checklist Avant Lancement

### Technique
- [ ] Builds production iOS + Android sans erreurs
- [ ] Tests E2E passent (login, navigation, live matches, articles)
- [ ] Pas de crash au lancement (crash-free rate > 99%)
- [ ] Performance : FPS > 55, LCP < 3s, bundle < 60MB
- [ ] Pas de memory leaks (profiler Flipper)
- [ ] Deeplinks testés (esportnews:// + https://)
- [ ] Push notifications testées (foreground, background, killed)
- [ ] Offline handling graceful (network errors)
- [ ] Images optimisées (< 200KB par image, WebP)

### Contenu
- [ ] Articles HTML rendus correctement (50+ articles testés)
- [ ] Vidéos jouent correctement (YouTube, Vimeo, MP4)
- [ ] Toutes les images chargent (logos jeux, équipes, tournois)
- [ ] Traductions complètes (5 langues, 100% coverage)
- [ ] Données live correctes (matchs, tournois, news)

### Business
- [ ] Stripe payments testés (iOS + Android, sandbox + prod)
- [ ] Publicités affichées correctement (positions 1-3)
- [ ] Abonnement Premium masque pubs mobile
- [ ] Analytics trackent tous événements clés

### Légal
- [ ] Privacy Policy URL configurée
- [ ] RGPD : Consentement notifications
- [ ] App Store age rating correct (12+)
- [ ] Google Play content rating questionnaire rempli
- [ ] Mentions légales accessibles in-app

### Stores
- [ ] Screenshots 5 langues (FR, EN, ES, DE, IT)
- [ ] Descriptions stores optimisées SEO
- [ ] Keywords pertinents (max 100 chars iOS)
- [ ] Feature graphic Play Store (1024x500)
- [ ] Icon adaptatif Android (foreground + background)
- [ ] App preview videos (optionnel mais recommandé)

---

## Fichiers Critiques à Modifier/Créer

### Configuration
- `/mobile-app/package.json` → Dépendances RN
- `/mobile-app/app.json` → Config Expo
- `/mobile-app/babel.config.js` → Babel plugins
- `/mobile-app/metro.config.js` → Metro bundler
- `/mobile-app/tsconfig.json` → TypeScript config

### Structure
- `/mobile-app/app/` → Routes Expo Router
- `/mobile-app/components/` → Tous composants UI
- `/mobile-app/services/` → API clients (10 services)
- `/mobile-app/contexts/` → 3 contexts (Auth, Game, Preferences)
- `/mobile-app/hooks/` → Custom hooks
- `/mobile-app/types/` → TypeScript types
- `/mobile-app/constants/` → Config, theme, colors
- `/mobile-app/utils/` → Helpers
- `/mobile-app/assets/` → Images, fonts

---

## Dépendances React Native Principales

### Essentielles
```json
{
  "expo": "~52.0.0",
  "react": "19.0.0",
  "react-native": "0.76.0",
  "expo-router": "~4.0.0",
  "@react-navigation/native": "^7.0.0",
  "react-native-gesture-handler": "~2.20.0",
  "react-native-reanimated": "~3.16.0",
  "react-native-safe-area-context": "^4.12.0",
  "react-native-screens": "^4.3.0"
}
```

### UI & Styling
```json
{
  "react-native-paper": "^5.12.0" // ou Native Base
  "react-native-vector-icons": "^10.2.0",
  "react-native-svg": "^15.8.0",
  "expo-linear-gradient": "~14.0.0",
  "react-native-bottom-sheet": "^5.0.0"
}
```

### Data & Storage
```json
{
  "@react-native-async-storage/async-storage": "^2.1.0",
  "expo-secure-store": "~14.0.0",
  "axios": "^1.13.2", // déjà dans web
  "date-fns": "^4.1.0" // déjà dans web
}
```

### Media
```json
{
  "expo-image": "~2.0.0",
  "expo-av": "~15.0.0",
  "expo-image-picker": "~16.0.0",
  "react-native-render-html": "^6.3.0"
}
```

### Features
```json
{
  "expo-notifications": "~0.29.0",
  "expo-linking": "~7.0.0",
  "expo-localization": "~16.0.0",
  "react-i18next": "^15.2.0",
  "@stripe/stripe-react-native": "^0.40.0"
}
```

### Analytics & Monitoring
```json
{
  "expo-analytics": "~7.0.0",
  "sentry-expo": "~8.0.0"
}
```

---

## Estimations

### Composants à Créer/Migrer
- **Total routes** : 23 écrans (sans admin)
- **Total composants** : ~58 composants (39 app + 19 UI)
- **Services** : 10 services à porter
- **Contexts** : 3 contexts

### Adaptations Majeures
1. **Navigation** : Next.js App Router → Expo Router (structure similaire ✅)
2. **Styling** : Tailwind → StyleSheet + thème (effort moyen)
3. **Images** : Next.js Image → Expo Image (API similaire)
4. **HTML Rendering** : Articles content → react-native-render-html
5. **Forms** : Inputs web → TextInput natif
6. **Modals** : Radix Dialog → React Native Modal/Bottom Sheet

---

## Risques & Points d'Attention

### Haute Complexité
1. **Bracket visualization** (SVG complexe avec zoom/pan)
2. **Article HTML rendering** (formatage riche)
3. **Video embeds** (YouTube/Vimeo dans RN)

### Moyenne Complexité
1. **Carousel matchs live** (snap behavior)
2. **Filtres avancés** (tournois, bottom sheet)
3. **Notifications push** (setup Firebase)
4. **Deep linking** (configuration iOS/Android)

### Backend Compatibility
- ✅ **Aucun changement backend nécessaire** (APIs REST identiques)
- ✅ **Types TypeScript réutilisables** (copie directe)
- ✅ **Service layer pattern compatible** (fetch fonctionne en RN)

---

## Prochaines Étapes

1. **Validation** : Confirmer stack technique (Expo vs React Native CLI)
2. **Priorisation** : Définir MVP mobile (features essentielles first)
3. **Prototype** : Créer écran Home + Live matches (proof of concept)
4. **Itération** : Migrer composants par batch (Layout → Matches → Tournaments → Articles)

---

**Date de création** : 2025-12-18
**Dernière mise à jour** : 2025-12-18
**Statut** : En attente de validation utilisateur

---
---

# 📖 README - Application Mobile Esport News

## Table des Matières

1. [Introduction](#introduction)
2. [Architecture de l'Application](#architecture-de-lapplication)
3. [Prérequis & Installation](#prérequis--installation)
4. [Structure du Projet](#structure-du-projet)
5. [Configuration](#configuration)
6. [Développement](#développement)
7. [Design System](#design-system)
8. [Navigation & Routing](#navigation--routing)
9. [Gestion d'État](#gestion-détat)
10. [API & Services](#api--services)
11. [Internationalisation](#internationalisation)
12. [Authentification](#authentification)
13. [Notifications Push](#notifications-push)
14. [Déploiement](#déploiement)
15. [Troubleshooting](#troubleshooting)
16. [Contribution](#contribution)

---

## Introduction

**Esport News Mobile** est l'application mobile native (iOS + Android) de la plateforme Esport News, développée avec **React Native** et **Expo SDK 52+**. Elle offre une expérience mobile optimale pour consulter les matchs en direct, les tournois, les actualités esport, et gérer son profil utilisateur.

### Caractéristiques Principales

- 🎮 **10 jeux supportés** : Valorant, CS2, LoL, Dota 2, Overwatch, Call of Duty, Rainbow Six, Rocket League, FIFA, Wild Rift
- 🔴 **Live matches** en temps réel (agrégation SportDevs)
- 🏆 **Tournois structurés** (PandaScore API)
- 📰 **Actualités & articles** éditoriaux avec vidéos
- 👤 **Profil utilisateur** avec équipes favorites
- 🔔 **Notifications push** personnalisables
- 💎 **Abonnement Premium** (sans publicités mobiles)
- 🌍 **5 langues** : Français, Anglais, Espagnol, Allemand, Italien
- 🎨 **Dark/Light mode** + auto selon système
- 🔐 **Authentification JWT** + biométrie optionnelle

---

## Architecture de l'Application

### Vue d'ensemble technique

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Expo Router  │  │   Contexts   │  │   Services   │      │
│  │  (routing)   │  │   (state)    │  │  (API calls) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                   │            │
│         └──────────────────┴───────────────────┘            │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────┼────────────────────────────────┐
│                       BACKEND GO                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Redis     │  │  External    │      │
│  │   (GORM)     │  │   (cache)    │  │    APIs      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│       Users            Sessions         PandaScore          │
│       Articles         Live data        SportDevs           │
└─────────────────────────────────────────────────────────────┘
```

### Flux de Données

1. **User Action** (tap, swipe) → Component
2. **Component** appelle Service (ex: `tournamentService.getTournaments()`)
3. **Service** fait requête HTTP → Backend Go
4. **Backend** interroge PostgreSQL / Redis / APIs externes
5. **Response** → Service parse JSON → Component update state
6. **UI** re-render avec nouvelles données

### Patterns Architecturaux

- **Presentation-Container Pattern** : Séparation logique/UI
- **Service Layer Pattern** : Centralisation appels API
- **Context API** : State management global (Auth, Game, Preferences)
- **Expo Router** : File-based routing (comme Next.js)

---

## Prérequis & Installation

### Prérequis

#### Système
- **Node.js** : v20+ (LTS recommandé)
- **npm** ou **yarn** : Dernière version
- **Git** : Pour cloner le repo

#### Mobile Development
- **Expo CLI** : `npm install -g expo-cli`
- **EAS CLI** : `npm install -g eas-cli` (pour builds production)

#### iOS (macOS uniquement)
- **Xcode** : 15+ avec Command Line Tools
- **iOS Simulator** : Intégré dans Xcode
- **CocoaPods** : `sudo gem install cocoapods`

#### Android
- **Android Studio** : Dernière version stable
- **Android SDK** : API Level 33+ (Android 13)
- **JDK** : 17+ (OpenJDK ou Oracle)
- **Android Emulator** : AVD configuré

#### Backend (pour dev local)
- **Docker** + **Docker Compose** : Pour lancer backend Go
- OU backend déjà déployé accessible via URL

### Installation

#### 1. Cloner le Repository

```bash
git clone https://github.com/votre-org/esportnews.git
cd esportnews/mobile-app
```

#### 2. Installer les Dépendances

```bash
npm install
# ou
yarn install
```

#### 3. Configurer les Variables d'Environnement

Créer `.env` à la racine de `/mobile-app` :

```bash
# Backend API
EXPO_PUBLIC_BACKEND_URL=http://localhost:4000

# Stripe (production keys pour build prod)
EXPO_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...

# Firebase (pour notifications push)
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=esportnews-mobile

# Sentry (monitoring erreurs)
SENTRY_DSN=https://...@sentry.io/...
```

#### 4. Prébuild (si nécessaire)

Pour générer dossiers natifs iOS/Android (requis pour certaines libs) :

```bash
npx expo prebuild
```

**Note** : Avec Expo Go, pas besoin de prebuild. Utilisez-le seulement pour dev builds ou production.

#### 5. Lancer l'App en Dev

##### Avec Expo Go (recommandé pour dev rapide)

```bash
npx expo start
```

- Scanner QR code avec **Expo Go app** (iOS/Android)
- Ou appuyer `i` (iOS Simulator) / `a` (Android Emulator)

##### Avec Dev Build (si libs natives custom)

```bash
# Build dev client
eas build --profile development --platform ios
eas build --profile development --platform android

# Installer le .ipa/.apk généré sur device/simulateur

# Lancer metro bundler
npx expo start --dev-client
```

---

## Structure du Projet

```
mobile-app/
├── app/                          # Routes Expo Router (file-based routing)
│   ├── (tabs)/                   # Tab navigation (home, live, tournois, etc.)
│   │   ├── index.tsx             # Home screen
│   │   ├── live.tsx              # Live matches
│   │   ├── tournois.tsx          # Tournaments listing
│   │   ├── calendrier.tsx        # Calendar
│   │   └── profile.tsx           # User profile
│   ├── auth/                     # Auth screens
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── article/
│   │   └── [slug].tsx            # Article detail (dynamic route)
│   ├── tournament/
│   │   └── [id].tsx              # Tournament detail
│   ├── match/
│   │   └── [id].tsx              # Match detail
│   ├── _layout.tsx               # Root layout avec providers
│   └── +not-found.tsx            # 404 screen
│
├── components/                   # Composants réutilisables
│   ├── ui/                       # UI primitives (Button, Card, Badge, etc.)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── BottomSheet.tsx
│   │   └── Skeleton.tsx
│   ├── layout/                   # Layout components
│   │   ├── Header.tsx
│   │   ├── TabBar.tsx
│   │   └── SafeArea.tsx
│   ├── games/                    # Game-related components
│   │   ├── GameSelector.tsx      # Horizontal FlatList
│   │   └── GameCard.tsx
│   ├── matches/                  # Match components
│   │   ├── LiveMatchCard.tsx
│   │   ├── MatchCard.tsx
│   │   └── LiveBadge.tsx
│   ├── tournaments/              # Tournament components
│   │   ├── TournamentCard.tsx
│   │   ├── TournamentFilters.tsx
│   │   └── BracketDisplay.tsx    # SVG bracket (react-native-svg)
│   ├── articles/                 # Article components
│   │   ├── ArticleCard.tsx
│   │   ├── FeaturedArticle.tsx
│   │   └── ArticleContent.tsx    # HTML renderer
│   ├── ads/
│   │   └── AdBanner.tsx
│   ├── profile/
│   │   ├── ProfileHeader.tsx
│   │   ├── FavoriteTeamsSection.tsx
│   │   └── NotificationsSection.tsx
│   └── calendar/
│       └── Calendar.tsx
│
├── services/                     # API clients (layer service)
│   ├── authService.ts            # Login, signup, getMe
│   ├── gameService.ts            # Games CRUD
│   ├── liveMatchService.ts       # Live matches (SportDevs)
│   ├── tournamentService.ts      # Tournaments (PandaScore)
│   ├── matchService.ts           # Matches
│   ├── articleService.ts         # Articles & news
│   ├── advertisementService.ts   # Ads
│   ├── userService.ts            # User profile
│   ├── teamService.ts            # Teams
│   └── subscriptionService.ts    # Stripe payments
│
├── contexts/                     # React Contexts (state global)
│   ├── AuthContext.tsx           # User auth state
│   ├── GameContext.tsx           # Selected game state
│   └── PreferencesContext.tsx    # Language, theme
│
├── hooks/                        # Custom hooks
│   ├── useDimensions.ts          # Screen dimensions
│   ├── useKeyboard.ts            # Keyboard visibility
│   ├── useSafeArea.ts            # Safe area insets
│   └── useAuth.ts                # Auth context hook
│
├── types/                        # TypeScript types
│   └── index.ts                  # Tous les types (Game, Match, Article, etc.)
│
├── constants/                    # Constantes & config
│   ├── config.ts                 # API URLs, env vars
│   ├── theme.ts                  # Theme tokens (colors, spacing)
│   ├── colors.ts                 # Palette complète
│   └── games.ts                  # Liste des 10 jeux
│
├── utils/                        # Fonctions utilitaires
│   ├── formatters.ts             # Date, currency formatting
│   ├── validators.ts             # Form validation
│   ├── storage.ts                # AsyncStorage wrappers
│   └── linking.ts                # Deep linking helpers
│
├── assets/                       # Assets statiques
│   ├── images/                   # PNG, JPG, WebP
│   │   ├── logo-dark.png
│   │   ├── logo-light.png
│   │   └── splash.png
│   ├── fonts/                    # Custom fonts (si besoin)
│   └── animations/               # Lottie JSON (optionnel)
│
├── locales/                      # Fichiers i18n
│   ├── fr.json
│   ├── en.json
│   ├── es.json
│   ├── de.json
│   └── it.json
│
├── app.json                      # Config Expo (nom app, version, permissions)
├── app.config.ts                 # Config dynamique Expo (env vars)
├── babel.config.js               # Babel avec Reanimated plugin
├── metro.config.js               # Metro bundler config
├── tsconfig.json                 # TypeScript config
├── eas.json                      # EAS Build profiles (dev, preview, prod)
├── package.json                  # Dependencies
└── .env                          # Variables d'environnement (gitignored)
```

### Conventions de Nommage

- **Fichiers composants** : PascalCase (`GameCard.tsx`)
- **Fichiers hooks** : camelCase avec `use` prefix (`useAuth.ts`)
- **Fichiers services** : camelCase avec `Service` suffix (`gameService.ts`)
- **Fichiers types** : PascalCase pour types, `index.ts` pour exports
- **Routes Expo** : kebab-case ou `[param]` pour dynamique

---

## Configuration

### `app.json` / `app.config.ts`

Configuration principale de l'app Expo :

```javascript
// app.config.ts
export default {
  expo: {
    name: "Esport News",
    slug: "esportnews",
    version: "1.0.0",
    scheme: "esportnews", // Deep linking
    platforms: ["ios", "android"],
    icon: "./assets/images/icon.png",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#060B13" // Couleur primaire
    },
    ios: {
      bundleIdentifier: "com.esportnews.app",
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription: "Upload profile picture",
        NSPhotoLibraryUsageDescription: "Select profile picture",
      }
    },
    android: {
      package: "com.esportnews.app",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#060B13"
      },
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "NOTIFICATIONS"
      ]
    },
    plugins: [
      "expo-router",
      "expo-notifications",
      "expo-secure-store",
      "@stripe/stripe-react-native",
      [
        "expo-build-properties",
        {
          ios: { newArchEnabled: true },
          android: { newArchEnabled: true }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "votre-project-id-eas"
      },
      backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL
    }
  }
}
```

### `eas.json`

Configuration des builds EAS :

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "https://api.esportnews.com"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "votre-apple-id@email.com",
        "ascAppId": "123456789",
        "appleTeamId": "ABCDEFG123"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

---

## Développement

### Commandes Principales

```bash
# Lancer dev server (Expo Go)
npm start

# Lancer avec cache clear
npm start --clear

# Build dev client local
npx expo run:ios
npx expo run:android

# Linter + formatter
npm run lint
npm run format

# Type checking
npm run type-check

# Tests
npm test
npm run test:watch
```

### Développement iOS

```bash
# Ouvrir iOS Simulator
open -a Simulator

# Build iOS local (sans EAS)
npx expo run:ios --device "iPhone 15 Pro"

# Build avec EAS
eas build --platform ios --profile development
```

### Développement Android

```bash
# Lister emulators disponibles
emulator -list-avds

# Lancer emulator
emulator -avd Pixel_7_API_33

# Build Android local
npx expo run:android

# Build avec EAS
eas build --platform android --profile development
```

### Hot Reload & Fast Refresh

- **Fast Refresh** : Auto-activé, preserve React state
- **Cache clearing** : Secouer device → "Reload" ou `Cmd+R` (iOS) / `RR` (Android)

### Debugging

#### React DevTools

```bash
# Ouvrir React DevTools standalone
npx react-devtools
```

Dans l'app : Secouer → "Open React DevTools"

#### Flipper (optionnel, pour dev builds)

```bash
brew install --cask flipper
```

Connecter l'app → Network inspector, Logs, Async Storage viewer

#### Logs

```bash
# Tous les logs
npx expo start

# iOS logs seulement
npx expo start --ios

# Android logs
npx expo start --android

# Filtrer logs backend
npx expo start | grep "Backend API"
```

---

## Design System

### Palette de Couleurs

Définie dans `/constants/colors.ts` :

```typescript
export const Colors = {
  // Palette primaire (issue de CLAUDE.md)
  primary900: '#060B13',
  primary800: '#091626',
  primary600: '#182859',
  accent: '#F22E62',

  // Tokens sémantiques (Light mode)
  light: {
    text: {
      primary: '#1F2937',     // Gray 800
      secondary: '#6B7280',   // Gray 500
      muted: '#9CA3AF',       // Gray 400
      inverted: '#FFFFFF',
    },
    background: {
      primary: '#FFFFFF',
      secondary: '#F9FAFB',   // Gray 50
      tertiary: '#F3F4F6',    // Gray 100
      card: '#FFFFFF',
    },
    border: {
      primary: '#E5E7EB',     // Gray 200
      secondary: '#D1D5DB',   // Gray 300
      accent: '#F22E62',
    },
  },

  // Tokens sémantiques (Dark mode - default)
  dark: {
    text: {
      primary: '#F9FAFB',     // Gray 50
      secondary: '#D1D5DB',   // Gray 300
      muted: '#9CA3AF',       // Gray 400
      inverted: '#1F2937',
    },
    background: {
      primary: '#060B13',
      secondary: '#091626',
      tertiary: '#182859',
      card: '#0F1729',
    },
    border: {
      primary: '#1F2937',
      secondary: '#374151',
      accent: '#F22E62',
    },
  },

  // Status colors
  status: {
    live: '#FF4444',
    upcoming: '#FBBF24',
    finished: '#6B7280',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  },

  // Tournament tiers
  tier: {
    s: '#FBBF24',  // Gold
    a: '#C0C0C0',  // Silver
    b: '#CD7F32',  // Bronze
    c: '#8B7355',  // Brown
    d: '#6B7280',  // Gray
  },
};
```

### Thème Global

Défini dans `/constants/theme.ts` :

```typescript
export const theme = {
  colors: Colors,

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },

  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      bold: 'System',
      // OU custom fonts si importées via expo-google-fonts
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1, // Android
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
  },
};
```

### Utilisation dans Composants

```typescript
import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.dark.background.primary,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.md,
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text.primary,
  },
});
```

---

## Navigation & Routing

### Expo Router v4

Expo Router utilise le **file-based routing** (comme Next.js App Router) :

```
app/
├── (tabs)/              # Group de routes avec bottom tabs
│   ├── _layout.tsx      # Layout tabs (navigation)
│   ├── index.tsx        # → Tab "Home" (/)
│   ├── live.tsx         # → Tab "Live" (/live)
│   ├── tournois.tsx     # → Tab "Tournois" (/tournois)
│   ├── calendrier.tsx   # → Tab "Calendrier" (/calendrier)
│   └── profile.tsx      # → Tab "Profil" (/profile)
│
├── auth/
│   ├── login.tsx        # → /auth/login
│   └── register.tsx     # → /auth/register
│
├── article/
│   └── [slug].tsx       # → /article/valorant-champions-2024 (dynamic)
│
├── tournament/
│   └── [id].tsx         # → /tournament/12345
│
├── match/
│   └── [id].tsx         # → /match/67890
│
├── admin/               # Routes protégées
│   ├── _layout.tsx      # Layout admin (avec check auth)
│   ├── index.tsx        # → /admin
│   └── articles/
│       ├── index.tsx    # → /admin/articles
│       ├── new.tsx      # → /admin/articles/new
│       └── [id]/
│           └── edit.tsx # → /admin/articles/123/edit
│
├── _layout.tsx          # Root layout (providers)
└── +not-found.tsx       # 404
```

### Navigation Programmatique

```typescript
import { useRouter, useLocalSearchParams } from 'expo-router';

const MyComponent = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams(); // Params dynamiques

  const goToTournament = (tournamentId: number) => {
    router.push(`/tournament/${tournamentId}`);
  };

  const goBack = () => {
    router.back();
  };

  return (
    <Button onPress={() => goToTournament(123)}>
      View Tournament
    </Button>
  );
};
```

### Deep Linking

Configuration dans `app.config.ts` :

```typescript
{
  scheme: "esportnews",
  // URLs supportées :
  // esportnews://article/slug
  // esportnews://tournament/123
  // https://esportnews.com/article/slug (universal links)
}
```

Utilisation :

```typescript
import * as Linking from 'expo-linking';

// Ouvrir URL externe (stream)
Linking.openURL('https://twitch.tv/valorant');

// Écouter deep links entrants
Linking.addEventListener('url', (event) => {
  const { path, queryParams } = Linking.parse(event.url);
  // Naviguer vers la route appropriée
  router.push(path);
});
```

---

## Gestion d'État

### Context API

Trois contextes principaux (identiques à la web app) :

#### AuthContext

```typescript
// contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '@/services/authService';

interface AuthContextType {
  user: UserData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Auto-login on mount
    const initAuth = async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        try {
          const userData = await authService.getMe(token);
          setUser(userData);
        } catch (error) {
          await AsyncStorage.removeItem('authToken');
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const { access_token, user } = await authService.login({ email, password });
    await AsyncStorage.setItem('authToken', access_token);
    setUser(user);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('authToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      signup,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

#### GameContext

```typescript
// contexts/GameContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gameService } from '@/services/gameService';

interface GameContextType {
  games: Game[];
  selectedGame: string | null;
  isLoadingGames: boolean;
  setSelectedGame: (gameId: string | null) => void;
  getSelectedGameData: () => Game | null;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: React.ReactNode }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGameState] = useState<string | null>(null);
  const [isLoadingGames, setIsLoadingGames] = useState(true);

  useEffect(() => {
    // Charger jeux + sélection persistée
    const loadGames = async () => {
      const gamesData = await gameService.getGames();
      setGames(gamesData);

      const saved = await AsyncStorage.getItem('selectedGame');
      setSelectedGameState(saved);

      setIsLoadingGames(false);
    };
    loadGames();
  }, []);

  const setSelectedGame = async (gameId: string | null) => {
    setSelectedGameState(gameId);
    if (gameId) {
      await AsyncStorage.setItem('selectedGame', gameId);
    } else {
      await AsyncStorage.removeItem('selectedGame');
    }
  };

  return (
    <GameContext.Provider value={{
      games,
      selectedGame,
      isLoadingGames,
      setSelectedGame,
      getSelectedGameData: () => games.find(g => g.id === selectedGame) || null,
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider');
  return context;
};
```

#### PreferencesContext

```typescript
// contexts/PreferencesContext.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { useTranslation } from 'react-i18next';

type Language = 'fr' | 'en' | 'es' | 'de' | 'it';
type Theme = 'light' | 'dark' | 'auto';

interface PreferencesContextType {
  language: Language;
  theme: Theme;
  updateLanguage: (lang: Language) => void;
  updateTheme: (theme: Theme) => void;
  isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState<Language>('fr');
  const [theme, setTheme] = useState<Theme>('auto');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Charger préférences depuis AsyncStorage
    const loadPreferences = async () => {
      const savedLang = await AsyncStorage.getItem('language');
      const savedTheme = await AsyncStorage.getItem('theme');

      if (savedLang) {
        setLanguage(savedLang as Language);
        i18n.changeLanguage(savedLang);
      }
      if (savedTheme) setTheme(savedTheme as Theme);

      setIsLoading(false);
    };
    loadPreferences();
  }, []);

  // Écouter changements système pour mode auto
  useEffect(() => {
    if (theme === 'auto') {
      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        // Apply system theme
      });
      return () => subscription.remove();
    }
  }, [theme]);

  const updateLanguage = async (lang: Language) => {
    setLanguage(lang);
    await AsyncStorage.setItem('language', lang);
    i18n.changeLanguage(lang);
  };

  const updateTheme = async (newTheme: Theme) => {
    setTheme(newTheme);
    await AsyncStorage.setItem('theme', newTheme);
  };

  return (
    <PreferencesContext.Provider value={{
      language,
      theme,
      updateLanguage,
      updateTheme,
      isLoading,
    }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider');
  return context;
};
```

### Root Layout (Providers)

```typescript
// app/_layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';
import { GameProvider } from '@/contexts/GameContext';
import { PreferencesProvider } from '@/contexts/PreferencesContext';
import { Slot } from 'expo-router';
import '@/locales/i18n'; // Init i18n

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <GameProvider>
          <Slot />
        </GameProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}
```

---

## API & Services

### Configuration

```typescript
// constants/config.ts
import Constants from 'expo-constants';

export const config = {
  backendUrl: Constants.expoConfig?.extra?.backendUrl || 'http://localhost:4000',
  stripePublicKey: process.env.EXPO_PUBLIC_STRIPE_PUBLIC_KEY,
  firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
};
```

### Service Pattern

Tous les services suivent le même pattern (identique à la web app) :

```typescript
// services/gameService.ts
import { config } from '@/constants/config';
import { Game } from '@/types';

class GameService {
  private baseUrl = config.backendUrl;

  async getGames(): Promise<Game[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/games`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('GameService.getGames error:', error);
      throw error;
    }
  }

  async getGameById(id: number): Promise<Game> {
    const response = await fetch(`${this.baseUrl}/api/games/${id}`);
    if (!response.ok) throw new Error(`Game ${id} not found`);
    return response.json();
  }

  async getGameByAcronym(acronym: string): Promise<Game> {
    const response = await fetch(`${this.baseUrl}/api/games/acronym/${acronym}`);
    if (!response.ok) throw new Error(`Game ${acronym} not found`);
    return response.json();
  }
}

export const gameService = new GameService();
```

### AuthService avec Token Management

```typescript
// services/authService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/constants/config';

class AuthService {
  private baseUrl = config.backendUrl;

  async login(data: { email: string; password: string }) {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    return response.json(); // { access_token, user }
  }

  async getMe(token: string) {
    const response = await fetch(`${this.baseUrl}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Failed to get user');
    return response.json();
  }

  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem('authToken');
  }

  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem('authToken', token);
  }

  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem('authToken');
  }
}

export const authService = new AuthService();
```

### Utilisation dans Composants

```typescript
import { useEffect, useState } from 'react';
import { tournamentService } from '@/services/tournamentService';
import { useGame } from '@/contexts/GameContext';

const TournamentsScreen = () => {
  const { selectedGame } = useGame();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTournaments = async () => {
      setLoading(true);
      try {
        const data = await tournamentService.getTournaments({
          game: selectedGame?.acronym,
          sort: 'tier',
        });
        setTournaments(data);
      } catch (error) {
        console.error('Error fetching tournaments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, [selectedGame]);

  return (
    // JSX...
  );
};
```

---

## Internationalisation

### Setup i18next

```bash
npm install react-i18next i18next
```

Configuration :

```typescript
// locales/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import fr from './fr.json';
import en from './en.json';
import es from './es.json';
import de from './de.json';
import it from './it.json';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
  it: { translation: it },
};

const initI18n = async () => {
  const savedLanguage = await AsyncStorage.getItem('language');

  i18n
    .use(initReactI18next)
    .init({
      compatibilityJSON: 'v3',
      resources,
      lng: savedLanguage || 'fr',
      fallbackLng: 'fr',
      interpolation: {
        escapeValue: false,
      },
    });
};

initI18n();

export default i18n;
```

### Utilisation

```typescript
import { useTranslation } from 'react-i18next';

const HomeScreen = () => {
  const { t } = useTranslation();

  return (
    <View>
      <Text>{t('layout.navbar.accueil')}</Text>
      <Text>{t('home.live_matches.title')}</Text>
    </View>
  );
};
```

### Changer de Langue

```typescript
import { useTranslation } from 'react-i18next';
import { usePreferences } from '@/contexts/PreferencesContext';

const LanguageSelector = () => {
  const { i18n } = useTranslation();
  const { updateLanguage } = usePreferences();

  const changeLanguage = (lang: 'fr' | 'en' | 'es' | 'de' | 'it') => {
    i18n.changeLanguage(lang);
    updateLanguage(lang);
  };

  return (
    <Select onValueChange={changeLanguage}>
      <Option value="fr">Français</Option>
      <Option value="en">English</Option>
      {/* etc */}
    </Select>
  );
};
```

---

## Authentification

### Flow Complet

1. **User clique "Login"** → Navigation vers `/auth/login`
2. **Formulaire soumis** → `authService.login({ email, password })`
3. **Backend retourne** `{ access_token, user }`
4. **Service stocke token** → `AsyncStorage.setItem('authToken', token)`
5. **Context met à jour state** → `setUser(user)`
6. **Redirection** → `router.replace('/profile')`

### Protected Routes

```typescript
// app/admin/_layout.tsx
import { useAuth } from '@/contexts/AuthContext';
import { Redirect, Slot } from 'expo-router';

export default function AdminLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !user?.admin) {
    return <Redirect href="/auth/login" />;
  }

  return <Slot />;
}
```

### Biométrie (Optionnel)

```bash
npm install expo-local-authentication
```

Implémentation :

```typescript
import * as LocalAuthentication from 'expo-local-authentication';

const LoginScreen = () => {
  const { login } = useAuth();

  const handleBiometricLogin = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to login',
      });

      if (result.success) {
        // Récupérer credentials stockés en SecureStore
        const savedEmail = await SecureStore.getItemAsync('user_email');
        const savedPassword = await SecureStore.getItemAsync('user_password');

        if (savedEmail && savedPassword) {
          await login(savedEmail, savedPassword);
        }
      }
    }
  };

  return (
    <View>
      <Button onPress={handleBiometricLogin}>
        Login with Face ID / Touch ID
      </Button>
    </View>
  );
};
```

---

## Notifications Push

### Firebase Setup

1. **Créer projet Firebase** sur [console.firebase.google.com](https://console.firebase.google.com)
2. **Ajouter apps iOS + Android**
3. **Télécharger** :
   - `GoogleService-Info.plist` (iOS)
   - `google-services.json` (Android)

### Installation

```bash
npm install expo-notifications firebase
npx expo install expo-device expo-constants
```

### Configuration

```typescript
// utils/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export async function registerForPushNotificationsAsync() {
  let token;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;
  } else {
    alert('Must use physical device for Push Notifications');
  }

  // Android channel (requis Android 8+)
  if (Device.osName === 'Android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}
```

### Écouter Notifications

```typescript
// app/_layout.tsx (root layout)
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

export default function RootLayout() {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Enregistrer token
    registerForPushNotificationsAsync().then(token => {
      // Envoyer token au backend
      if (token) {
        userService.updatePushToken(token);
      }
    });

    // Notification reçue pendant app ouverte
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // User a tapé sur la notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const { data } = response.notification.request.content;

      // Navigation selon type
      if (data.type === 'match') {
        router.push(`/match/${data.match_id}`);
      } else if (data.type === 'article') {
        router.push(`/article/${data.article_slug}`);
      }
    });

    return () => {
      notificationListener.current && Notifications.removeNotificationSubscription(notificationListener.current);
      responseListener.current && Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return <Slot />;
}
```

### Préférences Notifications (UI)

```typescript
// components/profile/NotificationsSection.tsx
const NotificationsSection = () => {
  const { user } = useAuth();
  const [notifPush, setNotifPush] = useState(user?.notifi_push || false);
  const [notifArticles, setNotifArticles] = useState(user?.notif_articles || false);
  const [notifNews, setNotifNews] = useState(user?.notif_news || false);
  const [notifMatchs, setNotifMatchs] = useState(user?.notif_matchs || false);

  const handleToggle = async (key: string, value: boolean) => {
    // Update backend
    await userService.updateNotificationPreferences({ [key]: value });

    // Update local state
    switch(key) {
      case 'notifi_push': setNotifPush(value); break;
      case 'notif_articles': setNotifArticles(value); break;
      // etc...
    }
  };

  return (
    <View>
      <Switch value={notifPush} onValueChange={(val) => handleToggle('notifi_push', val)} />
      <Text>Push Notifications</Text>

      <Switch value={notifArticles} onValueChange={(val) => handleToggle('notif_articles', val)} />
      <Text>Nouveaux Articles</Text>

      {/* etc */}
    </View>
  );
};
```

---

## Déploiement

### EAS Build

#### 1. Login EAS

```bash
npx eas login
```

#### 2. Configurer Projet

```bash
npx eas build:configure
```

Générera `eas.json` (déjà fourni dans ce projet).

#### 3. Build Development

Pour tester sur devices physiques :

```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android

# Les deux
eas build --profile development --platform all
```

Installer le `.ipa` (iOS) ou `.apk` (Android) généré sur vos devices de test.

#### 4. Build Preview (Internal Testing)

```bash
eas build --profile preview --platform all
```

Distribuer via TestFlight (iOS) ou Internal Testing (Android).

#### 5. Build Production

```bash
eas build --profile production --platform all
```

### Submission aux Stores

#### App Store (iOS)

```bash
eas submit --platform ios
```

**Prérequis** :
- Compte Apple Developer ($99/an)
- App Store Connect app crééec

- Certificates + Provisioning profiles (EAS gère automatiquement)

**Checklist** :
- Screenshots (6.7", 6.5", 5.5" iPhones + iPad optionnel)
- Description (5 langues)
- Keywords
- Privacy Policy URL
- Support URL
- Age rating

#### Google Play (Android)

```bash
eas submit --platform android
```

**Prérequis** :
- Compte Google Play Console ($25 one-time)
- Service account key JSON (pour EAS)

**Checklist** :
- Screenshots (phone + tablet optionnel)
- Feature graphic (1024x500)
- Description (5 langues)
- Privacy Policy URL
- Content rating questionnaire

### CI/CD avec EAS

Exemple GitHub Actions (`.github/workflows/eas-build.yml`) :

```yaml
name: EAS Build

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Build on EAS
        run: eas build --platform all --non-interactive --profile production
```

---

## Troubleshooting

### Problèmes Courants

#### 1. "Unable to resolve module..." (Metro bundler)

**Solution** :
```bash
# Clear cache
npx expo start --clear

# Si persistant, supprimer node_modules
rm -rf node_modules
npm install
```

#### 2. AsyncStorage deprecated warnings

**Solution** :
```bash
# Installer package officiel
npm install @react-native-async-storage/async-storage

# Remplacer imports
- import AsyncStorage from 'react-native';
+ import AsyncStorage from '@react-native-async-storage/async-storage';
```

#### 3. Images ne chargent pas (remote URLs)

**Cause** : iOS App Transport Security (ATS) bloque HTTP.

**Solution** :
```typescript
// app.config.ts (iOS)
ios: {
  infoPlist: {
    NSAppTransportSecurity: {
      NSAllowsArbitraryLoads: true, // ⚠️ Dev seulement
      // OU whitelist domaines :
      NSExceptionDomains: {
        'cdn.pandascore.co': {
          NSExceptionAllowsInsecureHTTPLoads: true,
        },
      },
    },
  },
}
```

#### 4. Animations saccadées (Reanimated)

**Solution** :
```javascript
// babel.config.js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // ⚠️ Doit être en DERNIER
    ],
  };
};
```

Puis rebuild :
```bash
npx expo start --clear
```

#### 5. Backend API not reachable depuis device

**Cause** : `localhost` ne fonctionne pas sur device physique.

**Solution** :
```typescript
// constants/config.ts
export const config = {
  // Utiliser IP local machine au lieu de localhost
  backendUrl: __DEV__
    ? 'http://192.168.1.100:4000' // Remplacer par votre IP
    : 'https://api.esportnews.com',
};
```

Trouver votre IP :
```bash
# macOS/Linux
ifconfig | grep "inet "

# Windows
ipconfig
```

#### 6. Build EAS échoue (iOS)

**Erreur** : "Missing certificates"

**Solution** :
```bash
# Laisser EAS gérer les certificates
eas credentials

# Ou régénérer automatiquement
eas build --platform ios --clear-credentials
```

#### 7. Push notifications ne fonctionnent pas

**Checklist** :
- ✅ Device physique (simulateur ne supporte pas push)
- ✅ Permissions accordées (`Notifications.getPermissionsAsync()`)
- ✅ Token Expo Push généré et envoyé au backend
- ✅ Firebase projet configuré (iOS + Android apps)
- ✅ `GoogleService-Info.plist` + `google-services.json` ajoutés

---

## Contribution

### Workflow Git

1. **Créer branche feature** :
   ```bash
   git checkout -b feat/nom-feature
   ```

2. **Commit conventionnel** :
   ```bash
   git commit -m "feat: add tournament filters"
   git commit -m "fix: live match card layout on Android"
   git commit -m "docs: update README installation steps"
   ```

3. **Push et PR** :
   ```bash
   git push origin feat/nom-feature
   # Créer Pull Request sur GitHub
   ```

### Conventions de Code

- **Linter** : ESLint avec config Expo
- **Formatter** : Prettier
- **Pre-commit hook** : Husky + lint-staged

```bash
# Vérifier code avant commit
npm run lint
npm run format

# Fix auto
npm run lint:fix
```

### Tests

```bash
# Unit tests
npm test

# Coverage
npm run test:coverage

# E2E tests (Detox)
npm run test:e2e:ios
npm run test:e2e:android
```

---

## Ressources Utiles

### Documentation Officielle
- [Expo Docs](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [Expo Router](https://expo.github.io/router/docs/)
- [React Navigation](https://reactnavigation.org/)

### Backend & APIs
- [Backend Go README](../backend-go/README.md)
- [PandaScore API Docs](https://developers.pandascore.co/)
- [SportDevs API](https://sportdevs.com/docs)

### Design & UI
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [Reanimated Docs](https://docs.swmansion.com/react-native-reanimated/)
- [Figma Designs](lien-vers-figma-si-applicable)

### Community
- [Expo Discord](https://chat.expo.dev/)
- [React Native Discord](https://discord.gg/reactnative)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/expo)

---

## Licence

**Propriétaire** - © 2025 Esport News. Tous droits réservés.

---

## Support & Contact

- **Email** : support@esportnews.com
- **Discord** : [Lien serveur Discord]
- **Issues** : [GitHub Issues](https://github.com/votre-org/esportnews/issues)

---

**Version** : 1.0.0
**Dernière mise à jour** : 2025-12-18
**Auteur** : Équipe Esport News
