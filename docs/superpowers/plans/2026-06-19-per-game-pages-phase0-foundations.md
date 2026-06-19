# Per-Game Pages — Phase 0 : Fondations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser les fondations (non visibles, non cassantes) des pages par jeu : un registre de jeux frontend, des helpers de liens, et l'exposition côté backend des données de match aujourd'hui jetées (KDA + draft).

**Architecture:** Aucune route ni aucun lien ne change dans cette phase. On crée des utilitaires purs testés (registre slug↔wiki, helpers `matchHref`/`tournamentHref`) et on enrichit la normalisation backend de façon **additive** (`omitempty`) pour exposer `participants` (stats joueur) et `extradata` (draft) par game, plus le `wiki` sur les tournois. Tout est testé en isolation.

**Tech Stack:** Frontend Next.js 15 / React 19 / TypeScript, **pnpm**, **Vitest** (introduit ici, env `node`). Backend Go 1.x, tests stdlib `testing` (pas de testify pour rester sans dépendance).

**Référence spec:** `docs/superpowers/specs/2026-06-19-per-game-match-tournament-pages-design.md` (Phase 0 = §11).

---

## File Structure

| Fichier | Rôle |
|---------|------|
| `frontend/vitest.config.ts` | **Créer** — config Vitest (env node, alias `@`, include `app/**/*.test.ts`) |
| `frontend/package.json` | **Modifier** — scripts `test` / `test:watch` + devDep `vitest` |
| `frontend/app/lib/gameRegistry.ts` | **Créer** — source unique slug↔wiki↔acronyme↔nom + lookups |
| `frontend/app/lib/gameRegistry.test.ts` | **Créer** — tests du registre |
| `frontend/app/lib/gameLinks.ts` | **Créer** — `matchHref` / `tournamentHref` (dérivent le slug du `wiki`) |
| `frontend/app/lib/gameLinks.test.ts` | **Créer** — tests des helpers |
| `backend-go/internal/models/liquipedia_match.go` | **Modifier** — `NormalizedParticipant` + champs `Participants`/`ExtraData` sur `NormalizedGameEntry` + parsing |
| `backend-go/internal/models/liquipedia_match_test.go` | **Créer** — test normalisation participants/extradata |
| `backend-go/internal/models/liquipedia_tournament.go` | **Modifier** — champ `Wiki` sur `NormalizedTournament` |
| `backend-go/internal/models/liquipedia_tournament_test.go` | **Créer** — test `Wiki` propagé |

---

## Task 1 : Mettre en place Vitest (frontend)

**Files:**
- Create: `frontend/vitest.config.ts`
- Modify: `frontend/package.json` (scripts + devDependencies)

- [ ] **Step 1 : Installer Vitest**

Run:
```bash
cd frontend && pnpm add -D vitest
```
Expected: `vitest` ajouté à `devDependencies` dans `package.json`, `pnpm-lock.yaml` mis à jour.

- [ ] **Step 2 : Créer la config Vitest**

Create `frontend/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Mirror tsconfig path alias "@/*": ["./*"]
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts'],
  },
});
```

- [ ] **Step 3 : Ajouter les scripts de test**

Modify `frontend/package.json` — dans `"scripts"`, ajouter (à côté de `dev`/`build`) :
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 4 : Vérifier que Vitest tourne (aucun test encore)**

Run:
```bash
cd frontend && pnpm test
```
Expected: Vitest démarre et affiche `No test files found` (ou équivalent) — sortie sans erreur de config. C'est attendu, on n'a pas encore de test.

- [ ] **Step 5 : Commit**

```bash
cd /Users/jules/Code/freelance/esportnews
git add frontend/vitest.config.ts frontend/package.json frontend/pnpm-lock.yaml
git commit -m "$(printf 'chore(frontend): add Vitest test runner\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2 : Registre de jeux (frontend)

**Files:**
- Create: `frontend/app/lib/gameRegistry.ts`
- Test: `frontend/app/lib/gameRegistry.test.ts`

- [ ] **Step 1 : Écrire le test (rouge)**

Create `frontend/app/lib/gameRegistry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  GAMES,
  gameBySlug,
  gameByWiki,
  isValidSlug,
  slugToWiki,
  wikiToSlug,
} from './gameRegistry';

