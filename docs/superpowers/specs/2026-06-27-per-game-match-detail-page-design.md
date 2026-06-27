# Per-Game Match Detail Page — Design Spec

**Date:** 2026-06-27
**Branch:** `liquipedia`
**Status:** Approved (brainstorming) — ready for implementation plan

## Goal

Turn the match detail page (`/[game]/match/[id]`) into a **modular, per-game** experience that surfaces the maximum match info each game actually exposes via Liquipedia, instead of the current game-agnostic page (banner + generic per-game cards + rosters + streams).

## Context & research basis

Research lives in `docs/superpowers/research/` (one `match-data-<slug>.md` per game + `README.md` synthesis). Three findings drive this design:

1. **No real-time in-game telemetry, any game.** Liquipedia is editor/bot-maintained. "Live" = match status `running` + series/map scores updated by hand (caught by our poller, ~2–8 min) + stream embed. No kill feed / tick-by-tick KDA. A true live feed would need a third-party source (HLTV, Riot) — explicitly out of scope.
2. **Three richness tiers.**
   - **Tier 1 — rich per-player (post-game, MatchPage-gated, partial coverage):** LoL, Valorant, Dota2.
   - **Tier 2 — team/map only (no per-player stats):** CS2, R6, Overwatch, CoD, Rocket League.
   - **Tier 3 — sparse:** EA FC; Smash (solo-player, separate integration).
3. **Free wins:** the backend already fetches but **drops** match-level `extradata` (`mvp`, `casters`, `mapveto`, `hassubmatches`), `vod`, `patch`, `links`. Per-game/per-player `extradata` already reaches the frontend untyped (`NormalizedGameEntry.ExtraData`, `NormalizedParticipant.Extra`). Most of the "max info" is achievable with zero extra API budget — normalization typing + frontend rendering.

## Decisions locked during brainstorming

- **Scope:** full modular architecture (section registry + backend data contract) + **implement Tier 1 (LoL, Valorant, Dota2) end-to-end**. Tier 2, Tier 3, and Smash are follow-on specs absorbed by the same architecture.
- **Architecture:** **section registry** (composable sections + per-game preset), not 3 fixed templates and not 10 bespoke components. A "tier" is a named preset of sections; a game may override its section list.
- **Live behaviour:** when `status==='running'`, client re-fetches the match every **45s**, shows an animated **LIVE badge**, and **promotes the stream player to the top**.
- **Smash 10th-game roster change is NOT part of this spec.** Frontend `gameRegistry` and backend `GameWikiMapping` keep `mlbb` for now; Smash is a separate scoped integration (see `docs/superpowers/research/match-data-smash.md` and the `tenth-game-decision` memory).

## Architecture

### Backend — data contract (Go)

File: `backend-go/internal/models/liquipedia_match.go`.

Add match-level fields to `NormalizedMatch`, populated in `NormalizeLiqMatch` from data already on `LiqMatch` / its `ExtraData`:

```go
Mvp   *string           `json:"mvp,omitempty"`    // from match-level extradata.mvp
Vod   *string           `json:"vod,omitempty"`    // from LiqMatch.Vod (currently dropped)
Patch *string           `json:"patch,omitempty"`  // from LiqMatch.Patch (currently dropped)
Links map[string]string `json:"links,omitempty"`  // external stats: dotabuff/stratz/opgg/...
```

(`mapveto` is Tier 2 — added when Tier 2 ships. `hassubmatches` is Tier 3 / EA FC.)

The per-game / per-player scaffolding already exists: `NormalizedGameEntry.{Map, Scores, Participants, ExtraData}` and `NormalizedParticipant.{Player, Character, Role, Team, Kills, Deaths, Assists, Extra}`. The Tier-1 work is to **guarantee population** of `Participants` + `Extra` + per-game `ExtraData` from the Liquipedia MatchPage, following a documented per-wiki key contract:

| wiki | `Character` | `Extra` keys |
|------|-------------|--------------|
| `leagueoflegends` | champion | `gold, cs, damage, items[], runes{keystone,secondary}, spells[], level, kp` |
| `valorant` | agent | `acs, adr, kast, hs, firstKills, firstDeaths` |
| `dota2` | hero | `netWorth, gpm, xpm, lastHits, denies, items[], level, facet` |

Per-game `NormalizedGameEntry.ExtraData` (Tier 1): `side` (blue/red, radiant/dire), `bans[]`, `vetophase` (draft order), `objectives` (towers/dragons/barons | towers/roshan), `length`.

**Principle:** backend exposes, frontend renders. Keys absent from the Liquipedia payload stay absent (no fabrication); the frontend degrades gracefully.

### Frontend — section registry

`MatchDetailPageClient` (`frontend/app/match/_components/MatchDetailPageClient.tsx`) becomes a **shell**:

1. receives `matchId`, `wiki`, `initialMatch` (already passed by the server `page.tsx`);
2. resolves the `GameEntry` via `gameByWiki(wiki)` (`frontend/app/lib/gameRegistry.ts`);
3. looks up the section list for that game and renders sections in order;
4. owns match state + the live polling loop, passing `{ match, game, isLive }` to each section.

New config `frontend/app/match/_components/matchSections.ts`:

