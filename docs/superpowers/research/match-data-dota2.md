# Dota 2 — Match data (Liquipedia wiki `dota2`)

> Internal acronym `dota2` · Liquipedia wiki `dota2` · frontend slug `dota2`.
> Scope: everything the Liquipedia API v3 `match` datapoint exposes for Dota 2, to inform a max-info per-match detail page.

**Sources used (authoritative, all citable):**

- Our parsers: `backend-go/internal/models/liquipedia_match.go`; query field list `LiqMatchQueryFields` in `backend-go/internal/services/liquipedia_poller.go:47`; request params in `backend-go/internal/handlers/matches.go:209-219` and `backend-go/internal/services/liquipedia_poller.go:526-600`.
- Liquipedia open-source Lua modules (define exactly what the API stores/renders), from `github.com/Liquipedia/Lua-Modules`:
  - `lua/wikis/dota2/MatchGroup/Input/Custom/MatchPage.lua` — rich "Match Page" parser (per-player stats, draft, objectives).
  - `lua/wikis/dota2/MatchGroup/Input/Custom.lua` — game/match extradata storage keys.
  - `lua/wikis/dota2/MatchGroup/Input/Custom/Normal.lua` — basic (manual) match list parser.
  - `lua/wikis/dota2/MatchPage.lua` — detailed match-page rendering (confirms displayed fields).
  - `lua/wikis/commons/MatchGroup/Util.lua` — parsed match2 record type definitions.

**Rate-limit note:** Per task constraints, no calls were made to `api.liquipedia.net`. Direct WebFetch of `liquipedia.net` HTML pages (Help:LiquipediaDB/Match, live match pages) returned HTTP 429 and could not be read. The GitHub Lua-Modules are the canonical definition of what the API serves and were used instead; they are the same code that ingests and renders this data on Liquipedia.

**`live?` legend:** **L** = updates during the match (editor- or import-driven, near-live; *not* tick telemetry) · **F** = final / post-game only · **?** = uncertain.

---

## 1. Identity & opponent format

- **Opponent format: 2 teams (5v5), team vs team.** Standard mode is `team` (`MatchFunctions.DEFAULT_MODE = 'team'`, `Custom.lua`). Up to `maxNumPlayers = 15` players per opponent roster (`OPPONENT_CONFIG`, `Custom.lua`) to cover stand-ins/subs, but a Dota game fields 5 per side.
- A match is a **best-of series** (`bestof`); each game in the series is a `match2game` entry. Dota is single-map, so individual games are **not** named by map — see §4.
- Match identity: `pageid` (numeric, our `NormalizedMatch.id`), `match2id` (alphanumeric bracket-scoped id, used in our detail URLs), `objectname` (dedup key), `pagename` (wiki page).
- **Two ingestion paths** (decisive for how much per-game detail exists):
  1. **"Match Page" / BigMatch** (`Input/Custom/MatchPage.lua`): pulls full per-player + draft + objective stats from Valve via `mw.ext.Dota2DB.getBigMatch(matchid)`. Requires the **Valve Dota match ID** to be attached to each game. This is where all the rich data comes from.
  2. **"Normal"** (`Input/Custom/Normal.lua`): hand-entered match lists. Carries only hero **picks/bans**, **side**, and **length** — **no** per-player stats, **no** objectives, **no** ordered veto phase.

---

## 2. Match-level fields

