# Phase 6 — Mise a jour Documentation

> **Statut : ✅ TERMINEE**
> **Pre-requis : Phases 1 a 5 terminees**

## Objectif

Mettre a jour toute la documentation du projet pour refleter la migration vers Liquipedia. CLAUDE.md, guides de deploiement, et docs internes doivent etre coherents avec la nouvelle architecture.

## Fichiers a modifier

### 1. `CLAUDE.md` — Source unique de verite

**Sections a mettre a jour :**

| Section | Changement |
|---------|-----------|
| **1) Vision & Contexte** | Sources de donnees : retirer SportDevs + PandaScore, ajouter Liquipedia API v3 |
| **2bis) Infrastructure** | Architecture sync : retirer "polling PandaScore 5 min", decrire cache-aside Liquipedia |
| **3bis) API Endpoints** | Mettre a jour les descriptions internes (source = Liquipedia, pas PandaScore) |
| **7) Technique — Stack** | Retirer SportDevs + PandaScore des sources de donnees, ajouter Liquipedia |
| **8) Base de Donnees** | Retirer tables `tournaments`, `matches`, `games_pandascore` (plus de persistence sync). Garder `users`, `articles`, `ads`, `games` |
| **9bis) Donnees & Contrats** | Modele logique : Game → (API Liquipedia) → Match/Tournament. Plus de sync PandaScore |
| **12) Deprecations** | Ajouter en "Completes" : PandaScore, SportDevs. Retirer "En cours" pour backend Go |

**Contenu a ajouter :**

```markdown
### Sources de donnees (post-migration)
- **Liquipedia API v3** : Matchs, tournois, equipes, joueurs, streams
  - Base URL : `https://api.liquipedia.net/api/v3`
  - Auth : `Authorization: Apikey <token>`
  - Cache : Redis (30s live, 5min matchs/tournois, 15min equipes)
  - Rate limit : ~1 req/sec (geré par rate limiter Go)
  - Wikis par jeu : counterstrike, valorant, leagueoflegends, dota2, etc.
```

**Sections a retirer/simplifier :**
- Toute mention de "sync toutes les 5 min"
- Tables `tournaments`, `matches`, `games_pandascore` de la section DB
- References a `panda_id` comme cle de deduplication
- Mention de "stockage SportDevs cache Redis uniquement" (c'est maintenant tout Liquipedia)

### 2. `VPS-SETUP-COMPLETE-GUIDE.md`

| Changement | Detail |
|-----------|--------|
| Variables d'environnement | Retirer `PANDASCORE_API_KEY`, `SPORTDEVS_API_KEY`. Ajouter `LIQUIPEDIA_API_KEY` |
| Description des services | Mettre a jour la description du backend Go (source = Liquipedia) |
| Docker Compose | Refleter les changements des docker-compose files |

### 3. `doc/IMPLEM_MOBILE.md`

| Changement | Detail |
|-----------|--------|
| References SportDevs | Remplacer par Liquipedia |
| Types de donnees | Mettre a jour si les types ont change |
| Endpoints API | Verifier que les endpoints documentes sont corrects |

### 4. `mobile-app/PROGRESS.md`

| Changement | Detail |
|-----------|--------|
| References SportDevs/PandaScore | Remplacer par Liquipedia |

### 5. `mobile-app/types.ts`

| Changement | Detail |
|-----------|--------|
| Commentaire "Live Match Types (from SportDevs)" | → "Live Match Types (from Liquipedia)" |

### 6. `docs/phase0-nettoyage.md`

Aucun changement — document historique de la migration.

### 7. `frontend/app/types/index.ts` — Renommage optionnel

**Decision a prendre** : Faut-il renommer les types `Panda*` en `Liq*` ou les garder ?

| Option | Avantage | Inconvenient |
|--------|----------|-------------|
| **Garder `Panda*`** | Zero changement frontend, pas de risque de regression | Noms confusants (plus de PandaScore) |
| **Renommer en `Liq*`** | Noms coherents avec la source | Beaucoup de fichiers a modifier, risque regression |
| **Renommer en noms generiques** (`Match`, `Tournament`, `Team`) | Noms propres, independants de la source | Conflits potentiels avec types existants |

**Recommandation** : Garder `Panda*` pour le moment. Un renommage global peut etre fait plus tard de maniere automatisee (find-and-replace) quand tout est stable.

## CLAUDE.md — Structure cible

Voici un apercu de ce que chaque section devrait contenir apres la mise a jour :

### Section 1 — Vision & Contexte
```markdown
* **Sources de données** :
  * **Liquipedia API v3** → matchs, tournois, equipes, joueurs, streams (source unique)
