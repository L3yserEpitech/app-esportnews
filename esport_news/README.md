# Esport News - Application Flutter

> **Application web et mobile** qui centralise les résultats en direct, les actualités, les tournois à venir et les flux live des plus grands jeux eSport comme CS2, Dota 2 ou Valorant.

## 📋 Vue d'ensemble des Pages

Cette application Flutter comprend **15 pages principales**, chacune avec des fonctionnalités spécifiques pour offrir une expérience complète aux fans d'esports.

---

## 🏠 **Page d'Accueil** (`/home`)
**Fichier**: `lib/pages/home/home_widget.dart`

### Fonctionnalités principales :
- **Tableau de bord principal** avec les informations essentielles
- **Authentification automatique** au chargement de la page
- **Récupération des données utilisateur** (email, nom, photo, statut admin)
- **Affichage des équipes** disponibles via l'API Pandascore
- **Événements en direct** et à venir
- **Actualités esports** en temps réel
- **Interface responsive** (mobile et desktop)

### Données affichées :
- Matches live en cours
- Prochains événements importants
- Articles d'actualités récents
- Sélection des jeux favoris

---

## 🔐 **Page de Connexion** (`/login`)
**Fichier**: `lib/pages/login/login_widget.dart`

### Fonctionnalités principales :
- **Formulaire de connexion** avec email et mot de passe
- **Interface responsive** avec versions mobile et desktop
- **Gestion des erreurs** d'authentification
- **Navigation automatique** vers l'accueil après connexion réussie

### Champs requis :
- Adresse email
- Mot de passe

---

## ✍️ **Page d'Inscription** (`/signUp`)
**Fichier**: `lib/pages/sign_up/sign_up_widget.dart`

### Fonctionnalités principales :
- **Création de compte utilisateur**
- **Validation des mots de passe** (confirmation requise)
- **Gestion des tokens d'authentification**
- **Interface responsive** pour mobile et desktop
- **Redirection automatique** vers l'accueil après inscription

### Champs du formulaire :
- Nom d'utilisateur
- Adresse email
- Mot de passe
- Confirmation du mot de passe

### API utilisées :
- `SignupCall` - Création du compte
- `AuthToUserCall` - Authentification utilisateur

---

## 📰 **Page des Articles** (`/article`)
**Fichier**: `lib/pages/articles_page/articles_page_widget.dart`

### Fonctionnalités principales :
- **Liste des articles d'actualités esports**
- **Chargement automatique** des articles via Firebase Cloud Functions
- **Interface responsive** avec composants PC et mobile
- **Intégration publicitaire**

### Données affichées :
- Articles d'actualités esports
- Images d'accompagnement
- Dates de publication
- Sources des informations

### API utilisées :
- `getArticles` (Firebase Cloud Function)

---

## 📅 **Page Calendrier** (`/calendar`)
**Fichier**: `lib/pages/calendar/calendar_widget.dart`

### Fonctionnalités principales :
- **Calendrier interactif** des événements esports
- **Filtrage par jeu** (CS2, Dota2, LoL, FIFA, etc.)
- **Filtrage par équipe favorite**
- **Vue mobile et desktop** différenciées
- **Sélection de dates** pour voir les événements spécifiques

### Fonctionnalités de filtrage :
- Filtre par tier (niveau de compétition)
- Filtre par région géographique
- Recherche par équipe
- Sélection de jeux spécifiques

### API utilisées :
- `getEventsByDate` (Firebase Cloud Function)
- `getTournamentsByDate` (Firebase Cloud Function)

---

## 🏆 **Page Tournois** (`/tournament`)
**Fichier**: `lib/pages/tournament/tournament_widget.dart`

### Fonctionnalités principales :
- **Liste des tournois en cours**
- **Filtrage par jeu sélectionné** dans les préférences
- **Filtrage par équipe favorite**
- **Interface avec onglets** pour différentes catégories
- **Navigation vers les détails des événements**

### Catégories d'événements :
- Tournois en cours
- Tournois à venir
- Tournois terminés

### API utilisées :
- `getRunningEvents` (Firebase Cloud Function)
- `getUpcomingAllEvent` (Firebase Cloud Function)
- `getPastEvents` (Firebase Cloud Function)

---

## 📱 **Page Événements Mobile** (`/eventMobilePage`)
**Fichier**: `lib/pages/event_mobile_page/event_mobile_page_widget.dart`

### Fonctionnalités principales :
- **Version mobile optimisée** de la page tournois
- **Interface à 3 onglets** : "En cours", "À venir", "Passés"
- **Cartes visuelles** avec images de fond
- **Navigation vers les détails** des événements
- **Filtrage automatique** selon les préférences

### Affichage des événements :
- Images de fond attrayantes
- Informations overlay (dates, équipes)
- Statut des événements
- Liens vers les détails

---

## 🎯 **Page Événement Unique** (`/uniqueEvent`)
**Fichier**: `lib/pages/unique_event/unique_event_widget.dart`