All queried by us (`LiqMatchQueryFields`) and parsed into `LiqMatch` (`liquipedia_match.go:14-55`) unless noted.

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `pageid` | int | numeric page id → our `id` | LiqMatch / queried | F |
| `match2id` | string | bracket-scoped match id (detail nav) | LiqMatch | F |
| `match2bracketid` | string | bracket id | LiqMatch | F |
| `objectname` | string | dedup key | LiqMatch | F |
| `pagename` | string | wiki page | LiqMatch | F |
| `status` | string | match status | LiqMatch | L |
| `finished` | int 0/1 | series over | LiqMatch | L |
| `winner` | string `"1"`/`"2"` | winning opponent index | LiqMatch | L |
| `walkover` | string | walkover flag | LiqMatch (**not** in NormalizedMatch) | F |
| `resulttype` | string | e.g. default/walkover | LiqMatch (**not** normalized) | F |
| `bestof` | int | series length → `number_of_games`, `match_type` | LiqMatch | F |
| `date` | string `YYYY-MM-DD HH:MM:SS` | start (→ `begin_at` ISO) | LiqMatch | F |
| `dateexact` | int 0/1 | exact time known | LiqMatch (**not** normalized) | F |
| `patch` | string | **game patch/version** (e.g. `7.36`) | LiqMatch.Patch **queried but DROPPED in NormalizedMatch** | F |
| `vod` | string | series VOD URL | LiqMatch.Vod **queried but DROPPED in NormalizedMatch** | F |
| `stream` | json | stream platforms→channels (`rawstreams=true&streamurls=true`) | LiqMatch.Stream → `streams_list` | L |
| `links` | json | external links incl. **stratz / dotabuff / datdota** per game | LiqMatch.Links **queried but DROPPED in NormalizedMatch**; keys built in `Custom.lua:getLinks` | F |
| `extradata` | json | match-level extra; Dota stores **`mvp`** (and head-to-head flag) | LiqMatch.ExtraData **queried but DROPPED in NormalizedMatch**; `Custom.lua:getExtraData` | F |
| `tournament` / `parent` / `series` | string | event context | LiqMatch → tournament/league/serie | F |
| `tickername` / `shortname` | string | display name | LiqMatch → `name` | F |
| `liquipediatier` / `liquipediatiertype` / `publishertier` | string | tier | LiqMatch → `tournament.tier` | F |
| `icon`/`iconurl`/`icondark`/`icondarkurl` | string | event icon | LiqMatch | F |
| `section` | string | bracket section | LiqMatch | F |
| `mode` / `type` / `game` / `namespace` | string/int | misc routing | LiqMatch | F |
| `match2opponents` | json | the 2 teams | LiqMatch → §3 | L |
| `match2games` | json | per-game series detail | LiqMatch → §4 | L/F |
| `match2bracketdata` | json | bracket placement | LiqMatch | F |

Match-level extradata observed (`Custom.lua`): `mvp` (`MatchGroupInputUtil.readMvp`), `headtohead` (boolean → builds a "Match history" query link). No live in-game payload at match level.

---

## 3. Opponent / team fields  (`match2opponents[]`)

Parsed into `LiqOpponent` (`liquipedia_match.go:59-71`); commons type `standardOpponent` (`MatchGroup/Util.lua:166-182`).

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `id` | int | opponent index (1/2) | LiqOpponent.ID | F |
| `name` | string | team page name | LiqOpponent.Name → opponent | L |
| `template` | string | team shortname/template | LiqOpponent.Template → acronym | F |
| `score` | string/int | **series score** (games won); `-1` = none yet (we clamp to 0) | LiqOpponent.Score → `results[].score` | **L** |
| `score2` | int | secondary score | Util.lua (not parsed) | L |
| `status` | string | e.g. scored / FF | LiqOpponent.Status | L |
| `type` | string | `team` / `literal` | LiqOpponent.Type | F |
| `placement` | int | final placement | Util.lua (not parsed) | F |
| `icon`/`iconurl`/`icondark`/`icondarkurl` | string | team logo (light/dark) | LiqOpponent → image urls | F |
| `match2players` | json | **roster** for this team | LiqOpponent.Match2Players (passed raw; not individually normalized at opponent level) | F |

`match2player` sub-fields (commons `standardPlayer`, `Util.lua:146-154`; `Custom.lua:adjustOpponent`): `pageName`, `displayName`, `flag`, `team`, `faction`, `extradata.publisherId` (= Valve Dota account/player id, used to join per-game stats). Per-player **stats live in `match2games[].participants`**, not here (§5).

---

## 4. Per-game fields — `match2games[]`

Parsed into `NormalizedGameEntry` (`liquipedia_match.go:165-184`, builder `normalizeMatchGames` :598-704). Commons type `MatchGroupUtilGame` (`Util.lua:217-236`).

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `winner` | int / `-1` | game winner index; `-1`/nil = not finished | gameData → `winner` (mapped to team id) | L |
| `finished` | bool/int | game over | normalizeMatchGames | L |
| `length` / `lengthInSeconds` | string `MM:SS` / int | **game duration** | gameData → `length` (`MatchPage.lua:getLength`) | F |
| `map` | string | map name — **`default`/empty for Dota** (single map; `getMapName` returns nil for `DUMMY_MAP='default'`, `Custom.lua`) | gameData → `map` | F |
| `scores` | int[] | per-game score array | normalizeMatchGames → `scores` | L |
| `vod` | string | per-game VOD | Util.lua (game-level; **not** extracted into NormalizedGameEntry) | F |
| `patch` | string | per-game patch | Util.lua (not extracted) | F |
| `subgroup` | int | grouping | Util.lua (not extracted) | F |
| `participants` | json map `X_Y` | per-player stat lines (opponentid_playerid) | gameData → `participants` → §5 | F |
| `extradata` | json | **Dota game-specific block** (below) | gameData → `extradata` (carried raw in `NormalizedGameEntry.ExtraData`) | F |

**`match2games[].extradata` keys (Dota-specific)** — written by `Custom.lua:MapFunctions.getExtraData`, read by `MatchPage.lua:populateGames`. All carried by us as untyped `NormalizedGameEntry.ExtraData` pass-through:

| key | type | meaning | source | live? |
|---|---|---|---|---|
| `publisherid` | int | **Valve Dota match ID** (→ stratz/dotabuff/datdota) | `getExtraData` | F |
| `team1side` / `team2side` | string | **`radiant` / `dire`** per team | `getSide` (BigMatch) / `teamNside` (Normal) | F |
| `team1objectives` / `team2objectives` | obj | `{towers, barracks, roshans}` destroyed/killed (BigMatch only) | `getObjectives` → `towersDestroyed`,`barracksDestroyed`,`roshanKills` | F |
| `team1hero1..N` / `team2hero1..N` | string | **picked heroes** per team | `getHeroPicks` (BigMatch) / `tNhM` inputs (Normal, up to 5) | F |
| `team1ban1..N` / `team2ban1..N` | string | **banned heroes** per team | `getHeroBans` (BigMatch) / `tNbM` inputs (Normal, up to 7) | F |
| `vetophase` | array | **ordered draft**: `[{character, team(1/2), type('pick'|'ban'), vetoNumber}]` | `getVetoPhase` (BigMatch only; Normal = none) | F |

**Objectives confirmed:** towers, barracks (lanes), Roshan kills — per team. **First blood / per-tower granular events are NOT stored** (only aggregate counts). No tournament-level map pool (Dota is single-map).

---

## 5. Per-player fields  (`match2games[].participants["X_Y"]`)

`X` = opponent index, `Y` = player index. Produced by `Custom/MatchPage.lua:getParticipants` (from `getBigMatch`), rendered by `MatchPage.lua:_renderPlayerPerformance`. We parse via `normalizeGameParticipants` (`liquipedia_match.go:855-896`): `player`/`character`/`role`/`kills`/`deaths`/`assists` become typed `NormalizedParticipant` fields; **everything else is captured in `NormalizedParticipant.Extra` (untyped pass-through).**

| participant key | type | meaning | typed in our model? | live? |
|---|---|---|---|---|
| `player` | string | player page name | ✅ `Player` | F |
| `name` | string | display name (in-game id) | ⚠️ in `Extra` | F |
| `character` | string | **hero** | ✅ `Character` | F |
| `role` | string | position / lane (from `position`) | ✅ `Role` | F |
| `facet` | string | **Dota 2 hero facet** (7.33+) | ⚠️ `Extra` | F |
| `kills` | int | kills | ✅ `Kills` | F |
| `deaths` | int | deaths | ✅ `Deaths` | F |
| `assists` | int | assists | ✅ `Assists` | F |
| `gold` | int | **net worth** (`totalGold`) | ⚠️ `Extra` | F |
| `gpm` | int | **gold per minute** (`goldPerMinute`) | ⚠️ `Extra` | F |
| `xpm` | int | **XP per minute** (`xpPerMinute`) | ⚠️ `Extra` | F |
| `lasthits` | int | **last hits** (`lastHits`) | ⚠️ `Extra` | F |
| `denies` | int | **denies** | ⚠️ `Extra` | F |
| `damagedone` | int | **hero damage** (`damage`) | ⚠️ `Extra` | F |
| `level` | int | hero level | ⚠️ `Extra` | F |
| `items` | array `{name,image}` | **final inventory** (6 slots) | ⚠️ `Extra` | F |
| `backpackitems` | array `{name,image}` | backpack items | ⚠️ `Extra` | F |
| `neutralitem` | `{name,image}` | neutral item | ⚠️ `Extra` | F |
| `scepter` | bool | Aghanim's Scepter buff (`aghanimsScepterBuff`) | ⚠️ `Extra` | F |
| `shard` | bool | Aghanim's Shard buff (`aghanimsShardBuff`) | ⚠️ `Extra` | F |

