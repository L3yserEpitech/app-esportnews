# Match data par jeu — Synthèse transverse (Liquipedia API v3)

> Base de travail pour la **page de match détaillé modulaire par jeu**. Un doc détaillé par jeu dans ce dossier ; ce README en donne la vue transverse + les décisions.
>
> Méthode : chaque jeu a été étudié en croisant nos modèles Go (`backend-go/internal/models/liquipedia_match.go`, projection `LiqMatchQueryFields` dans `liquipedia_poller.go`) avec les **modules Lua open-source de Liquipedia** (`github.com/Liquipedia/Lua-Modules`, `lua/wikis/<wiki>/...`) — le code exact qui écrit les enregistrements `match2`, donc la source la plus fiable (les pages HTML renvoyaient 429 depuis l'host).

## ⚠️ Constat n°1 — Aucune télémétrie in-game temps réel

Liquipedia est un **wiki édité par humains/bots**. Pour **aucun** des jeux il n'existe de kill feed, de KDA qui monte en direct, de gold/HP live, de positions, etc.

- Le « live » réel = statut `running` + score série/map mis à jour à la main (+ latence poller 2–8 min) + **embed du stream**.
- Les stats riches par joueur **n'existent qu'en post-game**, et **seulement** pour les matchs avec une « MatchPage » (LoL/Valorant) / « BigMatch » (Dota2), importée par un éditeur → **couverture partielle**.
- Un vrai « live KDA / kill feed / ratings live » exigerait **une autre source** (HLTV, Riot API, etc.). Hors périmètre Liquipedia.

## Les 3 tiers de richesse

| Tier | Jeux | Contenu Liquipedia |
|------|------|--------------------|
| **1 — Riche par joueur** (post-game, MatchPage/BigMatch, partiel) | **LoL · Valorant · Dota2** | perso/agent/héros, KDA, gold/éco/CS, items, runes/sorts, objectifs, draft picks/bans, side |
| **2 — Équipe/map seulement** (zéro stat joueur) | **CS2 · R6 · Overwatch · CoD · Rocket League** | scores par map, halfs/sides, **map veto**, bans (opérateurs/héros), **mode** (Hardpoint/Control…), MVP, OT |
| **3 — Pauvre** | **EA FC** (1v1, buts/legs/penos) · **Smash** (1v1 solo, stage/persos/stocks) | quasi rien de chiffré |

> Surprise : **CS2 et R6 n'ont AUCUNE stat par joueur sur Liquipedia** (ADR/rating/KDA/KOST viennent de HLTV / SiegeGG, juste liés dans `match.links`).

## La bonne nouvelle — beaucoup de data est déjà fetchée mais **jetée**

Cause commune à presque tous les jeux : **`NormalizeLiqMatch` jette** des données qu'on a déjà payées en budget API.

- **Niveau match (perdu)** : `extradata` (→ `mapveto`, `mvp`, `casters`, `hassubmatches`), `vod`, `patch`, `links` (HLTV/Dotabuff/Stratz/SiegeGG/FACEIT).
- **Niveau game / joueur (passe au front mais non typé / non rendu)** : `NormalizedGameEntry.ExtraData` et `NormalizedParticipant.Extra` (maps non typées). Toute la couche stats LoL/Valorant/Dota2 arrive là, mais rien n'est structuré ni affiché.

➡️ **Une grande partie du « max d'infos » est atteignable à budget API zéro** : typage de normalisation + rendu front, sans nouvel appel.

## Récap par jeu (richesse + « free win » prioritaire)

| Jeu | Wiki | Tier | Le plus riche dispo | Free win prioritaire |
|-----|------|------|---------------------|----------------------|
| CS2 | `counterstrike` | 2 | halfs/sides, map veto | exposer `mapveto` + `links` (HLTV) ; halfs déjà transmis |
| Valorant | `valorant` | 1 | agents, ACS/ADR/KAST/HS/FK (post-game) | typer les stats joueur ; exposer `mapveto`/`vod`/`patch` |
| LoL | `leagueoflegends` | 1 | perso/role, KDA/KP, gold, CS, dmg, items, runes, sorts, objectifs, draft | typer couche joueur + draft + objectifs |
| Dota2 | `dota2` | 1 | héros/facet, net worth, GPM/XPM, LH/DN, items, objectifs, veto ordonné | typer couche joueur + draft ; exposer `patch`/`vod`/`links`/`mvp` |
| Rocket League | `rocketleague` | 2 | buts/game, OT, timeouts, arena | rendre l'`extradata` game (déjà transmis) ; exposer casters/vod |
| CoD | `callofduty` | 2 | `mode` (Hardpoint/SnD/Control), scores, MVP | typer le champ `mode` ; exposer mvp + rosters |
| R6 | `rainbowsix` | 2 | round/side scores, bans opérateurs, map veto, MVP | exposer mapveto/mvp/casters ; halfs/bans déjà transmis |
| Overwatch | `overwatch` | 2 | `mode`, bans héros, banstart, MVP | exposer `mode` (jeté) + mvp/casters (Flashpoint/Clash → mode parfois vide) |
| EA FC | `easportsfc` | 3 | 1v1, buts/legs/penalties | exposer `hassubmatches` (jeté) pour savoir rendre le score |
| **Smash Ultimate** | `smash` | 3 | 1v1 solo : stage + personnages + stocks/joueur | chantier dédié (voir ci-dessous) |

## Décision roster — 10ᵉ jeu = Super Smash Bros. Ultimate

- **Choisi** : Smash Ultimate — **seul jeu de combat à wiki dédié** sur Liquipedia (`smash`). Filtrer **`[[game::ultimate]]`** (le wiki héberge 6 titres : melee/ultimate/brawl/wiiu/pm/64).
- **Rejeté** : 2XKO — vit sur le wiki **partagé `fighters`** (budget partagé avec SF/Tekken/MK…, cache à namespacer par jeu, acronyme↔wiki many-to-one). Doc conservé : `match-data-2xko.md`.
- **État du code** : `GameWikiMapping` mappe encore `mlbb → mobilelegends`. **Non modifié** : un swap naïf vers `smash` ferait poller les 6 titres Smash sans filtre → data fausse. L'intégration Smash est un **chantier scopé** (voir ci-dessous), pas un changement de ligne.

### Smash = le plus gros chantier (3 ruptures du pipeline « team »)
1. **Filtre par jeu** : le poller ne filtre pas par `game` aujourd'hui → ajouter `[[game::ultimate]]` pour `smash`.
2. **Parser dédié** : persos/stocks sont dans `match2games[].opponents[].players[].characters` (`{name,status}`, status 1=vivant/0=perdu) — notre parser lit l'ancienne map `participants` (vide pour Smash) → tout est silencieusement perdu aujourd'hui.
3. **Opposants solo** : `type="solo"` (pas d'équipes) → favoris/pages équipe/recherche équipe inapplicables. Nécessiterait un concept « joueurs favoris », ou masquer les features team pour Smash.

## Bugs/écarts code relevés au passage
- **EA FC** : notre code clé le jeu `fifa` mais le wiki réel est `easportsfc` (bug latent déjà connu dans la videogame-map).
- `LiqMatchQueryFields` vit dans `liquipedia_poller.go`, **pas** `liquipedia_service.go` (corriger le modèle mental / CLAUDE.md §5.1 implicite).

## Prochaines étapes proposées
1. **Phase « free wins » (budget 0)** : typer dans `NormalizeLiqMatch` les pertes communes (mapveto, mvp, casters, hassubmatches, vod, patch, links) + structurer `ExtraData`/`Extra` pour Tier 1.
2. **Design page détail par jeu** : 3 templates (Tier 1 riche / Tier 2 équipe-map / Tier 3 minimal) plutôt que 10 designs.
3. **Intégration Smash** (chantier dédié) : filtre game + parser solo/persos/stocks + UX « joueurs ».
4. Mettre à jour le spec `2026-06-19-per-game-match-tournament-pages-design.md` avec ces tiers + le constat live.