### Fonctionnalités principales :
- **Vue détaillée d'un événement** spécifique
- **Interface à 2 onglets** : "Matches" et "Équipes"
- **Liste des matches** avec navigation vers les détails
- **Liste des équipes participantes**
- **Accès aux streams** en direct
- **Informations complètes** (dates, ligue, jeu)

### Informations affichées :
- Nom de l'événement
- Dates de début et fin
- Type de jeu
- Ligue organisatrice
- Matches programmés
- Équipes participantes

---

## ⚔️ **Page Match Unique** (`/uniqueMatch`)
**Fichier**: `lib/pages/unique_match/unique_match_widget.dart`

### Fonctionnalités principales :
- **Détails complets d'un match**
- **Interface à 2 onglets** : "Jeu" et "Stream"
- **Résultats détaillés** par round/game
- **Liste des streams disponibles**
- **Scores en temps réel**

### Données du match :
- Équipes en confrontation
- Scores détaillés
- Informations sur chaque round
- Liens vers les streams
- Statut du match (en cours, terminé)

### API utilisées :
- `getMatchById` (Firebase Cloud Function)

---

## 📺 **Page Streams** (`/streamPage`)
**Fichier**: `lib/pages/stream_page/stream_page_widget.dart`

### Fonctionnalités principales :
- **Liste des streams disponibles** pour un événement
- **Boutons numérotés** pour chaque stream
- **Lancement des URLs externes** des streams
- **Interface mobile optimisée**

### Utilisation :
- Reçoit la liste des streams en paramètre
- Affichage simple avec navigation
- Redirection vers les plateformes de streaming

---

## 👤 **Page Profil** (`/profil`)
**Fichier**: `lib/pages/profil/profil_widget.dart`

### Fonctionnalités principales :
- **Gestion du profil utilisateur**
- **Authentification requise** (redirection si non connecté)
- **Édition des informations** (nom, email, mot de passe)
- **Sélection de l'équipe favorite**
- **Upload de photo de profil**
- **Sélecteur de langue**
- **Interface à onglets**

### Paramètres modifiables :
- Informations personnelles
- Photo de profil
- Équipe favorite
- Préférences linguistiques
- Thème d'affichage

### API utilisées :
- Appels API profil utilisateur
- Fonctionnalité de recherche d'équipes

---

## ⚙️ **Page Paramètres** (`/settingsPage`)
**Fichier**: `lib/pages/settings_page/settings_page_widget.dart`

### Fonctionnalités principales :
- **Navigation vers les préférences**
- **Interface mobile minimaliste**
- **Bouton retour** pour la navigation

### Utilisation :
- Point d'entrée vers les paramètres détaillés
- Design épuré et intuitif

---

## 🔧 **Page Préférences** (`/preferenceSettings`)
**Fichier**: `lib/pages/preference_settings/preference_settings_widget.dart`

### Fonctionnalités principales :
- **Sélecteur de langue** pour l'internationalisation
- **Basculement thème** sombre/clair
- **Interface mobile uniquement**
- **Paramètres d'affichage**

### Options disponibles :
- Choix de la langue d'affichage
- Mode sombre/clair
- Préférences d'affichage

---

## 📄 **Page Actualités** (`/newsPage`)
**Fichier**: `lib/pages/news_page/news_page_widget.dart`

### Fonctionnalités principales :
- **Page d'actualités pour desktop**
- **Interface en cours de développement**
- **Navigation PC uniquement**

### Statut :
- Template de base implémenté
- Fonctionnalités à développer

---

## 🛠️ Architecture Technique

### **Technologies utilisées :**
- **Flutter/Dart** - Framework principal
- **Firebase Cloud Functions** - Backend serverless
- **FlutterFlow** - Générateur de code UI
- **Provider** - Gestion d'état
- **Google Fonts** - Typographie
- **Responsive Design** - Mobile et Desktop

### **API Externes :**
- **Pandascore API** - Données esports (équipes, matches)
- **Firebase Functions** - Cloud functions personnalisées
- **APIs de Streaming** - Intégration des plateformes live

### **Fonctionnalités transversales :**
- Authentification utilisateur complète
- Gestion des préférences (jeux, équipes)
- Interface responsive adaptative
- Internationalisation multi-langues
- Thèmes sombre/clair
- Navigation cohérente entre les pages

---

## 📊 Flux de Données

### **État Global (FFAppState) :**
- Informations utilisateur (email, nom, photo, statut)
- Préférences de jeux (CS, LoL, Dota, FIFA, NBA)
- Équipe sélectionnée et favoris
- Listes d'articles et d'événements
- Paramètres d'affichage

### **Stockage Sécurisé :**
- Tokens d'authentification
- Préférences utilisateur persistantes
- Données de session utilisateur

---

## 🚀 Getting Started

FlutterFlow projects are built to run on the Flutter _stable_ release.

Cette documentation couvre l'ensemble des fonctionnalités de l'application Esport News, offrant une expérience complète pour suivre l'actualité et les événements esports en temps réel.