* **Données** : Aucune conservation locale (cache Redis volatile uniquement)
```

### Section 2bis — Infrastructure
```markdown
* **Architecture de données** :
  - Backend Go requete Liquipedia API v3 on-demand (pas de polling)
  - Cache Redis : TTL 30s (live), 5min (matchs/tournois), 15min (equipes)
  - Rate limiter Go : ~1 requete/seconde vers Liquipedia
  - Pas de sync periodique, pas de stockage en DB pour matchs/tournois
```

### Section 7 — Technique
```markdown
* **Données & APIs** :
  * **Liquipedia API v3** (matchs, tournois, equipes, joueurs, streams)
    → Requetes on-demand avec cache Redis
    → Normalisation backend vers format PandaMatch/PandaTournament (compatibilite frontend)
    → Rate limiter integre, retry sur 429
```

### Section 8 — Base de Donnees
```markdown
* **4 tables principales** :
  1. **users** - Comptes + preferences + equipes favorites
  2. **games** - Reference des jeux supportes
  3. **articles** - Contenu editorial
  4. **ads** - Bannieres publicitaires

* **Tables supprimees** (plus necessaires) :
  - ~~tournaments~~ (donnees Liquipedia en cache Redis)
  - ~~matches~~ (donnees Liquipedia en cache Redis)
  - ~~games_pandascore~~ (donnees Liquipedia en cache Redis)
```

### Section 12 — Deprecations
```markdown
* **Complétés** :
  - ✅ Migration PandaScore → Liquipedia (matchs, tournois, equipes)
  - ✅ Migration SportDevs → Liquipedia (live, streams)
  - ✅ Backend Node.js → Go
  - ✅ Supabase → PostgreSQL local
  - ✅ Vercel → infrastructure locale Docker
```

## Verification

- [ ] `CLAUDE.md` ne contient plus de reference a PandaScore comme source active
- [ ] `CLAUDE.md` ne contient plus de reference a SportDevs comme source active
- [ ] `CLAUDE.md` mentionne Liquipedia API v3 comme source unique de donnees
- [ ] `VPS-SETUP-COMPLETE-GUIDE.md` a les bonnes variables d'environnement
- [ ] `doc/IMPLEM_MOBILE.md` est a jour
- [ ] `grep -ri "pandascore" CLAUDE.md` → seulement en section historique/deprecations
- [ ] `grep -ri "sportdevs" CLAUDE.md` → seulement en section historique/deprecations
- [ ] La section Base de Donnees de CLAUDE.md ne mentionne plus les tables tournaments/matches/games_pandascore comme actives
- [ ] La section Infrastructure decrit correctement l'architecture cache-aside Liquipedia

## Points d'attention

1. **Historique** : Garder les mentions de PandaScore/SportDevs dans la section "Deprecations" pour l'historique.
2. **Types frontend** : Ne pas renommer les types `Panda*` a ce stade — documenter que ce sont des noms historiques.
3. **Mobile app** : Si l'app mobile est un projet separe, coordonner la mise a jour de sa documentation.
4. **CLAUDE.md coherence** : Relire le document entier apres modifications pour s'assurer qu'il n'y a pas de contradictions entre sections.

## Dependances

- Toutes les phases precedentes terminees et validees
- Connaissance de l'architecture finale (cache TTLs, endpoints, etc.)