**Richest 5 per-player stats available:** net worth (`gold`), GPM, XPM, last hits / denies, and the full **item build** (final items + backpack + neutral + Aghanim's scepter/shard) — alongside KDA, hero, facet, level, hero damage. This is Dotabuff-grade per-game data.

Team-aggregate stats are derived by Liquipedia from these (`MatchPage.lua:populateGames` sums per-player `gold`/`kills`/`deaths`/`assists` into team totals) — i.e. they're computed, not separately stored.

---

## 6. Live capability

**No real-time in-game telemetry is available through the match2 API. Confirmed deny.**

- The rich per-player block and objectives come from `mw.ext.Dota2DB.getBigMatch(matchid)` (`Custom/MatchPage.lua`), which imports a **finished** game's data from Valve keyed by the **Valve match ID**. It is **post-game and editor/import-gated**: a game only has this data once the match ID is attached and the BigMatch is fetched. There is **no per-minute net-worth/gold/XP graph, no live gold/last-hit ticks, no live objective feed** exposed.
- What *can* update during a live series (near-live, editor/import-driven — mark **L**): `status`/`finished`/`winner`, the **series score** (`match2opponents[].score`), `stream` links, and, as individual games of the series conclude, that game's full BigMatch block plus the **draft** (picks/bans/`vetophase`). For an in-progress *game*, expect only side + (possibly) live draft; full stats land when the game ends.
- Practical "live" detail page = current series score + stream embed + completed-games stat tables + draft, refreshed on our normal poll cadence (`matches_running` TTL 10 min — too coarse for true live; would need a tighter on-demand fetch for the detail page).

---

## 7. Gap analysis

**Already parsed / carried to frontend (cite our models):**
- All match-level identity/status/score/series fields (`NormalizedMatch`, `liquipedia_match.go:109-140`).
- Opponents, logos, series scores (`normalizeMatchOpponents` :393-472).
- Streams (`normalizeMatchStreams` :478) — `streams_list`.
- Per-game winner / length / scores / map (`normalizeMatchGames` :598).
- **Per-player participant stats — captured but UNTYPED**: KDA/hero/role typed; net worth, GPM, XPM, LH/DN, hero damage, level, items, facet, scepter/shard all flow through in `NormalizedParticipant.Extra` (:879-888).
- **Per-game draft + side + objectives — captured but UNTYPED**: `team1side`/`team2side`, `team1objectives`/`team2objectives`, `team1heroN`/`team1banN`, `vetophase` all flow through in `NormalizedGameEntry.ExtraData` (:682-684).

**Available from the API but DROPPED in normalization (queried into `LiqMatch`, never copied to `NormalizedMatch`):**
- `patch` (`LiqMatch.Patch`) — **game version, dropped.** Notable for Dota detail pages.
- `vod` (`LiqMatch.Vod`) — series VOD, dropped (also per-game `vod` not extracted).
- `links` (`LiqMatch.Links`) — **stratz / dotabuff / datdota / official** deep links, dropped.
- match-level `extradata` (`LiqMatch.ExtraData`) — **`mvp`**, head-to-head, dropped.
- `walkover`, `resulttype`, `dateexact` — minor, dropped.

**Not available anywhere (do not promise):**
- Live per-minute graphs / gold-XP advantage timeline / live tick stats.
- First blood, individual tower/ward events, rune/courier events (only aggregate towers/barracks/roshans counts exist).
- Per-game data for any game whose Valve match ID was never attached (Normal-path matches: heroes/bans/side/length only).

**Single biggest gap vs what we currently parse:** the entire **detailed per-player performance + draft layer** — net worth, GPM/XPM, LH/DN, items, hero damage, side, objectives, ordered pick/ban veto — is the core of a Dota detail page, yet today it survives only as **untyped `Extra`/`ExtraData` blobs** (and only when a Valve match ID is attached). We expose none of it as structured fields, and we additionally **drop `patch`, `vod`, and the stratz/dotabuff/datdota `links` outright** in `NormalizeLiqMatch`.

---

## 8. Proposed max-info detailed-match view for Dota 2

**Header:** teams (logos light/dark), series score (L), `bestof`, status/live badge, event + tier, `patch` (re-expose), start time, MVP (from match `extradata`).

**Stream / VOD bar:** live stream embed (running) → series `vod` after; external deep links **Stratz / Dotabuff / DatDota** per game (re-expose `links`).

**Per-game tabs** (one per `match2game`, position + winner + `length`):
- **Draft strip:** ordered `vetophase` (pick/ban sequence with order numbers), each team's `side` (Radiant/Dire) and picked heroes; bans row. (Fallback to `teamNheroM`/`teamNbanM` when `vetophase` absent.)
- **Team stats row:** aggregate KDA, total net worth (Gold), **Towers / Barracks / Roshans** (from `teamNobjectives`).
- **Player performance table** (5 rows/team): hero (+ facet icon), player, **KDA**, **NET (net worth)**, **GPM**, **XPM**, **LH/DN**, hero **DMG**, level, and **item build** (6 items + backpack + neutral + Aghanim's scepter/shard badges).

**Graceful degradation:** if a game has no Valve match ID (Normal path), render only draft (heroes/bans), side, length — hide the stat tables rather than showing zeros.

**Backend work implied (not done here):** (1) surface `patch`, `vod`, `links`, match `extradata` on `NormalizedMatch`; (2) add typed Dota structs (or a typed `extra`/`participant_extra`) so the frontend isn't string-keying into `Extra`/`ExtraData`; (3) for true freshness, a tighter on-demand refresh than the 10-min running TTL on the detail route.