```ts
type SectionId = 'header' | 'stream' | 'gameTabs' | 'draft' | 'playerStats'
               | 'veto' | 'rosters' | 'externalLinks';

// Default order = finished-match order: stream (VOD) sits low. When the match is
// live, the shell promotes 'stream' to index 1 (right after 'header').
const PRESETS: Record<'tier1'|'tier2'|'tier3', SectionId[]> = {
  tier1: ['header','gameTabs','draft','playerStats','stream','rosters','externalLinks'],
  tier2: ['header','veto','gameTabs','stream','rosters','externalLinks'],
  tier3: ['header','gameTabs','stream','rosters'],
};

// wiki → preset (overrides allowed by mapping to an explicit SectionId[])
const SECTIONS_BY_WIKI: Record<string, SectionId[] | keyof typeof PRESETS> = {
  leagueoflegends: 'tier1', valorant: 'tier1', dota2: 'tier1',
  // tier2/tier3 wired when those specs ship
};
```

Section component contract (`frontend/app/match/_components/sections/`):

```ts
interface MatchSectionProps { match: PandaMatch; game: GameEntry; isLive: boolean; }
// Every section returns null when its required data is absent.
```

### Sections to build (Tier 1)

- **MatchHeader** — refactor of the existing info banner + matchup/score; animated **LIVE badge** when `isLive`.
- **StreamPlayer** — extracted from the current streaming section. Sits low in the default order; the shell moves it to index 1 (right under the header) when `isLive`.
- **GameTabs** — selector across games in the series; shows the selected game's side, length, score, winner.
- **DraftPanel** — picks/bans per team with draft order (LoL/Dota2). Returns null for Valorant (no draft phase).
- **PlayerStatsTable** — one row per player for the selected game; columns driven by per-game config (below).
- **RostersPanel** — refactor of the existing teams & rosters section.
- **ExternalStatsLinks** — "Full stats →" buttons built from `match.links`.

### PlayerStatsTable — per-game columns

One component, config `STAT_COLUMNS[wiki] = { key, label, fmt }[]`:

- **leagueoflegends:** Champion · K/D/A · CS · Gold · Damage · Items · Runes · Spells
- **valorant:** Agent · ACS · K/D/A · ADR · KAST · HS% · FK
- **dota2:** Hero · K/D/A · Net Worth · GPM/XPM · LH/DN · Items

A column whose data is missing is hidden. No rows render if `game.participants` is empty (section returns null).

### Live & data flow

- Server `page.tsx` already fetches `/api/matches/:id?wiki=` (`revalidate: 60`), `notFound()` on 404, and passes `initialMatch` → shell uses it as initial state (no double fetch on first paint).
- When `status==='running'`: `setInterval(45s)` calls `matchService.getMatchById(id, wiki)` and updates state; cleared on finished/unmount. (No RTK Query for matches; matchService is axios-based.)

### Robustness, i18n, SEO

- **Graceful degradation:** partial MatchPage coverage → Draft/PlayerStats self-hide; the page falls back to Header+Stream+GameTabs+Rosters (≈ current experience). Never an empty section shell.
- **i18n:** all section/column labels added to the 5 locales (fr, en, es, de, it).
- **SEO:** `notFound()` on backend 404 preserved (policy §18.1); static content server-rendered, polling is client-only.

## Testing

- **Vitest** per section: renders with data, returns null without data, correct columns per game. Plus a registry consistency test (every wired wiki → valid preset; every `SectionId` → a component).
- **Go** normalizer tests: `mvp/vod/patch/links` populated; per-player `Extra` keys for LoL/Valorant/Dota2 from fixtures. ⚠️ Mind the known `internal/services` test-compile breakage (see `services-test-compile-breakage` memory) — keep normalizer tests in `internal/models`.

## File structure

**Backend**
- Modify: `backend-go/internal/models/liquipedia_match.go` — add match-level fields + populate Tier-1 `Participants`/`Extra`/per-game `ExtraData`.
- Test: `backend-go/internal/models/liquipedia_match_test.go` (new or extended) with fixtures.

**Frontend**
- Modify: `frontend/app/match/_components/MatchDetailPageClient.tsx` — shell + polling.
- Create: `frontend/app/match/_components/matchSections.ts` — registry + presets.
- Create: `frontend/app/match/_components/sections/{MatchHeader,StreamPlayer,GameTabs,DraftPanel,PlayerStatsTable,RostersPanel,ExternalStatsLinks}.tsx`.
- Create: `frontend/app/match/_components/sections/statColumns.ts` — per-wiki column config.
- Modify: frontend types in `frontend/app/types/index.ts` — extend `PandaMatch`/`PandaGame` with `mvp`, `vod`, `patch`, `links`, and typed `participants`/`extradata` where useful (kept compatible).
- Modify: locale files — section/column labels in fr/en/es/de/it.
- Test: `*.test.tsx` per section + a `matchSections` consistency test (Vitest).

## Out of scope

- Tier 2 (CS2/R6/OW/CoD/RL) and Tier 3 (EA FC) section wiring — follow-on specs (architecture already supports them via presets).
- Smash 10th-game integration (solo-player model, `[[game::ultimate]]` filter, characters/stocks parser, "favorite players").
- Any third-party live telemetry source (HLTV/Riot).
- `mapveto` / `hassubmatches` backend fields (Tier 2 / Tier 3).
