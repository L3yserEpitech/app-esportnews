# Tier-1 Per-Game Match Detail Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the match detail page into a modular, section-registry-driven page and implement the Tier-1 (LoL / Valorant / Dota2) per-player + draft + external-stats surface, without regressing the other 7 games.

**Architecture:** A per-wiki section registry resolves an ordered list of section components for the page shell to render; each section reads `PandaMatch` and returns `null` when its data is absent. Tier-1 wikis add `draft` + `playerStats` sections fed by the per-game `participants`/`extradata` the backend already passes through; the backend also starts exposing match-level `mvp`/`vod`/`patch`/`links`. Testable logic lives in pure helpers (`.ts`) matching the repo's existing test style (no jsdom).

**Tech Stack:** Go 1.x (Echo, models layer), Next.js 15 App Router + React 19 (`'use client'`), TypeScript, Vitest 4 (pure-function tests), next-intl (`public/locales/*.json`), Tailwind with CSS-var design tokens.

**Spec:** `docs/superpowers/specs/2026-06-27-per-game-match-detail-page-design.md`
**Research (field reference):** `docs/superpowers/research/match-data-{lol,valorant,dota2}.md`

---

## Ground truth already verified (read before starting)

- Backend normalizer: `backend-go/internal/models/liquipedia_match.go`.
  - `NormalizeLiqMatch` (line ~209) builds `NormalizedMatch` but **never sets** `Mvp/Vod/Patch/Links` (these fields don't exist yet). `LiqMatch` already carries `Vod`, `Patch` (strings) and `Links`, `ExtraData` (`json.RawMessage`).
  - `normalizeMatchGames` (line ~595) already populates per-game `Map`, `Scores`, `Participants` (via `normalizeGameParticipants`, line ~855) and `ExtraData` pass-through. **Per-player stats already reach the frontend** inside `NormalizedParticipant.Extra` (untyped) — Tier-1 needs no new per-player backend work, only the match-level fields.
- The on-demand detail endpoint (`/api/matches/:id`) fetches the full match (no field projection), so `participants` + `extradata` are present for the detail page.
- Frontend page: server `frontend/app/[game]/match/[id]/page.tsx` fetches `/api/matches/:id?wiki=`, `notFound()` on 404, passes `initialMatch`+`wiki`+`matchId` to `frontend/app/match/_components/MatchDetailPageClient.tsx`.
- `MatchDetailPageClient.tsx` is a large `'use client'` component (~800 lines): hero scoreboard, game-by-game results, stats, rosters, streaming. It has `isLive`/`isFinished`, `TeamLogo`, `SectionHeader`, `parseGameWinner`, `getRoleBadgeStyle`, `formatDate/Time/Duration`. It does **not** have: 45s polling, a per-player stats table, a draft panel, external-stats links, the section registry, or game-first team links (it still builds legacy `/equipe/<slug>?wiki=` URLs via `getTeamUrl`).
- Frontend registry: `frontend/app/lib/gameRegistry.ts` (`gameByWiki`, `GameEntry`). Game-first link builders: `frontend/app/lib/gameLinks.ts` (`teamHref`).
- Tests: Vitest, `pnpm test` (`vitest run`). Config `frontend/vitest.config.ts`. Existing tests are pure `.ts` (`app/lib/gameLinks.test.ts`, `app/lib/gameRegistry.test.ts`). **No `@testing-library`/jsdom** — keep tested logic in pure helpers.
- Locales: `frontend/public/locales/{de,en,es,fr,it}.json`, keys under `pages_detail.match_detail` (the component uses `useTranslations('pages_detail.match_detail')`).

---

## Task 0: Capture real Tier-1 sample JSON (lock the `Extra` key names)

**Why:** the exact `participants[].extra` / per-game `extradata` / match-level `links` key names vary per wiki and could not be hit directly (`api.liquipedia.net` rate-limits this host). The **local backend** reaches Liquipedia fine and serves normalized JSON. This task records the real keys that Task 4 (statColumns) and Task 7 (draft) depend on.

**Files:**
- Create: `docs/superpowers/research/_tier1-sample-keys.md` (scratch notes, committed)

- [ ] **Step 1: Ensure the local stack is up**

Run: `docker ps --format '{{.Names}} {{.Status}}'`
If `esportnews-backend-dev` is not listed/healthy, run: `make dev` (or `docker compose -f docker-compose.dev.yml up -d`) and wait ~30s for warmup.
Verify: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/health` → `200`.

- [ ] **Step 2: Find a finished match id with participants, per Tier-1 game**

Run (repeat for `lol`, `valorant`, `dota2`):
```bash
for G in lol valorant dota2; do
  echo "== $G =="
  curl -s "http://localhost:4000/api/matches/past?game=$G&limit=15" \
  | python3 -c "import json,sys;a=json.load(sys.stdin);a=a if isinstance(a,list) else a.get('data') or a.get('matches') or [];[print(m.get('match2id'),'parts=',sum(len(g.get('participants') or []) for g in (m.get('games') or []))) for m in a]"
done
```
Pick, per game, a `match2id` whose `parts > 0`.

- [ ] **Step 3: Dump one match per game and record the keys**

Run (substitute `<match2id>` and `<wiki>` = `leagueoflegends|valorant|dota2`):
```bash
curl -s "http://localhost:4000/api/matches/<match2id>?wiki=<wiki>" \
| python3 -c "import json,sys;m=json.load(sys.stdin);g=(m.get('games') or [{}])[0];p=(g.get('participants') or [{}])[0];print('MATCH keys:',sorted(m.keys()));print('LINKS:',m.get('links'));print('GAME.extradata keys:',sorted((g.get('extradata') or {}).keys()));print('PARTICIPANT:',{k:p.get(k) for k in p});print('PARTICIPANT.extra keys:',sorted((p.get('extra') or {}).keys()))"
```

- [ ] **Step 4: Write the findings to the scratch file and commit**

Record, per wiki: the real `participant.extra` keys (e.g. is gold `gold` or `goldEarned`? CS `cs` or `creepScore`? ACS `acs`?), the per-game `extradata` keys (side, bans, vetophase, objectives), and the match-level `links` keys (dotabuff/stratz/opgg…). These exact strings are used verbatim in Task 4 and Task 7.

```bash
git add docs/superpowers/research/_tier1-sample-keys.md
git commit -m "docs(match): record real Tier-1 participant/extradata/links keys from live sample"
```

> If the stack cannot be started, fall back to the research docs' documented keys (`match-data-{lol,valorant,dota2}.md` §5) and mark each key `// UNVERIFIED` in Task 4 so the executor double-checks against a live match later.

---

## Task 1: Backend — expose match-level `mvp`/`vod`/`patch`/`links`

**Files:**
- Modify: `backend-go/internal/models/liquipedia_match.go` (struct `NormalizedMatch` ~109; func `NormalizeLiqMatch` ~209)
- Test: `backend-go/internal/models/liquipedia_match_extras_test.go` (new)

- [ ] **Step 1: Write the failing test**

Create `backend-go/internal/models/liquipedia_match_extras_test.go`:
```go
package models

import "testing"

func TestNormalizeLiqMatch_MatchLevelExtras(t *testing.T) {
	m := LiqMatch{
		PageID:   42,
		Date:     "2026-06-01 18:00:00",
		Finished: 1,
		Winner:   "1",
		BestOf:   3,
		Vod:      "https://youtu.be/vod1",
		Patch:    "14.11",
		ExtraData: []byte(`{"mvp":"Faker"}`),
		Links:     []byte(`{"dotabuff":"https://dotabuff.com/x","stratz":"https://stratz.com/y"}`),
		Match2Opponents: []byte(`[{"name":"T1","template":"t1","score":2},{"name":"GEN","template":"gen","score":1}]`),
	}
	out := NormalizeLiqMatch(m, "leagueoflegends", "finished")

	if out.Vod == nil || *out.Vod != "https://youtu.be/vod1" {
		t.Fatalf("vod = %v, want https://youtu.be/vod1", out.Vod)
	}
	if out.Patch == nil || *out.Patch != "14.11" {
		t.Fatalf("patch = %v, want 14.11", out.Patch)
	}
	if out.Mvp == nil || *out.Mvp != "Faker" {
		t.Fatalf("mvp = %v, want Faker", out.Mvp)
	}
	if out.Links["dotabuff"] != "https://dotabuff.com/x" || out.Links["stratz"] != "https://stratz.com/y" {
		t.Fatalf("links = %v", out.Links)
	}
}

func TestNormalizeLiqMatch_NoExtras(t *testing.T) {
	m := LiqMatch{
		PageID:          1,
		Date:            "2026-06-01 18:00:00",
		Match2Opponents: []byte(`[{"name":"A","template":"a"},{"name":"B","template":"b"}]`),
	}
	out := NormalizeLiqMatch(m, "valorant", "")
	if out.Vod != nil || out.Patch != nil || out.Mvp != nil || out.Links != nil {
		t.Fatalf("expected all nil extras, got vod=%v patch=%v mvp=%v links=%v", out.Vod, out.Patch, out.Mvp, out.Links)
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend-go && go test ./internal/models/ -run TestNormalizeLiqMatch_MatchLevel -v`
Expected: compile error — `out.Mvp`, `out.Vod`, `out.Patch`, `out.Links` undefined.

- [ ] **Step 3: Add the struct fields**

In `NormalizedMatch` (after the `Match2BracketID` block, ~line 139) add:
```go
	// Match-level extras (Tier-1+): previously fetched but dropped.
	Mvp   *string           `json:"mvp,omitempty"`
	Vod   *string           `json:"vod,omitempty"`
	Patch *string           `json:"patch,omitempty"`
	Links map[string]string `json:"links,omitempty"`
```

- [ ] **Step 4: Populate them in `NormalizeLiqMatch`**

Just before the `return NormalizedMatch{` (line ~324), add:
```go
	// Match-level extras
	var vod *string
	if m.Vod != "" {
		v := m.Vod
		vod = &v
	}
	var patch *string
	if m.Patch != "" {
		p := m.Patch
		patch = &p
	}
	var mvp *string
	if len(m.ExtraData) > 0 {
		var ed map[string]interface{}
		if json.Unmarshal(m.ExtraData, &ed) == nil {
			if s, ok := ed["mvp"].(string); ok && s != "" {
				mvp = &s
			}
		}
	}
	var links map[string]string
	if len(m.Links) > 0 {
		var lm map[string]interface{}
		if json.Unmarshal(m.Links, &lm) == nil && len(lm) > 0 {
			links = make(map[string]string, len(lm))
			for k, v := range lm {
				if s, ok := v.(string); ok && s != "" {
					links[k] = s
				}
			}
			if len(links) == 0 {
				links = nil
			}
		}
	}
```
Then add to the returned struct literal:
```go
		Mvp:   mvp,
		Vod:   vod,
		Patch: patch,
		Links: links,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend-go && go test ./internal/models/ -run TestNormalizeLiqMatch -v`
Expected: PASS. Then `go build ./...` → no errors.

- [ ] **Step 6: Commit**

```bash
git add backend-go/internal/models/liquipedia_match.go backend-go/internal/models/liquipedia_match_extras_test.go
git commit -m "feat(match): expose match-level mvp/vod/patch/links in NormalizedMatch"
```

---

## Task 2: Frontend types — extend `PandaMatch`/`PandaGame` + add `PandaParticipant`

**Files:**
- Modify: `frontend/app/types/index.ts` (`PandaMatch` ~163; `PandaGame` ~276)

- [ ] **Step 1: Add `PandaParticipant` and extend `PandaGame`**

Replace the `PandaGame` interface (lines ~276-293) with:
```ts
export interface PandaParticipant {
  player: string;
  character?: string | null; // champion / agent / hero
  role?: string | null;
  team?: number; // 1 or 2
  kills?: number | null;
  deaths?: number | null;
  assists?: number | null;
  extra?: Record<string, unknown>; // game-specific: gold, acs, netWorth, items[]...
}

export interface PandaGame {
  complete: boolean;
  id: number;
  position: number;
  status: string;
  length: number | null;
  finished: boolean;
  begin_at: string | null;
  detailed_stats: boolean;
  end_at: string | null;
  forfeit: boolean;
  match_id: number;
  winner_type: string;
  winner: { id: number | null; type: string };
  map?: string;
  scores?: number[];
  participants?: PandaParticipant[];
  extradata?: Record<string, unknown>;
}
```

- [ ] **Step 2: Extend `PandaMatch`**

In `PandaMatch` (after `videogame?: PandaVideogame;`, line ~189) add:
```ts
  mvp?: string | null;
  vod?: string | null;
  patch?: string | null;
  links?: Record<string, string>;
  wiki?: string | null;
```

- [ ] **Step 3: Verify types compile**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no new errors from `index.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/types/index.ts
git commit -m "feat(match): type per-game participants/extradata + match-level extras on PandaMatch"
```

---

## Task 3: Section registry (pure) + test

**Files:**
- Create: `frontend/app/match/_components/matchSections.ts`
- Test: `frontend/app/match/_components/matchSections.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/app/match/_components/matchSections.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveSections, SECTION_IDS } from './matchSections';

describe('resolveSections', () => {
  it('gives LoL the tier-1 sections including draft + playerStats', () => {
    const s = resolveSections('leagueoflegends', false);
    expect(s).toContain('draft');
    expect(s).toContain('playerStats');
    expect(s).toContain('header');
  });

  it('falls back to default (no draft/playerStats) for an unmapped wiki', () => {
    const s = resolveSections('counterstrike', false);
    expect(s).not.toContain('draft');
    expect(s).not.toContain('playerStats');
    expect(s[0]).toBe('header');
  });

  it('promotes stream to index 1 when live', () => {
    const live = resolveSections('leagueoflegends', true);
    expect(live[1]).toBe('stream');
    const notLive = resolveSections('leagueoflegends', false);
    expect(notLive[1]).not.toBe('stream');
  });

  it('only references known section ids', () => {
    for (const id of resolveSections('leagueoflegends', true)) {
      expect(SECTION_IDS).toContain(id);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm exec vitest run app/match/_components/matchSections.test.ts`
Expected: FAIL — `Cannot find module './matchSections'`.

- [ ] **Step 3: Implement the registry**

Create `frontend/app/match/_components/matchSections.ts`:
```ts
// Per-wiki section registry for the modular match detail page.
// A "tier" is a named preset; a wiki maps to a preset (or an explicit list).
// Sections each render from PandaMatch and return null when their data is absent.

export const SECTION_IDS = [
  'header', 'gameResults', 'draft', 'playerStats', 'externalLinks', 'stream', 'rosters',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

// Default order = finished-match order (stream sits low). When live, the shell
// promotes 'stream' to index 1 (right after 'header').
const PRESETS: Record<'tier1' | 'default', SectionId[]> = {
  tier1: ['header', 'gameResults', 'draft', 'playerStats', 'externalLinks', 'stream', 'rosters'],
  default: ['header', 'gameResults', 'externalLinks', 'stream', 'rosters'],
};

// Tier-1 wikis get the rich preset. Everything else uses 'default' (current
// behaviour minus player stats/draft) — so no game regresses.
const PRESET_BY_WIKI: Record<string, keyof typeof PRESETS> = {
  leagueoflegends: 'tier1',
  valorant: 'tier1',
  dota2: 'tier1',
};

export function resolveSections(wiki: string | undefined, isLive: boolean): SectionId[] {
  const presetKey = (wiki && PRESET_BY_WIKI[wiki]) || 'default';
  const base = [...PRESETS[presetKey]];
  if (isLive) {
    const i = base.indexOf('stream');
    if (i > 1) {
      base.splice(i, 1);
      base.splice(1, 0, 'stream');
    }
  }
  return base;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && pnpm exec vitest run app/match/_components/matchSections.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/match/_components/matchSections.ts frontend/app/match/_components/matchSections.test.ts
git commit -m "feat(match): per-wiki section registry with live stream promotion"
```

---

## Task 4: Player-stats column config + row builder (pure) + test

**Files:**
- Create: `frontend/app/match/_components/sections/statColumns.ts`
- Test: `frontend/app/match/_components/sections/statColumns.test.ts`

> Use the EXACT `extra` keys recorded in Task 0 (`_tier1-sample-keys.md`). The keys below match the research docs; replace any that the live sample contradicts.

- [ ] **Step 1: Write the failing test**

Create `frontend/app/match/_components/sections/statColumns.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getStatColumns, buildPlayerRows } from './statColumns';
import type { PandaGame } from '../../../types';

describe('getStatColumns', () => {
  it('returns LoL columns', () => {
    const cols = getStatColumns('leagueoflegends');
    expect(cols.map(c => c.key)).toContain('kda');
    expect(cols.map(c => c.key)).toContain('gold');
  });
  it('returns [] for an unknown wiki', () => {
    expect(getStatColumns('counterstrike')).toEqual([]);
  });
});

describe('buildPlayerRows', () => {
  const game = {
    participants: [
      { player: 'Faker', character: 'Azir', team: 1, kills: 5, deaths: 1, assists: 7, extra: { gold: 12000, cs: 250 } },
      { player: 'Chovy', character: 'Orianna', team: 2, kills: 3, deaths: 2, assists: 4, extra: { gold: 11000, cs: 260 } },
    ],
  } as unknown as PandaGame;

  it('splits rows by team and formats kda', () => {
    const { team1, team2 } = buildPlayerRows(game, 'leagueoflegends');
    expect(team1).toHaveLength(1);
    expect(team2).toHaveLength(1);
    expect(team1[0].cells.kda).toBe('5 / 1 / 7');
    expect(team1[0].cells.gold).toBe('12.0k');
  });

  it('returns empty teams when no participants', () => {
    const { team1, team2 } = buildPlayerRows({} as PandaGame, 'leagueoflegends');
    expect(team1).toEqual([]);
    expect(team2).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm exec vitest run app/match/_components/sections/statColumns.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/app/match/_components/sections/statColumns.ts`:
```ts
import type { PandaGame, PandaParticipant } from '../../../types';

export interface StatColumn {
  key: string;
  label: string; // i18n key suffix under pages_detail.match_detail.stat_col
  fmt: (p: PandaParticipant) => string;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(+v) ? +v : null;
const kfmt = (v: unknown): string => {
  const n = num(v);
  return n === null ? '-' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
};
const kda = (p: PandaParticipant): string =>
  [p.kills, p.deaths, p.assists].every(x => x == null) ? '-' : `${p.kills ?? 0} / ${p.deaths ?? 0} / ${p.assists ?? 0}`;
const ex = (p: PandaParticipant, key: string): unknown => (p.extra ? p.extra[key] : undefined);
const plain = (v: unknown): string => (v == null || v === '' ? '-' : String(v));

const COLUMNS: Record<string, StatColumn[]> = {
  leagueoflegends: [
    { key: 'character', label: 'champion', fmt: p => plain(p.character) },
    { key: 'kda', label: 'kda', fmt: kda },
    { key: 'cs', label: 'cs', fmt: p => plain(ex(p, 'cs')) },
    { key: 'gold', label: 'gold', fmt: p => kfmt(ex(p, 'gold')) },
    { key: 'damage', label: 'damage', fmt: p => kfmt(ex(p, 'damage')) },
  ],
  valorant: [
    { key: 'character', label: 'agent', fmt: p => plain(p.character) },
    { key: 'acs', label: 'acs', fmt: p => plain(ex(p, 'acs')) },
    { key: 'kda', label: 'kda', fmt: kda },
    { key: 'adr', label: 'adr', fmt: p => plain(ex(p, 'adr')) },
    { key: 'kast', label: 'kast', fmt: p => plain(ex(p, 'kast')) },
  ],
  dota2: [
    { key: 'character', label: 'hero', fmt: p => plain(p.character) },
    { key: 'kda', label: 'kda', fmt: kda },
    { key: 'netWorth', label: 'net_worth', fmt: p => kfmt(ex(p, 'netWorth')) },
    { key: 'gpm', label: 'gpm', fmt: p => plain(ex(p, 'gpm')) },
    { key: 'xpm', label: 'xpm', fmt: p => plain(ex(p, 'xpm')) },
  ],
};

export function getStatColumns(wiki: string): StatColumn[] {
  return COLUMNS[wiki] ?? [];
}

export interface PlayerRow {
  player: string;
  cells: Record<string, string>;
}

function rowsFor(parts: PandaParticipant[], cols: StatColumn[]): PlayerRow[] {
  return parts.map(p => ({
    player: p.player || '-',
    cells: Object.fromEntries(cols.map(c => [c.key, c.fmt(p)])),
  }));
}

export function buildPlayerRows(
  game: PandaGame,
  wiki: string,
): { team1: PlayerRow[]; team2: PlayerRow[]; columns: StatColumn[] } {
  const cols = getStatColumns(wiki);
  const parts = game?.participants ?? [];
  return {
    team1: rowsFor(parts.filter(p => p.team === 1), cols),
    team2: rowsFor(parts.filter(p => p.team === 2), cols),
    columns: cols,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && pnpm exec vitest run app/match/_components/sections/statColumns.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/match/_components/sections/statColumns.ts frontend/app/match/_components/sections/statColumns.test.ts
git commit -m "feat(match): per-wiki stat columns + pure player-row builder"
```

---

## Task 5: Shared section helpers module

Extract the cross-section helpers from `MatchDetailPageClient.tsx` so sections can reuse them.

**Files:**
- Create: `frontend/app/match/_components/sections/shared.tsx`
- Modify: `frontend/app/match/_components/MatchDetailPageClient.tsx` (remove the moved helpers, import from `./sections/shared` in Task 13)

- [ ] **Step 1: Create the shared module**

Create `frontend/app/match/_components/sections/shared.tsx` and move these from `MatchDetailPageClient.tsx` verbatim, exporting each:
- `parseGameWinner` (current lines ~44-53)
- `getRoleBadgeStyle` (current lines ~55-67)
- `formatDate`, `formatTime`, `formatDuration` (current lines ~169-187) — convert from inner consts to exported functions
- `SectionHeader` (current lines ~298-305)
- `TeamLogo` (current lines ~275-295) — TeamLogo uses `isDark`, `proxyImageUrl`, `pickThemeLogo`; make `isDark` a prop: `TeamLogo({ team, isDark, size, highlight })`.

Add the shared section props type at the top:
```tsx
import type { GameEntry } from '../../../lib/gameRegistry';
import type { PandaMatch } from '../../../types';

export interface MatchSectionProps {
  match: PandaMatch;
  game?: GameEntry;
  isLive: boolean;
  isDark: boolean;
}
```

- [ ] **Step 2: Verify it compiles in isolation**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: errors only about unused/duplicate symbols in `MatchDetailPageClient.tsx` (resolved in Task 13), none inside `shared.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/match/_components/sections/shared.tsx
git commit -m "refactor(match): extract shared section helpers (TeamLogo, formatters, SectionHeader)"
```

---

## Task 6: `PlayerStatsTable` section (new)

**Files:**
- Create: `frontend/app/match/_components/sections/PlayerStatsTable.tsx`

- [ ] **Step 1: Implement the component**

```tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';
import { SectionHeader, type MatchSectionProps } from './shared';
import { buildPlayerRows } from './statColumns';

export default function PlayerStatsTable({ match, game }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const wiki = game?.wiki ?? match.wiki ?? '';
  const games = (match.games ?? []).filter(g => (g.participants?.length ?? 0) > 0);
  const [idx, setIdx] = useState(0);
  if (games.length === 0) return null;

  const selected = games[Math.min(idx, games.length - 1)];
  const { team1, team2, columns } = buildPlayerRows(selected, wiki);
  if (columns.length === 0 || (team1.length === 0 && team2.length === 0)) return null;

  const Table = ({ rows }: { rows: typeof team1 }) => (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-text-muted uppercase tracking-wider text-[10px]">
          <th className="text-left py-1.5 px-2">{t('stat_col.player')}</th>
          {columns.map(c => <th key={c.key} className="text-right py-1.5 px-2">{t(`stat_col.${c.label}`)}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-[var(--color-border-primary)]/15">
            <td className="text-left py-1.5 px-2 font-semibold text-text-primary truncate">{r.player}</td>
            {columns.map(c => <td key={c.key} className="text-right py-1.5 px-2 tabular-nums text-text-secondary">{r.cells[c.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <section>
      <SectionHeader icon={TrendingUp} title={t('section_player_stats')} extra={
        games.length > 1 ? (
          <select value={idx} onChange={e => setIdx(+e.target.value)}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/40 rounded-md text-[11px] px-2 py-1 text-text-secondary">
            {games.map((g, i) => <option key={g.id} value={i}>{t('game_label')} {g.position}{g.map ? ` · ${g.map}` : ''}</option>)}
          </select>
        ) : undefined
      } />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]/40 p-2 overflow-x-auto"><Table rows={team1} /></div>
        <div className="rounded-xl border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]/40 p-2 overflow-x-auto"><Table rows={team2} /></div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no errors in `PlayerStatsTable.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/match/_components/sections/PlayerStatsTable.tsx
git commit -m "feat(match): PlayerStatsTable section (per-game, per-wiki columns)"
```

---

## Task 7: `DraftPanel` section (new) — `parseDraft` pure + component

**Files:**
- Create: `frontend/app/match/_components/sections/draft.ts` (pure)
- Create: `frontend/app/match/_components/sections/DraftPanel.tsx`
- Test: `frontend/app/match/_components/sections/draft.test.ts`

> Use the per-game `extradata` ban/pick keys recorded in Task 0. Common Liquipedia keys: `extradata.team1bans`/`team2bans` (or `t1bans`/`t2bans`) as comma/`,`-joined strings, and per-participant `character` for picks. The builder below reads bans from those keys and picks from `participants`; adjust key names to the Task 0 findings.

- [ ] **Step 1: Write the failing test**

Create `frontend/app/match/_components/sections/draft.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseDraft } from './draft';
import type { PandaGame } from '../../../types';

