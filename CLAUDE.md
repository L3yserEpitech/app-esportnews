# CLAUDE.md — Maquette (squelette)

> Ce document sert de source unique de vérité pour cadrer le produit, la DA, la structure du site et les exigences techniques. Il doit rester court par section, mais exhaustif par les rubriques.

---

## 1) Vision & Contexte

* **Pitch (1 phrase)** : Plateforme e-sport mettant en avant les matchs **en direct** (multi-jeux) + actualités, avec monétisation par publicités (masquées pour abonnés) et SEO solide sur les contenus éditoriaux.
* **Problème utilisateur** : Difficile de trouver rapidement les matchs live pertinents et les actus fiables par jeu.
* **Valeur clé / différenciation** : Focus **live-only** agrégé (SportDevs), tournois/équipes/matchs structurés (PandaScore), UX rapide par **jeu** et calendrier simple.
* **Mesure du succès (KPI)** : CTR jeux en home, temps sur « Direct », clics pubs, conversions abonnement (no-ads), pages vues News/Articles, retour visiteurs.
* **Contraintes business** : Pas de back-office à développer (déjà existant). Pas de conservation de données côté app. Pas de limite API contractuelle.

### Décisions actées (20/09/2025)

* **Jeux au lancement** : Valorant, FIFA, Wild Rift, Dota, Overwatch, Call of Duty, League of Legends, Rainbow Six Siege, Rocket League, CS2.
* **Cibles** : Visuellement s’adresser aux **fans** ; **panneau publicitaire** pensé pour les joueurs.
* **Périmètre** : Pas de MVP — développement **complet** de l’app dès V1. Back-office **déjà fait**.
* **Sources de données** :

  * **SportDevs** → *uniquement* flux **en direct** + **news**.
  * **PandaScore** → tournois, équipes, matchs (hors live) et structure compétitions.
* **Données** : Aucune **conservation** locale (no persistence au-delà du cache volatile).
* **API** : Aucune limite de requêtes imposée.
* **Qualité des données** : Gestion des incohérences/doublons **plus tard** (hors V1).
* **Navigation** : Liens de diffusion **ouvrent dans un nouvel onglet**.
* **Monétisation** : 3 emplacements pub **desktop** dans une colonne droite pleine hauteur en home ; **aucune pub pour les abonnés**.
* **SEO** : H1/H2 optimisés ; articles avec **mots-clés** injectés automatiquement depuis la base de données.

## 2) Cibles & Parcours

* **Personas prioritaires** (3 max) : objectifs, freins, critères de décision.
* **Parcours clés** (jobs-to-be-done) : étapes, points de friction, métriques.
* **Cas d’usage non-objectifs** (ce qu’on ne fera pas).

## 3) Arborescence & Structure

* **Sitemap (N1)** : Home / Direct / Tournois / News / Articles / Calendrier / Profil / Abonnement.
* **Home** :

  * **Banderole** de choix des jeux (sélection persistée).
  * **Colonne droite desktop** : panneau publicitaire pleine hauteur avec **3 emplacements**.
  * **Blocs** : Matchs **en direct**, **News** (1 une + liste).
* **Direct** : liste des matchs **triable par jeu** (fenêtre centrée sur le maintenant).
* **Calendrier** : clic sur **jour** → affiche **uniquement** les matchs du **jeu sélectionné** ce jour-là (le jeu est déjà enregistré via la banderole/home).
* **News / Articles** : grilles vignettes, pages détail article ; « Voir aussi » basé sur jeu/tags.
* **Tournois** : listing + fiche (structure PandaScore). Gestion avancée des doublons **post-V1**.
* **Navigation** : header jeux, footer, breadcrumb sur contenus éditoriaux.

## 4) Périmètre MVP & Roadmap

* **Pas de MVP** : développement **V1 complète**.
* **Post-V1 (déjà notés)** :

  * Règles de **désambiguïsation** tournois/doublons.
  * **Détail de match** enrichi (stats avancées, picks/bans, line-ups…).
  * Politique de **correction** des matchs incohérents (ETL/normalisation).
* **MVP** : fonctionnalités indispensables, critères de réussite.
* **V1/V2+** : étapes ultérieures, hypothèses à valider.
* **DOR/DOD** : Definition of Ready / Definition of Done pour chaque type de livrable.