describe('gameRegistry', () => {
  it('contient les 10 jeux', () => {
    expect(GAMES).toHaveLength(10);
  });

  it('a des slugs uniques et des wikis uniques', () => {
    expect(new Set(GAMES.map((g) => g.slug)).size).toBe(10);
    expect(new Set(GAMES.map((g) => g.wiki)).size).toBe(10);
  });

  it('mappe slug -> wiki (slugs SEO propres)', () => {
    expect(slugToWiki('cs')).toBe('counterstrike');
    expect(slugToWiki('cod')).toBe('callofduty');
    expect(slugToWiki('eafc')).toBe('easportsfc');
    expect(slugToWiki('mlbb')).toBe('mobilelegends');
  });

  it('mappe wiki -> slug (réciproque)', () => {
    expect(wikiToSlug('counterstrike')).toBe('cs');
    expect(wikiToSlug('rainbowsix')).toBe('r6');
    expect(wikiToSlug('leagueoflegends')).toBe('lol');
  });

  it('valide les slugs connus et rejette les inconnus', () => {
    expect(isValidSlug('valorant')).toBe(true);
    expect(isValidSlug('wildrift')).toBe(false); // remplacé par mlbb
    expect(isValidSlug('inconnu')).toBe(false);
  });

  it('résout une entrée complète par slug et par wiki', () => {
    expect(gameBySlug('lol')?.name).toBe('League of Legends');
    expect(gameByWiki('valorant')?.acronym).toBe('valorant');
  });

  it('retourne undefined pour les valeurs inconnues', () => {
    expect(gameBySlug('xx')).toBeUndefined();
    expect(slugToWiki('xx')).toBeUndefined();
    expect(wikiToSlug('xx')).toBeUndefined();
  });
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run:
```bash
cd frontend && pnpm exec vitest run app/lib/gameRegistry.test.ts
```
Expected: FAIL — `Failed to resolve import "./gameRegistry"` (le module n'existe pas encore).

- [ ] **Step 3 : Implémenter le registre**

Create `frontend/app/lib/gameRegistry.ts`:
```ts
// Single source of truth for the URL game slug ↔ Liquipedia wiki ↔ internal
// acronym mapping. The URL slug is the SEO-facing identifier in /match/[game]/...
// and is intentionally distinct from the internal videogame.slug (cs2, codmw…).
export interface GameEntry {
  slug: string;    // URL slug (SEO) — immutable once indexed
  wiki: string;    // Liquipedia wiki name
  acronym: string; // internal acronym (matches backend GameWikiMapping / games.acronym)
  name: string;    // display name
}

export const GAMES: readonly GameEntry[] = [
  { slug: 'valorant', wiki: 'valorant',        acronym: 'valorant', name: 'Valorant' },
  { slug: 'lol',      wiki: 'leagueoflegends', acronym: 'lol',      name: 'League of Legends' },
  { slug: 'cs',       wiki: 'counterstrike',   acronym: 'csgo',     name: 'Counter-Strike 2' },
  { slug: 'dota2',    wiki: 'dota2',           acronym: 'dota2',    name: 'Dota 2' },
  { slug: 'rl',       wiki: 'rocketleague',    acronym: 'rl',       name: 'Rocket League' },
  { slug: 'cod',      wiki: 'callofduty',      acronym: 'codmw',    name: 'Call of Duty' },
  { slug: 'r6',       wiki: 'rainbowsix',      acronym: 'r6siege',  name: 'Rainbow Six Siege' },
  { slug: 'ow',       wiki: 'overwatch',       acronym: 'ow',       name: 'Overwatch' },
  { slug: 'eafc',     wiki: 'easportsfc',      acronym: 'fifa',     name: 'EA Sports FC' },
  { slug: 'mlbb',     wiki: 'mobilelegends',   acronym: 'mlbb',     name: 'Mobile Legends' },
] as const;

const BY_SLUG = new Map<string, GameEntry>(GAMES.map((g) => [g.slug, g]));
const BY_WIKI = new Map<string, GameEntry>(GAMES.map((g) => [g.wiki, g]));

export function gameBySlug(slug: string): GameEntry | undefined {
  return BY_SLUG.get(slug);
}
export function gameByWiki(wiki: string): GameEntry | undefined {
  return BY_WIKI.get(wiki);
}
export function isValidSlug(slug: string): boolean {
  return BY_SLUG.has(slug);
}
export function slugToWiki(slug: string): string | undefined {
  return BY_SLUG.get(slug)?.wiki;
}
export function wikiToSlug(wiki: string): string | undefined {
  return BY_WIKI.get(wiki)?.slug;
}
```

- [ ] **Step 4 : Relancer le test → vert**

Run:
```bash
cd frontend && pnpm exec vitest run app/lib/gameRegistry.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 5 : Commit**

```bash
cd /Users/jules/Code/freelance/esportnews
git add frontend/app/lib/gameRegistry.ts frontend/app/lib/gameRegistry.test.ts
git commit -m "$(printf 'feat(frontend): game registry (URL slug <-> wiki <-> acronym)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3 : Helpers de liens `matchHref` / `tournamentHref`

**Files:**
- Create: `frontend/app/lib/gameLinks.ts`
- Test: `frontend/app/lib/gameLinks.test.ts`

> Note : ces helpers ne sont **pas encore branchés** dans les composants (ça vient en Phase 1, en même temps que la création des routes). On les crée et on les teste seulement. Le fallback legacy garantit qu'aucun lien ne casse si le jeu est introuvable.

- [ ] **Step 1 : Écrire le test (rouge)**

Create `frontend/app/lib/gameLinks.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { matchHref, tournamentHref } from './gameLinks';

describe('matchHref', () => {
  it('construit /match/<slug>/<match2id> quand le wiki est connu', () => {
    expect(matchHref({ wiki: 'counterstrike', match2id: 'ABC_001', id: 42 }))
      .toBe('/match/cs/ABC_001');
  });

  it('préfère match2id à id', () => {
    expect(matchHref({ wiki: 'valorant', match2id: 'X1', id: 99 }))
      .toBe('/match/valorant/X1');
  });

  it('tombe sur id quand match2id est absent', () => {
    expect(matchHref({ wiki: 'valorant', id: 99 })).toBe('/match/valorant/99');
  });

  it('fallback legacy /match/<id> quand le wiki est inconnu/absent', () => {
    expect(matchHref({ id: 7 })).toBe('/match/7');
    expect(matchHref({ wiki: 'unknownwiki', id: 7 })).toBe('/match/7');
  });
});

describe('tournamentHref', () => {
  it('construit /tournois/<slug>/<id> quand le wiki est connu', () => {
    expect(tournamentHref({ wiki: 'rainbowsix', id: 123 }))
      .toBe('/tournois/r6/123');
  });

  it('fallback legacy /tournois/<id> quand le wiki est inconnu/absent', () => {
    expect(tournamentHref({ id: 5 })).toBe('/tournois/5');
  });
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run:
```bash
cd frontend && pnpm exec vitest run app/lib/gameLinks.test.ts
```
Expected: FAIL — `Failed to resolve import "./gameLinks"`.

- [ ] **Step 3 : Implémenter les helpers**

Create `frontend/app/lib/gameLinks.ts`:
```ts
import { wikiToSlug } from './gameRegistry';

// Narrow structural inputs — decoupled from the full Panda* types so these
// helpers stay trivially testable. Any object carrying these fields works.
export interface MatchLinkInput {
  wiki?: string;
  match2id?: string;
  id: number | string;
}
export interface TournamentLinkInput {
  wiki?: string;
  id: number | string;
}

// matchHref builds /match/<slug>/<id>. Falls back to the legacy /match/<id>
// when the game can't be resolved, so links never break during migration.
export function matchHref(match: MatchLinkInput): string {
  const id = match.match2id || String(match.id);
  const slug = match.wiki ? wikiToSlug(match.wiki) : undefined;
  return slug ? `/match/${slug}/${id}` : `/match/${id}`;
}

// tournamentHref builds /tournois/<slug>/<id>, with the same legacy fallback.
export function tournamentHref(t: TournamentLinkInput): string {
  const slug = t.wiki ? wikiToSlug(t.wiki) : undefined;
  return slug ? `/tournois/${slug}/${t.id}` : `/tournois/${t.id}`;
}
```

- [ ] **Step 4 : Relancer le test → vert**

Run:
```bash
cd frontend && pnpm exec vitest run app/lib/gameLinks.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5 : Commit**

```bash
cd /Users/jules/Code/freelance/esportnews
git add frontend/app/lib/gameLinks.ts frontend/app/lib/gameLinks.test.ts
git commit -m "$(printf 'feat(frontend): matchHref/tournamentHref link helpers\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4 : Backend — exposer `participants` (KDA) + `extradata` (draft) par game

**Files:**
- Modify: `backend-go/internal/models/liquipedia_match.go`
- Test: `backend-go/internal/models/liquipedia_match_test.go`

> Aujourd'hui `normalizeMatchGames` ne lit que `finished/winner/map/scores/length` et **jette** `participants` et le `extradata` de chaque game. On les expose de façon additive (`omitempty`), de manière game-agnostique : les stats communes (KDA) sont normalisées, le reste (ACS, ADR, bans, agents…) passe en `extra`/`extradata` brut.

- [ ] **Step 1 : Écrire le test (rouge)**

Create `backend-go/internal/models/liquipedia_match_test.go`:
```go
package models

import (
	"encoding/json"
	"testing"
)

func TestNormalizeMatchGamesExposesParticipantsAndExtradata(t *testing.T) {
	games := `[{
		"map": "",
		"winner": "2",
		"scores": ["0","1"],
		"participants": {
			"1_1": {"character":"K'Sante","player":"Jaehyuk","role":"top","kills":"2","deaths":"4","assists":"6"},
			"2_1": {"agent":"Viper","player":"Sayonara","kills":16,"deaths":13,"assists":2,"acs":200.7,"adr":121}
		},
		"extradata": {"team1ban1":"Varus","team1champion1":"K'Sante","team1side":"blue"}
	}]`

	m := LiqMatch{
		PageID:      10,
		Match2Games: json.RawMessage(games),
	}

	out := NormalizeLiqMatch(m, "leagueoflegends", "finished")
	if len(out.Games) != 1 {
		t.Fatalf("expected 1 game, got %d", len(out.Games))
	}
	g := out.Games[0]

	if len(g.Participants) != 2 {
		t.Fatalf("expected 2 participants, got %d", len(g.Participants))
	}

	// Find by player name (participants map order is non-deterministic).
	byPlayer := map[string]NormalizedParticipant{}
	for _, p := range g.Participants {
		byPlayer[p.Player] = p
	}

	jae, ok := byPlayer["Jaehyuk"]
	if !ok {
		t.Fatal("missing participant Jaehyuk")
	}
	if jae.Team != 1 || jae.Character != "K'Sante" || jae.Role != "top" {
		t.Errorf("Jaehyuk team/character/role wrong: %+v", jae)
	}
	if jae.Kills == nil || *jae.Kills != 2 || jae.Deaths == nil || *jae.Deaths != 4 || jae.Assists == nil || *jae.Assists != 6 {
		t.Errorf("Jaehyuk KDA wrong: %+v", jae)
	}

	say, ok := byPlayer["Sayonara"]
	if !ok {
		t.Fatal("missing participant Sayonara")
	}
	if say.Team != 2 || say.Character != "Viper" {
		t.Errorf("Sayonara team/agent wrong: %+v", say)
	}
	if say.Kills == nil || *say.Kills != 16 {
		t.Errorf("Sayonara kills wrong: %+v", say)
	}
	// Game-specific stats land in Extra.
	if say.Extra == nil || say.Extra["acs"] == nil || say.Extra["adr"] == nil {
		t.Errorf("Sayonara extra (acs/adr) missing: %+v", say.Extra)
	}

	// Draft passes through in the game's ExtraData.
	if g.ExtraData == nil || g.ExtraData["team1ban1"] != "Varus" {
		t.Errorf("game extradata draft missing: %+v", g.ExtraData)
	}
}

func TestNormalizeMatchGamesSkipsEmptyLiveParticipants(t *testing.T) {
	// Live matches return participant keys with empty values — must yield none.
	games := `[{"map":"","participants":{"1_1":[],"2_1":[]}}]`
	m := LiqMatch{PageID: 1, Match2Games: json.RawMessage(games)}
	out := NormalizeLiqMatch(m, "leagueoflegends", "running")
	if len(out.Games) != 1 {
		t.Fatalf("expected 1 game, got %d", len(out.Games))
	}
	if len(out.Games[0].Participants) != 0 {
		t.Errorf("expected 0 participants for empty live placeholders, got %d", len(out.Games[0].Participants))
	}
}
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run:
```bash
cd backend-go && go test ./internal/models/ -run TestNormalizeMatchGames -v
```
Expected: FAIL de compilation — `out.Games[0].Participants undefined` / `NormalizedParticipant` non défini.

- [ ] **Step 3 : Ajouter les types et champs**

In `backend-go/internal/models/liquipedia_match.go`, ajouter ce type juste après la définition de `NormalizedGameEntry` :
```go
// NormalizedParticipant is a per-player, per-game stat line. Common fields are
// normalized; game-specific stats (acs, adr, kast, hs, firstKills…) land in Extra.
type NormalizedParticipant struct {
	Player    string                 `json:"player"`
	Character string                 `json:"character,omitempty"` // champion / agent / hero
	Role      string                 `json:"role,omitempty"`
	Team      int                    `json:"team,omitempty"` // 1 or 2, from the "team_slot" key
	Kills     *int                   `json:"kills,omitempty"`
	Deaths    *int                   `json:"deaths,omitempty"`
	Assists   *int                   `json:"assists,omitempty"`
	Extra     map[string]interface{} `json:"extra,omitempty"`
}
```

Puis, dans la struct `NormalizedGameEntry`, ajouter ces deux champs (à la fin, avant la `}` fermante) :
```go
	Participants []NormalizedParticipant `json:"participants,omitempty"`
	ExtraData    map[string]interface{}  `json:"extradata,omitempty"`
```

- [ ] **Step 4 : Ajouter les helpers de parsing**

In `backend-go/internal/models/liquipedia_match.go`, ajouter en bas du fichier (section `--- Helpers ---`) :
```go
// participantStdKeys are the keys consumed into typed NormalizedParticipant
// fields; everything else on a participant goes into Extra.
var participantStdKeys = map[string]bool{
	"player": true, "displayName": true, "displayname": true,
	"character": true, "agent": true, "champion": true, "hero": true,
	"role": true, "kills": true, "deaths": true, "assists": true,
}

// flexInt parses a value Liquipedia may send as string or number into *int.
func flexInt(v interface{}) *int {
	switch n := v.(type) {
	case float64:
		i := int(n)
		return &i
	case string:
		if i, err := strconv.Atoi(n); err == nil {
			return &i
		}
	case json.Number:
		if i, err := n.Int64(); err == nil {
			x := int(i)
			return &x
		}
	}
	return nil
}

// firstString returns the first non-empty string value among the given keys.
func firstString(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if s, ok := m[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// normalizeGameParticipants turns a match2games[].participants object
// ({"1_1": {...}, "2_3": {...}}) into normalized stat lines. Empty placeholder
// entries (live matches) are skipped.
func normalizeGameParticipants(raw interface{}) []NormalizedParticipant {
	m, ok := raw.(map[string]interface{})
	if !ok {
		return nil
	}
	out := make([]NormalizedParticipant, 0, len(m))
	for key, val := range m {
		pm, ok := val.(map[string]interface{})
		if !ok || len(pm) == 0 {
			continue
		}
		p := NormalizedParticipant{}
		if idx := strings.Index(key, "_"); idx > 0 {
			if t, err := strconv.Atoi(key[:idx]); err == nil {
				p.Team = t
			}
		}
		p.Player = firstString(pm, "player", "displayName", "displayname")
		p.Character = firstString(pm, "character", "agent", "champion", "hero")
		p.Role = firstString(pm, "role")
		p.Kills = flexInt(pm["kills"])
		p.Deaths = flexInt(pm["deaths"])
		p.Assists = flexInt(pm["assists"])

		extra := map[string]interface{}{}
		for k, v := range pm {
			if !participantStdKeys[k] {
				extra[k] = v
			}
		}
		if len(extra) > 0 {
			p.Extra = extra
		}

		// Skip empty placeholders (live matches have keys with no real data).
		if p.Player == "" && p.Character == "" && p.Kills == nil && p.Deaths == nil && p.Assists == nil && p.Extra == nil {
			continue
		}
		out = append(out, p)
	}
	return out
}
```

- [ ] **Step 5 : Brancher le parsing dans `normalizeMatchGames`**

In `backend-go/internal/models/liquipedia_match.go`, dans `normalizeMatchGames`, à l'intérieur de la boucle `for i, rawGame := range rawGames`, **juste avant** le `games = append(games, NormalizedGameEntry{...})`, ajouter :
```go
		var participants []NormalizedParticipant
		if praw, ok := gameData["participants"]; ok {
			participants = normalizeGameParticipants(praw)
		}
		var gameExtra map[string]interface{}
		if e, ok := gameData["extradata"].(map[string]interface{}); ok && len(e) > 0 {
			gameExtra = e
		}
```
Puis, dans le littéral `NormalizedGameEntry{ ... }` de ce `append`, ajouter ces deux champs :
```go
			Participants: participants,
			ExtraData:    gameExtra,
```

- [ ] **Step 6 : Lancer les tests → vert**

Run:
```bash
cd backend-go && go test ./internal/models/ -run TestNormalizeMatchGames -v
```
Expected: PASS (`TestNormalizeMatchGamesExposesParticipantsAndExtradata`, `TestNormalizeMatchGamesSkipsEmptyLiveParticipants`).

- [ ] **Step 7 : Vérifier le build complet + gofmt**

Run:
```bash
cd backend-go && gofmt -l internal/models/ && go build ./...
```
Expected: aucune sortie de `gofmt -l` (fichiers formatés), build OK.

- [ ] **Step 8 : Commit**

```bash
cd /Users/jules/Code/freelance/esportnews
git add backend-go/internal/models/liquipedia_match.go backend-go/internal/models/liquipedia_match_test.go
git commit -m "$(printf 'feat(backend): expose per-game participants (KDA) + draft extradata\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5 : Backend — ajouter `Wiki` sur `NormalizedTournament`

**Files:**
- Modify: `backend-go/internal/models/liquipedia_tournament.go`
- Test: `backend-go/internal/models/liquipedia_tournament_test.go`

> Les matchs portent déjà `wiki` ; les tournois non. Le front en a besoin pour `tournamentHref`. Ajout additif (`omitempty`).

- [ ] **Step 1 : Écrire le test (rouge)**

Create `backend-go/internal/models/liquipedia_tournament_test.go`:
```go
package models

import "testing"

func TestNormalizeLiqTournamentSetsWiki(t *testing.T) {
	lt := LiqTournament{
		PageID:    1,
		PageName:  "Some_Tournament",
		Name:      "Some Tournament",
		StartDate: "2026-01-01",
		EndDate:   "2026-01-10",
	}
	out := NormalizeLiqTournament(lt, "counterstrike")
	if out.Wiki != "counterstrike" {
		t.Errorf("expected Wiki=counterstrike, got %q", out.Wiki)
	}
}
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run:
```bash
cd backend-go && go test ./internal/models/ -run TestNormalizeLiqTournamentSetsWiki -v
```
Expected: FAIL de compilation — `out.Wiki undefined`.

- [ ] **Step 3 : Ajouter le champ + l'assigner**

In `backend-go/internal/models/liquipedia_tournament.go` :

1. Dans la struct `NormalizedTournament`, dans le bloc « Extra fields useful for the frontend », ajouter :
```go
	Wiki string `json:"wiki,omitempty"`
```

2. Dans `NormalizeLiqTournament`, dans le littéral `return NormalizedTournament{ ... }`, ajouter :
```go
		Wiki: wiki,
```

- [ ] **Step 4 : Lancer le test → vert**

Run:
```bash
cd backend-go && go test ./internal/models/ -run TestNormalizeLiqTournamentSetsWiki -v
```
Expected: PASS.

- [ ] **Step 5 : Build + gofmt + commit**

```bash
cd backend-go && gofmt -l internal/models/ && go build ./...
cd /Users/jules/Code/freelance/esportnews
git add backend-go/internal/models/liquipedia_tournament.go backend-go/internal/models/liquipedia_tournament_test.go
git commit -m "$(printf 'feat(backend): add wiki field to NormalizedTournament\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Vérification finale de la phase

- [ ] **Frontend** : `cd frontend && pnpm test` → tous les tests passent (gameRegistry + gameLinks).
- [ ] **Backend** : `cd backend-go && go test ./internal/models/` → PASS ; `go build ./...` → OK.
- [ ] **Non-régression** : aucune route ni aucun `<Link>` n'a changé ; les ajouts JSON sont `omitempty` → les consommateurs existants ne voient aucune différence tant qu'on ne lit pas les nouveaux champs.

---

## Self-review (rempli)

- **Couverture spec (Phase 0 = spec §11)** : registre de jeux ✅ (Task 2) · helpers `matchHref`/`tournamentHref` ✅ (Task 3) · normalisation expose `participants`+`extradata` ✅ (Task 4) · `wiki` sur tournoi (nécessaire à `tournamentHref`) ✅ (Task 5) · infra de test front ✅ (Task 1).
- **Placeholders** : aucun — chaque étape contient le code complet et les commandes exactes.
- **Cohérence des types** : `GameEntry`, `slugToWiki`/`wikiToSlug` (Task 2) réutilisés par `gameLinks` (Task 3) ; `NormalizedParticipant`/`NormalizedGameEntry.Participants`/`ExtraData` (Task 4) utilisés par le test du même task ; `NormalizedTournament.Wiki` (Task 5) cohérent avec l'usage front futur.
- **Hors-périmètre (Phases suivantes)** : création des routes `/match/[game]/[id]`, branchement des helpers dans les composants, redirections 301, sitemaps, vues par jeu, tournois — couverts par les plans Phase 1→4.