describe('parseDraft', () => {
  it('reads bans and picks for both teams', () => {
    const game = {
      extradata: { team1bans: 'Yuumi,Kalista', team2bans: 'Zeri,Renata' },
      participants: [
        { player: 'Faker', character: 'Azir', team: 1 },
        { player: 'Chovy', character: 'Orianna', team: 2 },
      ],
    } as unknown as PandaGame;
    const d = parseDraft(game);
    expect(d.team1.bans).toEqual(['Yuumi', 'Kalista']);
    expect(d.team1.picks).toEqual(['Azir']);
    expect(d.team2.picks).toEqual(['Orianna']);
  });

  it('returns null when there is no draft data', () => {
    expect(parseDraft({} as PandaGame)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm exec vitest run app/match/_components/sections/draft.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `draft.ts`**

```ts
import type { PandaGame } from '../../../types';

export interface TeamDraft { bans: string[]; picks: string[]; }
export interface Draft { team1: TeamDraft; team2: TeamDraft; }

const splitList = (v: unknown): string[] =>
  typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : Array.isArray(v) ? v.map(String) : [];

function bansFor(ed: Record<string, unknown> | undefined, keys: string[]): string[] {
  if (!ed) return [];
  for (const k of keys) if (ed[k] != null) return splitList(ed[k]);
  return [];
}

export function parseDraft(game: PandaGame): Draft | null {
  const ed = game?.extradata;
  const parts = game?.participants ?? [];
  const t1bans = bansFor(ed, ['team1bans', 't1bans']);
  const t2bans = bansFor(ed, ['team2bans', 't2bans']);
  const t1picks = parts.filter(p => p.team === 1 && p.character).map(p => p.character as string);
  const t2picks = parts.filter(p => p.team === 2 && p.character).map(p => p.character as string);
  if (!t1bans.length && !t2bans.length && !t1picks.length && !t2picks.length) return null;
  return { team1: { bans: t1bans, picks: t1picks }, team2: { bans: t2bans, picks: t2picks } };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && pnpm exec vitest run app/match/_components/sections/draft.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `DraftPanel.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Swords } from 'lucide-react';
import { SectionHeader, type MatchSectionProps } from './shared';
import { parseDraft } from './draft';

export default function DraftPanel({ match }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const games = (match.games ?? []).filter(g => parseDraft(g) !== null);
  const [idx, setIdx] = useState(0);
  if (games.length === 0) return null;

  const draft = parseDraft(games[Math.min(idx, games.length - 1)])!;
  const Side = ({ d, align }: { d: typeof draft.team1; align: 'left' | 'right' }) => (
    <div className={align === 'right' ? 'text-right' : ''}>
      {d.picks.length > 0 && <p className="text-xs text-text-secondary mb-1"><span className="text-text-muted">{t('draft_picks')}:</span> {d.picks.join(', ')}</p>}
      {d.bans.length > 0 && <p className="text-xs text-text-muted"><span className="opacity-60">{t('draft_bans')}:</span> <span className="line-through opacity-70">{d.bans.join(', ')}</span></p>}
    </div>
  );

  return (
    <section>
      <SectionHeader icon={Swords} title={t('section_draft')} extra={
        games.length > 1 ? (
          <select value={idx} onChange={e => setIdx(+e.target.value)}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/40 rounded-md text-[11px] px-2 py-1 text-text-secondary">
            {games.map((g, i) => <option key={g.id} value={i}>{t('game_label')} {g.position}</option>)}
          </select>
        ) : undefined
      } />
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]/40 p-4">
        <Side d={draft.team1} align="left" />
        <Side d={draft.team2} align="right" />
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Verify + commit**

Run: `cd frontend && pnpm exec tsc --noEmit` → no errors.
```bash
git add frontend/app/match/_components/sections/draft.ts frontend/app/match/_components/sections/draft.test.ts frontend/app/match/_components/sections/DraftPanel.tsx
git commit -m "feat(match): DraftPanel section + pure parseDraft"
```

---

## Task 8: `ExternalStatsLinks` section (new) — `buildExternalLinks` pure + component

**Files:**
- Create: `frontend/app/match/_components/sections/externalLinks.ts` (pure)
- Create: `frontend/app/match/_components/sections/ExternalStatsLinks.tsx`
- Test: `frontend/app/match/_components/sections/externalLinks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildExternalLinks } from './externalLinks';

describe('buildExternalLinks', () => {
  it('maps known providers to labels and keeps order', () => {
    const out = buildExternalLinks({ dotabuff: 'https://d', stratz: 'https://s', unknownx: 'https://u' });
    expect(out.map(l => l.label)).toEqual(['Dotabuff', 'STRATZ', 'unknownx']);
    expect(out[0].url).toBe('https://d');
  });
  it('returns [] for empty/undefined', () => {
    expect(buildExternalLinks(undefined)).toEqual([]);
    expect(buildExternalLinks({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm exec vitest run app/match/_components/sections/externalLinks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `externalLinks.ts`**

```ts
export interface ExternalLink { key: string; label: string; url: string; }

const LABELS: Record<string, string> = {
  dotabuff: 'Dotabuff', stratz: 'STRATZ', datdota: 'DatDota',
  opgg: 'OP.GG', 'op.gg': 'OP.GG', leagueoflegends: 'op.gg',
  hltv: 'HLTV', vlr: 'VLR.gg', faceit: 'FACEIT',
};

export function buildExternalLinks(links: Record<string, string> | undefined): ExternalLink[] {
  if (!links) return [];
  return Object.entries(links)
    .filter(([, url]) => typeof url === 'string' && url.startsWith('http'))
    .map(([key, url]) => ({ key, label: LABELS[key] ?? key, url }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && pnpm exec vitest run app/match/_components/sections/externalLinks.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `ExternalStatsLinks.tsx`**

```tsx
'use client';
import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { SectionHeader, type MatchSectionProps } from './shared';
import { buildExternalLinks } from './externalLinks';

export default function ExternalStatsLinks({ match }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const links = buildExternalLinks(match.links);
  if (links.length === 0) return null;
  return (
    <section>
      <SectionHeader icon={ExternalLink} title={t('section_external_stats')} />
      <div className="flex flex-wrap gap-2">
        {links.map(l => (
          <a key={l.key} href={l.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border-primary)]/40 bg-[var(--color-bg-secondary)]/60 text-text-secondary hover:text-accent hover:border-accent/40 transition-colors">
            {l.label} <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Verify + commit**

Run: `cd frontend && pnpm exec tsc --noEmit` → no errors.
```bash
git add frontend/app/match/_components/sections/externalLinks.ts frontend/app/match/_components/sections/externalLinks.test.ts frontend/app/match/_components/sections/ExternalStatsLinks.tsx
git commit -m "feat(match): ExternalStatsLinks section + pure buildExternalLinks"
```

---

## Task 9: Extract `MatchHeader` section (hero scoreboard)

**Files:**
- Create: `frontend/app/match/_components/sections/MatchHeader.tsx`

- [ ] **Step 1: Create the component from the existing hero**

Move the hero `<section>` JSX currently at `MatchDetailPageClient.tsx` lines ~327-593 (the `HERO — SCOREBOARD` block) into `MatchHeader.tsx` as the return value. The component signature:
```tsx
'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Trophy, ChevronRight, MapPin, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import LiquipediaBadge from '../../../components/common/LiquipediaBadge';
import { proxyImageUrl } from '../../../lib/imageProxy';
import { pickThemeLogo } from '../../../hooks/useIsDarkTheme';
import { teamHref } from '../../../lib/gameLinks';
import { TeamLogo, formatDate, formatTime, parseGameWinner, type MatchSectionProps } from './shared';

export default function MatchHeader({ match, game, isLive, isDark }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  // derive homeTeam/awayTeam/homeScore/awayScore/isHomeWinner/isAwayWinner/isFinished/statusKey
  // (copy the derivations from the current component, lines ~222-240)
  // Replace getTeamUrl(...) with: teamHref(game?.slug, team?.template || team?.slug || String(team?.id), match.wiki)
  // ... hero JSX (lines ~327-593) ...
}
```
Replace the legacy `getTeamUrl` calls (lines ~433-435, ~523-525) with `teamHref(game?.slug, team?.template || team?.slug || String(team?.id), match.wiki ?? undefined)`. Pass `isDark` into `<TeamLogo>`.

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no errors in `MatchHeader.tsx` (the old file still has the original copy until Task 13).

- [ ] **Step 3: Commit**

```bash
git add frontend/app/match/_components/sections/MatchHeader.tsx
git commit -m "refactor(match): extract MatchHeader section + game-first team links"
```

---

## Task 10: Extract `GameResults` section (game-by-game)

**Files:**
- Create: `frontend/app/match/_components/sections/GameResults.tsx`

- [ ] **Step 1: Create the component**

Move the `GAME-BY-GAME RESULTS` `<section>` JSX (current lines ~602 to the end of that section block) into `GameResults.tsx`. Signature:
```tsx
'use client';
import { useTranslations } from 'next-intl';
import { Gamepad2, Trophy, Shield } from 'lucide-react';
import { proxyImageUrl } from '../../../lib/imageProxy';
import { pickThemeLogo } from '../../../hooks/useIsDarkTheme';
import { SectionHeader, parseGameWinner, type MatchSectionProps } from './shared';

export default function GameResults({ match, isDark }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  if (!match.games || match.games.length === 0) return null;
  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;
  // ... the existing game-by-game JSX, using homeTeam/awayTeam, parseGameWinner, pickThemeLogo(isDark,...) ...
}
```

- [ ] **Step 2: Verify + commit**

Run: `cd frontend && pnpm exec tsc --noEmit` → no errors in `GameResults.tsx`.
```bash
git add frontend/app/match/_components/sections/GameResults.tsx
git commit -m "refactor(match): extract GameResults section"
```

---

## Task 11: Extract `StreamPlayer` section (streaming)

**Files:**
- Create: `frontend/app/match/_components/sections/StreamPlayer.tsx`

- [ ] **Step 1: Create the component**

Move the streaming `<section>` (the block rendering the Twitch/YouTube iframe + stream selector buttons; locate by the `section_streaming` translation usage and the `selectedStreamIdx` state) into `StreamPlayer.tsx`. It owns its own `selectedStreamIdx` state:
```tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tv, Play } from 'lucide-react';
import { SectionHeader, type MatchSectionProps } from './shared';

export default function StreamPlayer({ match }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const [selectedStreamIdx, setSelectedStreamIdx] = useState(0);
  const sortedStreams = [...(match.streams_list || [])].sort((a, b) => {
    if (a.official && !b.official) return -1; if (!a.official && b.official) return 1;
    if (a.main && !b.main) return -1; if (!a.main && b.main) return 1; return 0;
  });
  if (sortedStreams.length === 0) return null;
  // ... existing iframe + selector JSX (getTwitchChannel/getYoutubeId helpers move here) ...
}
```

- [ ] **Step 2: Verify + commit**

Run: `cd frontend && pnpm exec tsc --noEmit` → no errors in `StreamPlayer.tsx`.
```bash
git add frontend/app/match/_components/sections/StreamPlayer.tsx
git commit -m "refactor(match): extract StreamPlayer section"
```

---

## Task 12: Extract `RostersPanel` section (teams & rosters)

**Files:**
- Create: `frontend/app/match/_components/sections/RostersPanel.tsx`

- [ ] **Step 1: Create the component**

The rosters block depends on `teamsData` (loaded in the shell). Pass it via a dedicated prop:
```tsx
'use client';
import { useTranslations } from 'next-intl';
import { Users, Trophy } from 'lucide-react';
import { proxyImageUrl } from '../../../lib/imageProxy';
import { getRoleBadgeStyle, SectionHeader, type MatchSectionProps } from './shared';

interface RostersProps extends MatchSectionProps { teamsData: any[]; }

export default function RostersPanel({ match, teamsData }: RostersProps) {
  const t = useTranslations('pages_detail.match_detail');
  if (!match.opponents || match.opponents.length !== 2 || teamsData.length !== 2) return null;
  // ... existing rosters JSX (the teams & rosters section), using getRoleBadgeStyle/proxyImageUrl ...
}
```

- [ ] **Step 2: Verify + commit**

Run: `cd frontend && pnpm exec tsc --noEmit` → no errors in `RostersPanel.tsx`.
```bash
git add frontend/app/match/_components/sections/RostersPanel.tsx
git commit -m "refactor(match): extract RostersPanel section"
```

---

## Task 13: Shell — render via registry + 45s polling

**Files:**
- Modify: `frontend/app/match/_components/MatchDetailPageClient.tsx`

- [ ] **Step 1: Replace the giant return with the section renderer**

Keep the existing data effects (ads, teams, initial load) and add live polling. Remove the moved helpers/JSX (now in `sections/*`). New body:
```tsx
'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '../../contexts/ToastContext';
import { LiveMatch, Advertisement } from '../../types';
import { matchService } from '../../services/matchService';
import { teamService } from '../../services/teamService';
import { advertisementService } from '../../services/advertisementService';
import AdColumn from '../../components/ads/AdColumn';
import { SportsEventSchema, BreadcrumbSchema } from '../../components/seo/StructuredData';
import { generateBreadcrumbs } from '../../lib/breadcrumbHelper';
import { prewarmFromData } from '../../lib/imageProxy';
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme';
import { gameByWiki } from '../../lib/gameRegistry';
import { resolveSections, type SectionId } from './matchSections';
import type { MatchSectionProps } from './sections/shared';
import MatchHeader from './sections/MatchHeader';
import GameResults from './sections/GameResults';
import StreamPlayer from './sections/StreamPlayer';
import DraftPanel from './sections/DraftPanel';
import PlayerStatsTable from './sections/PlayerStatsTable';
import RostersPanel from './sections/RostersPanel';
import ExternalStatsLinks from './sections/ExternalStatsLinks';
import { Swords } from 'lucide-react';

const POLL_MS = 45000;

interface Props { matchId: string; wiki?: string; initialMatch?: LiveMatch | null; }

export default function MatchDetailPageClient({ matchId, wiki, initialMatch }: Props) {
  const t = useTranslations('pages_detail.match_detail');
  const tToast = useTranslations('toast');
  const isDark = useIsDarkTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const hasRedirected = useRef(false);
  const [match, setMatch] = useState<LiveMatch | null>(initialMatch || null);
  const [loading, setLoading] = useState(!initialMatch);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [isSubscribed] = useState(false);
  const [teamsData, setTeamsData] = useState<any[]>([]);

  useEffect(() => { prewarmFromData([match, teamsData]); }, [match, teamsData]);

  useEffect(() => {
    (async () => {
      try { setIsLoadingAds(true); setAds(await advertisementService.getActiveAdvertisements()); }
      catch (e) { console.error(e); } finally { setIsLoadingAds(false); }
    })();
  }, []);

  // keep the existing teams-loading effect verbatim (depends on [match])
  useEffect(() => {
    const loadTeams = async (data: LiveMatch) => {
      if (data.opponents && data.opponents.length === 2) {
        const matchWiki = data.wiki || wiki;
        const opponents = data.opponents.filter(o => o.opponent);
        if (opponents.length === 0) return;
        try {
          const teams = (await Promise.all(opponents.map(async (o) => {
            const template = o.opponent?.template;
            if (template && matchWiki) { try { return await teamService.getTeamByTemplate(template, matchWiki); } catch {} }
            try { return await teamService.getTeamById(o.opponent!.id); } catch { return null; }
          }))).filter(Boolean);
          setTeamsData(teams);
        } catch (e) { console.error('Error loading team details:', e); }
      }
    };
    if (match) loadTeams(match);
  }, [match]);

  useEffect(() => {
    if (initialMatch) return;
    (async () => {
      try { setLoading(true); setMatch(await matchService.getMatchById(matchId, wiki)); }
      catch (err) {
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          showToast({ message: tToast('match_not_available'),
            linkUrl: `https://liquipedia.net/${wiki || 'valorant'}/Main_Page`,
            linkLabel: tToast('view_on_liquipedia'), duration: 10000 });
          router.back();
        }
      } finally { setLoading(false); }
    })();
  }, [matchId, initialMatch]);

  // Live polling: refetch every 45s while running.
  useEffect(() => {
    if (match?.status !== 'running') return;
    const id = setInterval(async () => {
      try { const fresh = await matchService.getMatchById(matchId, wiki); if (fresh) setMatch(fresh); } catch {}
    }, POLL_MS);
    return () => clearInterval(id);
  }, [match?.status, matchId, wiki]);

  const memoizedAds = useMemo(() => ads, [ads]);

  if (loading || !match) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-14 h-14 mx-auto mb-5">
            <div className="absolute inset-0 border border-border-primary rounded-xl" />
            <div className="absolute inset-0 border border-transparent border-t-accent rounded-xl animate-spin" />
            <Swords className="absolute inset-0 m-auto w-5 h-5 text-accent/50" />
          </div>
          <p className="text-text-muted text-xs uppercase tracking-[0.2em] font-semibold">{t('loading')}</p>
        </div>
      </div>
    );
  }

  const game = gameByWiki(match.wiki || wiki || '');
  const isLive = match.status === 'running';
  const sectionProps: MatchSectionProps = { match, game, isLive, isDark };
  const sections = resolveSections(match.wiki || wiki || undefined, isLive);

  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
  const matchUrl = `${siteUrl}/${game?.slug ?? 'match'}/match/${matchId}`;
  const breadcrumbs = generateBreadcrumbs([
    { name: t('breadcrumb_home'), url: '/' },
    { name: t('breadcrumb_matchs'), url: '/match' },
    { name: `${homeTeam?.name || 'Match'} vs ${awayTeam?.name || 'Match'}`, url: matchUrl },
  ]);

  const renderSection = (id: SectionId) => {
    switch (id) {
      case 'header': return <MatchHeader key={id} {...sectionProps} />;
      case 'gameResults': return <GameResults key={id} {...sectionProps} />;
      case 'draft': return <DraftPanel key={id} {...sectionProps} />;
      case 'playerStats': return <PlayerStatsTable key={id} {...sectionProps} />;
      case 'externalLinks': return <ExternalStatsLinks key={id} {...sectionProps} />;
      case 'stream': return <StreamPlayer key={id} {...sectionProps} />;
      case 'rosters': return <RostersPanel key={id} {...sectionProps} teamsData={teamsData} />;
      default: return null;
    }
  };

  const headerIds = sections.filter(s => s === 'header');
  const bodyIds = sections.filter(s => s !== 'header');

  return (
    <div className="min-h-screen bg-bg-primary">
      <SportsEventSchema name={`${homeTeam?.name || 'Match'} vs ${awayTeam?.name || 'Match'}`}
        description={`${match.videogame?.name || 'Esport'} - ${match.league?.name || ''}`}
        startDate={match.begin_at || new Date().toISOString()} endDate={match.end_at || undefined}
        url={matchUrl} location={match.tournament?.region || undefined} image={homeTeam?.image_url || undefined}
        teams={[...(homeTeam ? [{ name: homeTeam.name, logo: homeTeam.image_url || undefined }] : []),
                ...(awayTeam ? [{ name: awayTeam.name, logo: awayTeam.image_url || undefined }] : [])]} />
      <BreadcrumbSchema items={breadcrumbs} />
      <h1 className="sr-only">{homeTeam?.name || 'Match'} vs {awayTeam?.name || 'Match'} - {match.videogame?.name} - {match.tournament?.name}</h1>
      {headerIds.map(renderSection)}
      <main className="container mx-auto px-4 pt-8 md:pt-10 pb-16">
        <div className="flex gap-8">
          <div className="flex-1 min-w-0 space-y-10">{bodyIds.map(renderSection)}</div>
          <AdColumn ads={memoizedAds} isSubscribed={isSubscribed} isLoading={isLoadingAds} />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify the whole frontend compiles and tests pass**

Run: `cd frontend && pnpm exec tsc --noEmit` → no errors.
Run: `cd frontend && pnpm test` → all green.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/match/_components/MatchDetailPageClient.tsx
git commit -m "refactor(match): registry-driven shell + 45s live polling + stream promotion"
```

---

## Task 14: i18n — add new section/column keys to all 5 locales

**Files:**
- Modify: `frontend/public/locales/{fr,en,es,de,it}.json` (under `pages_detail.match_detail`)

- [ ] **Step 1: Add the keys**

Under `pages_detail.match_detail` in each locale, add (values per language):
```json
"section_player_stats": "...", "section_draft": "...", "section_external_stats": "...",
"draft_picks": "...", "draft_bans": "...",
"stat_col": { "player": "...", "champion": "...", "agent": "...", "hero": "...",
  "kda": "K/D/A", "cs": "CS", "gold": "...", "damage": "...",
  "acs": "ACS", "adr": "ADR", "kast": "KAST",
  "net_worth": "...", "gpm": "GPM", "xpm": "XPM" }
```
French values: `section_player_stats`="Statistiques joueurs", `section_draft`="Draft", `section_external_stats`="Stats détaillées", `draft_picks`="Picks", `draft_bans`="Bans", `stat_col.champion`="Champion", `stat_col.agent`="Agent", `stat_col.hero`="Héros", `stat_col.gold`="Or", `stat_col.damage`="Dégâts", `stat_col.net_worth`="Valeur nette", `stat_col.player`="Joueur". Translate analogously for en/es/de/it.

- [ ] **Step 2: Verify JSON validity**

Run: `cd frontend && node -e "['fr','en','es','de','it'].forEach(l=>JSON.parse(require('fs').readFileSync('public/locales/'+l+'.json','utf8')))" && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add frontend/public/locales/fr.json frontend/public/locales/en.json frontend/public/locales/es.json frontend/public/locales/de.json frontend/public/locales/it.json
git commit -m "i18n(match): labels for player-stats/draft/external-stats sections"
```

---

## Task 15: Full verification

- [ ] **Step 1: Backend**

Run: `cd backend-go && go build ./... && go test ./internal/models/`
Expected: build OK, tests PASS.

- [ ] **Step 2: Frontend**

Run: `cd frontend && pnpm test && pnpm exec tsc --noEmit && pnpm build`
Expected: tests PASS, no type errors, build succeeds.

- [ ] **Step 3: Manual check (stack up)**

Open `http://localhost:3002/lol/match/<match2id>` for a finished LoL match with participants:
- player-stats table renders with champion + K/D/A + CS + Gold columns;
- draft section shows picks/bans;
- external-stats links render if `match.links` present.
Open a CS2 match (`/cs/match/<id>`): page still renders (header, game results, stream, rosters), no player-stats/draft section, no console errors.
Open a running match: a LIVE badge shows and the stream sits directly under the header; scores update within ~45s without a manual refresh.

- [ ] **Step 4: Final commit (if any docs/cleanup)**

```bash
git add -A && git commit -m "chore(match): Tier-1 detail page verification pass" || echo "nothing to commit"
```

---

## Self-review notes (for the executor)

- **Spec coverage:** §2 backend extras → Task 1; per-player contract already flows (Task 0 verifies keys → Task 4). §3 registry → Task 3; shell → Task 13. §4 sections → Tasks 6-12. §5 columns → Task 4. §6 live/data-flow → Task 13 polling + existing SSR `initialMatch`. §7 graceful degradation → every section returns `null` without data + `default` preset keeps non-Tier-1 games working; i18n → Task 14; SEO `notFound()` unchanged (server `page.tsx`). §8 testing → pure-helper `.ts` tests (Tasks 1,3,4,7,8) + manual render (Task 15).
- **Out of scope (unchanged):** Tier 2/3 wiring, Smash, `mapveto`/`hassubmatches`, third-party live telemetry.
- **Key risk:** exact `extra`/`extradata` key names — Task 0 locks them before Task 4/7; if the stack can't start, the research-doc keys are the fallback and must be re-verified against a live match.
- **No-regression guard:** `resolveSections` defaults unmapped wikis to `default` (header/gameResults/externalLinks/stream/rosters), so the other 7 games keep their current page minus nothing they had (they never had player-stats/draft).