## 5) Design & Direction Artistique (DA)

* **Intent** : priorité **fans** (lisibilité live, hiérarchie forte par jeu), codes visuels e-sport.
* **Design System** : tokens couleurs, typo, composants (Button, Card, Tabs jeux, Banner pub, LiveMatchItem).
* **Responsive** : Desktop sans bascule prématurée vers layout tablet quand on réduit la fenêtre.
* **Accessibilité** : WCAG 2.1 AA, focus visible, contraste OK.
* **Palette De Couleur** :#060B13, #091626, #182859, #F22E62

## 6) Contenus & SEO

* **SEO** : H1/H2/H3, meta Title/Description, OpenGraph. **Articles** : mots-clés auto depuis DB, champs éditoriaux existants via BO.
* **URLs** : slugs par jeu/compétition/article ; canonical sur listings avec filtres.
* **News** : une principale + liste ; règles d’épinglage via BO existant.
* **Charte éditoriale** : voix, tutoiement/vouvoiement, terminologie bannie/autorisé.
* **Modèle de page SEO** : Title (≤60), Meta description (≤155), H1–H3, schémas.
* **Stratégie mots-clés** : primaire / secondaires, intention.
* **Règles URL** : kebab-case, i18n, redirections (301/302), canonical.

## 7) Technique — Stack & Architecture

* **Données & APIs** :

  * **SportDevs** (live-only + news) → lecture en temps réel (polling court ou webhooks si dispo). Aucun stockage persistant ; **cache en mémoire**/CDN seulement.
  * **PandaScore** (tournois/équipes/matchs structurels) → hydratation des listes/fiche.
* **Stratégie data** : pas de base de données applicative pour persister ; prévoir **adapters** + **normalizers**; règles d’assainissement **post-V1**.
* **Infra** : CDN + edge cache ; SSR/ISR possible pour pages éditoriales (SEO), live en CSR.
* **Interop** : liens de diffusion ouverts en **new tab**.

## 8) Qualité de Code — Règles OBLIGATOIRES

* (inchangé) + **Interdiction de persister des données** (hors cache volatil).
* **Langage & Typage** : TypeScript "strict" partout ; pas de any implicite.
* **Conventions** :

  * Nommage en anglais, descriptif, sans abbr. obscures.
  * Dossiers par domaine (feature-first), pas par type de fichier.
  * Imports absolus + alias; pas d’imports circulaires.
* **Style & Outils** : Prettier + ESLint (noUnusedLocals, noImplicitReturns).
* **Tests** :

  * Unit >70% lignes sur modules critiques ; e2e sur parcours clés.
  * Données de test déterministes; pas d’horloge système (use fake timers).
* **Accessibilité** : aucun composant mergé sans audit axe-core passant.
* **Perf** :

  * LCP < 2.5s, CLS < 0.1, TTI < 3s (mobile 4G simulée).
  * Images responsives (srcset), lazy-loading, code-splitting.
* **Sécurité** :

  * OWASP Top 10 : validation stricte des entrées, sorties échappées.
  * Headers : CSP, HSTS, X-Content-Type-Options, Referrer-Policy.
  * Secrets hors repo; rotation; principe du moindre privilège.
* **Git** : Conventional Commits, branches `feat/`, `fix/`, `chore/`; PRs < 300 lignes ; rebase > merge quand possible.
* **CI/CD** : build reproductible, lint + tests obligatoires, preview env, migrations DB idempotentes.

## 9) Données & Contrats

* **Modèle logique (volatile)** : Game → Competition/Tournament → Match (live) → Streams ; News (source SportDevs) ; Article (via BO).
* **Politiques** : **Aucune rétention**. Pas de sauvegardes de données tierces. Seuls logs techniques non-PII.
* **RGPD** : abonnement géré côté BO/processor ; pubs conditionnées au consentement CMP.
* **Contrats d’API** : wrappers typed (OpenAPI/TypeScript), timeouts/retries, circuit-breaker.

## 10) Observabilité & Qualité Produit

