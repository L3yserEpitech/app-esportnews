# Pages de match & tournoi par jeu — Spec de design

> **Date** : 2026-06-19 · **Branche** : `liquipedia` · **Statut** : design validé, en attente de revue utilisateur avant plan d'implémentation.

## 1. Contexte & objectif

Aujourd'hui le front a **une seule page de détail pour tous les jeux** : `/match/[id]` (`frontend/app/match/[id]/page.tsx`) et `/tournois/[id]` (`frontend/app/tournois/[id]/page.tsx`), rendues par un composant unique. Or chaque jeu expose des données très différentes (vérifié sur l'API Liquipedia — voir `docs/liquipedia.md` §11) : de Valorant (scoreboard joueurs complet) à Rocket League (score seul).

**Objectif** : des pages **par jeu** sous `/match/[game]/[id]` et `/tournois/[game]/[id]`, chacune avec un layout adapté à la donnée réellement disponible, construites sur un **moteur partagé** (plomberie commune DRY + corps custom par jeu). Bénéfices : SEO (jeu dans le chemin), backend moins coûteux (fetch mono-wiki au lieu d'un fanout 10 wikis), évolutivité (ajouter un jeu = 1 composant).

## 2. Décisions verrouillées

| Décision | Choix |
|----------|-------|
| Périmètre | **Les 10 jeux**, **match + tournois** |
| Slugs d'URL | **Slugs SEO propres** (`cod`, `cs`, `lol`, `r6`…) |
| Architecture | Route dynamique `[game]` + **registre de composants par jeu** + shell commun |
| Ordre de build | **Valorant en premier** (cas le plus riche), puis par tier de données |

## 3. Non-objectifs (ce cycle)

- Pas de **source externe** (Riot / OpenDota) — uniquement la donnée Liquipedia. (Le temps réel / kill feed / sorts = cycle futur, voir `docs/liquipedia.md` §4.)
- Pas de changement de **schéma DB** ni de back-office.
- Pas de refonte visuelle globale du site — on se concentre sur les pages détail match/tournoi.

## 4. Registre de jeux (source unique de vérité des slugs)

Un registre central mappe **slug URL ↔ wiki ↔ acronyme interne ↔ videogame**. Le slug URL est un **nouvel identifiant SEO** (distinct de `videogame.slug` interne déjà renvoyé par le back, ex. `cs2`/`codmw`).

| Slug URL | Wiki Liquipedia | Acronyme interne | Nom affiché |
|----------|-----------------|------------------|-------------|
| `valorant` | valorant | valorant | Valorant |
| `lol` | leagueoflegends | lol | League of Legends |
| `cs` | counterstrike | csgo | Counter-Strike 2 |
| `dota2` | dota2 | dota2 | Dota 2 |
| `rl` | rocketleague | rl | Rocket League |
| `cod` | callofduty | codmw | Call of Duty |
| `r6` | rainbowsix | r6siege | Rainbow Six Siege |
| `ow` | overwatch | ow | Overwatch |
| `eafc` | easportsfc | fifa | EA Sports FC |
| `mlbb` | mobilelegends | mlbb | Mobile Legends |

- **Emplacement** : registre **frontend** (source de vérité des slugs) — le front valide le slug, en déduit le wiki, et appelle l'API avec `?wiki=<wiki>`. Le backend reste inchangé côté routing (il connaît déjà acronyme/wiki).
- Les `Link` et sitemaps dérivent le slug depuis `match.wiki` / `tournament.videogame` via le registre — donc **un seul endroit** à maintenir.
- **Slugs immuables une fois indexés** : on les fige maintenant.

## 5. Architecture de routing

- `/match/[game]/[id]/page.tsx` (dynamique) :
  1. valide `[game]` contre le registre → `notFound()` si inconnu ;
  2. mappe slug → wiki ;
  3. fetch serveur `GET /api/matches/:id?wiki=<wiki>` (**mono-wiki, rapide** — `GetMatch` supporte déjà `?wiki=`) ;
  4. aiguille vers le **composant de rendu du jeu**.
- `/tournois/[game]/[id]/page.tsx` : même patron (le détail tournoi backend peut recevoir un hint de wiki pour éviter son scan — optimisation optionnelle).
- **Registre de rendu** : `matchViews: Record<slug, Component>` et `tournamentViews: Record<slug, Component>`. Un **rendu générique de secours** sert tout jeu sans composant dédié (et pendant la migration).
- **Shell commun** : header (équipes, score, statut, stream, tournoi, BO), fil d'ariane, états loading/erreur, **métadonnées SEO** (title/OG/canonical). Le corps spécifique au jeu est rendu à l'intérieur.

## 6. Modèle de blocs (le « modulaire »)

- Le **corps** d'une page = composition de **blocs**. Chaque bloc est un composant qui **rend `null` si sa donnée est absente** → auto-masquage même au sein d'un jeu.
- La **vue d'un jeu** = une liste ordonnée de blocs (config). Ajouter un jeu = choisir ses blocs (ou en écrire de nouveaux).
- Principe : « plein d'éléments quand la donnée existe, sinon le bloc disparaît » — jamais de gros bloc vide.

## 7. Inventaire des blocs par jeu — MATCH (dérivé de la donnée vérifiée)

| Tier | Jeux | Blocs du corps |
|------|------|----------------|
| 🟢 Riche+ | **Valorant** | Onglets maps · **Scoreboard joueurs** (KDA, ACS, ADR, KAST, HS%, first kills, damage) · Agents · Score par mi-temps/sides |
| 🟢 Riche | **LoL** | Onglets games · **Scoreboard joueurs** (KDA + champion + rôle) · **Draft** (bans/picks/sides) · durée |
| 🟡 Draft | **Dota2, MLBB, HoK** | **Draft** (héros/champions + bans + sides) — *pas* de scoreboard. Dota2 : `publisherid` exposé (pont futur OpenDota) |
| 🟡 Rounds | **CS2, R6** | Liste des maps + **score par mi-temps + sides** ; R6 : bans d'opérateurs |
| 🔴 Minimal | **RL, CoD, EA FC** | Liste des maps + scores uniquement |

> Socle commun (header) présent partout : équipes/logos · score série · statut/heure · BO · stream(s) · tournoi/ligue · tier.

## 8. Inventaire — TOURNOI

Les pages de tournoi sont **largement communes** (données surtout game-agnostiques) ; la spécialisation passe surtout par les **cartes de match** internes (qui réutilisent le traitement match par jeu). Blocs :
- Header tournoi (nom, tier, dates, prizepool, organisateur, bannière)
- **Bracket / arbre** (depuis les matchs `[[parent::pagename]]`)
- **Équipes & rosters** (extraits des opponents + squad batch)
- **Placements / classement** (si dispo)
- Liste des matchs (cartes par jeu)

## 9. Implications backend

- **Exposer la donnée aujourd'hui jetée** : étendre la normalisation (`internal/models/liquipedia_match.go`, `normalizeMatchGames`) pour exposer `match2games[].participants` (KDA) et `match2games[].extradata` (draft/agents/bans) — actuellement ignorés (voir `docs/liquipedia.md` §11, finding « on jette déjà ces données »). **Requis** pour les corps Valorant/LoL.
- Détail match : `?wiki=` déjà supporté → fetch mono-wiki. ✅
- Détail tournoi : accepter optionnellement un hint de jeu/wiki pour éviter le scan multi-cache (optimisation, non bloquant).
- Corriger au passage le bug documenté `fifa→easportsfc` des maps `videogame*` (clé sur l'ancien nom de wiki) lors de la consolidation du registre.

## 10. SEO & migration

- **Redirections 301** : `/match/[id]` (et `?wiki=`) → `/match/[slug]/[id]` ; `/tournois/[id]` → `/tournois/[slug]/[id]`. Les vieilles URLs n'ont pas le jeu → la route de compat résout le wiki (fetch par id, fanout si besoin) puis 301. Garder ces routes de compat fines (URLs déjà indexées, ère PandaScore incluse).
- **Liens internes** à migrer vers un helper unique `matchHref(match)` / `tournamentHref(t)` (dérive le slug via le registre) :
  - Match : `LiveMatchCard`, `PandaMatchCard`, `FeaturedMatchCard`, `TournamentMatchCard`, `TournamentBracket`.
  - Tournoi : `TournamentCard`, `lib/breadcrumbHelper.ts`.
- **Sitemaps** : `frontend/app/sitemap-matches.xml/route.ts` et `sitemap-tournaments.xml/route.ts` → émettre les URLs `/match/[slug]/[id]` & `/tournois/[slug]/[id]`.
- **Canonical** : métadonnées → nouvelle URL par jeu.

## 11. Découpage en phases

- **Phase 0 — Fondations** : registre de jeux (slug↔wiki) + helpers `matchHref`/`tournamentHref` + normalisation backend expose `participants`/`extradata`.
- **Phase 1 — Migration routing match** : `/match/[game]/[id]` + shell commun + **corps générique** + redirections 301 + sitemaps + mise à jour des liens. *Livrable : URLs migrées, tous les jeux marchent (corps générique).*
- **Phase 2 — Valorant (match)** : vue match riche → valide le moteur de blocs sur le cas le plus dur.
- **Phase 3 — Autres jeux (match)** par tier : LoL → MOBAs (Dota2/MLBB/HoK) → CS2/R6 → RL/CoD/EAFC.
- **Phase 4 — Tournois** : `/tournois/[game]/[id]` + shell + vues tournoi (communes + cartes de match par jeu) + redirections + sitemap.

## 12. Tests

- Unitaire : mapping du registre, helpers de href, logique d'auto-masquage des blocs, normalisation expose bien les nouveaux champs.
- Route : slug inconnu → 404 ; vieille URL → 301 vers la nouvelle.
- Par vue de jeu : rendu avec données présentes vs absentes (les blocs vides disparaissent).

## 13. Risques & notes

- **Taille des payloads** : exposer `participants`/`extradata` grossit le détail match — OK car c'est un fetch mono-match (le souci des 9 MB concernait les endpoints *liste*).
- **Stabilité des slugs** : une fois indexés, ils sont permanents → figés en Phase 0.
- **Cartes de match dans les tournois** : la migration des liens (Phase 1) doit gérer les cartes utilisées à la fois en liste et dans le bracket.