* **Metrics** : Web Vitals (LCP<2.5s, CLS<0.1), temps de réponse APIs tierces, taux d’erreur fetch.
* **Alerting** : flux live down, dépassement temps réponse, anomalies volume.
* **Feature flags** : **no-ads** pour abonnés.
* **Logs** : structure JSON, corrélation traceId, pas de PII en clair.
* **Metrics** : RED/USE pour backend, Web Vitals pour frontend.
* **Alerting** : seuils, canaux, astreintes.
* **Feature flags** : rollout progressif, kill switch.

## 11) Analytics & Expérimentation

* **Plan de marquage (exemples)** : select\_game, view\_live\_list, open\_stream, click\_ad, view\_news, read\_article, subscribe\_noads.
* **Consentement** : déclenchement selon CMP.

## 12) Internationalisation (i18n)

* **Locales** : à confirmer (FR au minimum). Formats date/heure selon fuseau de l’utilisateur.
* **Locales** supportées, fallback, formats (dates, nombres, pluriels).
* **Stratégie de traduction** : clés stables, pas de textes en dur.

## 13) Risques & Hypothèses

* **R1** : Données incohérentes/doublons (compétitions, horaires) → traité **post-V1**.
* **R2** : Couverture live incomplète selon jeu → fallback UI (états vides).
* **R3** : Dépendance aux APIs tierces (SLA) → circuit-breakers + messages clairs.
* **R4** : SEO vs contenu externe (News) → pages indexables limitées, Articles optimisés.

## 14) Planning & Livrables

* **Livrables** : App V1 complète (pages listées), intégration SportDevs/PandaScore, SEO, colonne pubs desktop, abonnement no-ads (feature flag côté front si BO déjà gère les droits).
* \*\* jalons \*\* : kick-off, design freeze, code freeze, go-live.
* **Livrables** : maquettes, DS tokens, code, docs, scripts migration.
* **Plan de run** : sauvegardes, mises à jour, SLA, support N2/N3.

## 15) Context Engineering (IA) — si applicable

* (Non prioritaire V1.)

## 16) Checklists (rapides)

* **Avant merge** : lint, tests, a11y, perf budgets, pas de persistance data.
* **Avant release** : SEO vérifié (H1/H2/meta), CMP pubs/analytics, flags no-ads OK.
* **Après release** : surveillance flux live, latence API, taux clics pubs vs no-ads.
* **Avant merge** : lint, tests, a11y, perf budget, revu par pair.
* **Avant release** : migrations, backups, rollback plan, notes de version.
* **Après release** : monitoring, alertes, analytics actifs, plan d’observation 72h.

---

### Annexes

* **Glossaire** (termes métier / techniques)
* **Référentiels** (liens DS, guidelines, maquettes, OpenAPI)
* **Modèles** : issue template, PR template, bug report, test plan, plan de marquage.

### Shema database
* **User**: {"id":"integer","created_at":"timestamp","name":"text","email":"email","password":"password","photo":"image","photoUploaded":"bool","admin":"bool","favorite_team":"json"}
* **Article**: {"id":"integer","created_at":"timestamp","article":"json","slug":"text"}
* **Ex du json de 'Article'**: {
  "slug": "les-jeux-dechecs-sinstallent-dans-lesport",
  "tags": [
    "Esport",
    "échec"
  ],
  "title": "Les jeux d’échecs s’installent dans l’esport",
  "views": 0,
  "author": "Admin",
  "status": "publié",
  "content": "<div></div>",
  "category": "Analyse",
  "readTime": 2,
  "subtitle": "",
  "description": "desc",
  "content_black": "<div></div>",
  "content_white": "<div></div>",
  "featuredImage": "https://i.postimg.cc/D0VkTgF9/IMG-7860.jpg"
}
* **Game**: {"id":"integer","created_at":"timestamp","name":"text","selected_image":"image","unselected_image":"image","acronym":"text"}
* **Publicité**: {"id":"integer","created_at":"timestamp","title":"text","position":"integer","type":"enum","url":"text","redirect_link":"text","is_active":"bool","file_size":"integer","file_type":"text","duration":"integer","updated_at":"timestamp"}

- Demander dans le chat les endpoints des api quand il y'a besoin.
- Ne jamais mettre de données fictive SAUF si je te le dis.