# Valorant — Match data (Liquipedia wiki `valorant`)

> Goal: an exhaustive, source-backed reference of every match field Liquipedia exposes for Valorant, to design a maximum-info "detailed match page".
>
> **`live?` legend** — `L` = updates live (with wiki-edit / webhook latency, contributor-driven); `F` = final only (appears once a map/match finishes); `?` = unconfirmed / conditional.
>
> **Sources cited inline:**
> - `models` → `backend-go/internal/models/liquipedia_match.go` (our parser)
> - `poller` → `backend-go/internal/services/liquipedia_poller.go` (`LiqMatchQueryFields`)
> - `matches.go` → `backend-go/internal/handlers/matches.go` (on-demand detail fetch)
> - `lpdb-schema` → Liquipedia `Lua-Modules/lua/definitions/liquipedia_db.lua` (canonical match2 LPDB schema)
> - `val-input` → `Lua-Modules/lua/wikis/valorant/MatchGroup/Input/Custom.lua` (writes Valorant extradata)
> - `val-normal` → `…/valorant/MatchGroup/Input/Custom/Normal.lua` (manual/bracket map parser)
> - `val-matchpage` → `…/valorant/MatchGroup/Input/Custom/MatchPage.lua` (automated Riot-fed parser)
>
> ⚠️ The Liquipedia API host is rate-limited (HTTP 429) and could not be hit directly; field names below come from (a) our production Go parser running against live API responses, and (b) the canonical Liquipedia Lua source on GitHub. Where a field's exact JSON casing in the v3 response was not directly observed, it is flagged.

---

## 0. How Valorant match data is produced (critical context)

Liquipedia is a wiki. A Valorant match exists in two possible richness tiers, and the API returns whichever was stored:

1. **Normal / bracket input** (`val-normal`): a contributor types the match into a bracket or matchlist template. Map scores, agents, and per-player stats (ACS/ADR/KAST/HS/K-D-A/FK/FD) exist **only if a human entered them**. `getRounds` returns `nil` → **no round-by-round data**.
2. **Match Page** (`val-matchpage`): a dedicated `Match:` page calls `mw.ext.valorantdb.getMatchDetails(<riotMatchId>)`, pulling official Riot data. This produces full per-round results, per-player stats keyed by `puuid`, half splits, ceremonies (ace/clutch/thrifty), etc. **Requires a finished map with a Riot match ID.**

`val-input` `processMatch` automatically merges a standalone Match Page into the bracket match when one exists (`MatchGroupInputUtil.fetchStandaloneMatch`). So the API's `match` datapoint transparently serves the richest available version.

**Implication for "live":** in-game telemetry (rounds, per-player ACS/ADR/KAST, first kills) is post-game — it only materialises after Riot data is ingested. Live updates are limited to whatever a contributor edits in real time (series score, current map score, sometimes agents). See §6.

---

## 1. Identity & opponent format

- **Wiki:** `valorant`; internal acronym `valorant`; frontend slug `valorant` (`models.GameWikiMapping`, `backend-go/internal/models/liquipedia.go:28`).
- **Opponent format:** **team vs team**, 2 opponents, 5 players each. `val-input` sets `DEFAULT_MODE = 'team'`. Opponents live in `match2opponents[]` (`lpdb-schema`); each has `match2players[]` (the 5-man roster). 1v1/literal opponents are technically possible in the schema but not the VCT use case; our parser filters to matches with ≥2 named, non-`TBD`, non-`literal` opponents (`models` `HasTwoNamedOpponents`).
- **Series format:** best-of N via `bestof` (`lpdb-schema` match2 `bestof`; `val-input` `getBestOf`). Each map = one `match2game`.
- **Match identity:** `match2id` (alphanumeric, e.g. `ID_VCT26S2M2H_0001`) + `match2bracketid`; `pageid` is the numeric wiki page id we expose as `id` (`models` `NormalizeLiqMatch`).

---

## 2. Match-level fields

`match` datapoint (`lpdb-schema` class `match2`). "Parsed" = present in `LiqMatch` struct (`models`). Query projection for list endpoints = `LiqMatchQueryFields` (`poller:47`); the single-match detail fetch (`matches.go` `fetchMatchFromWiki`) sets **no** `query=` projection → returns **all** fields.

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `pageid` | int | Wiki page id → our `id` | models / lpdb-schema | F |
| `pagename` | string | Wiki page name | models / lpdb-schema | F |
| `objectname` | string | Unique object key (dedup) | models | F |
| `match2id` | string | Stable match id (used in URLs) | models / lpdb-schema | F |
| `match2bracketid` | string | Bracket grouping id | models / lpdb-schema | F |
| `match2bracketdata` | object | Bracket position/round metadata (header, sectionheader, bracketsection) | models (`Match2BracketData`, passthrough) / lpdb-schema | F |
| `winner` | string/int | Winning opponent index `1`/`2` (`0`/empty = none) | models | L (set when decided) |
| `walkover` | string | Walkover indicator | models | F |
| `resulttype` | string | Result type (e.g. default/np) | models | F |
| `finished` | int (0/1) | Match completed | models | L→F |
| `status` | string | Match status | models | L |
| `bestof` | int | Series best-of → `number_of_games`, `match_type` | models | F |
| `date` | string `YYYY-MM-DD HH:MM:SS` | Scheduled/played time → `begin_at` | models | F |
| `dateexact` | int (0/1) | Whether time is exact | models | F |
| `mode` | string | `team` | models | F |
| `type` | string | Match type | models | F |
| `section` | string | Bracket section label | models | F |
| `game` | string | Game/version tag | models | F |
| `patch` | string | Game patch (e.g. `10.05`) | models (`Patch`, parsed) | F |
| `vod` | string | Match-level VOD URL | models (`Vod`, parsed) | F |
| `tournament` | string | Tournament page name | models | F |
| `parent` | string | Parent tournament page | models | F |
| `series` | string | Series name → league/serie | models | F |
| `tickername` / `shortname` | string | Display names | models | F |
| `icon` / `iconurl` / `icondark` / `icondarkurl` | string | Tournament icons | models | F |
| `liquipediatier` / `liquipediatiertype` / `publishertier` | string | Tier info | models | F |
| `stream` | object | Platform → channel/url map (twitch/youtube/…); requested with `rawstreams=true&streamurls=true` | models (`Stream`) / poller:539 | L |
| `links` | object | External links | models (`Links`, passthrough) | F |
| `extradata` | object | **Match-level extradata: `mapveto`, `mvp`** | val-input `MatchFunctions.getExtraData` | mapveto L/F, mvp F |
| `match2opponents` | array | Opponents (see §3) | models | L |
| `match2games` | array | Per-map data (see §4) | models | L |

**Match-level `extradata` keys (Valorant)** — `val-input MatchFunctions.getExtraData`:
- `mapveto` — full veto sequence (ban/pick/decider order per team). Built by `MatchGroupInputUtil.getMapVeto`. ⚠️ Exact JSON shape (per-step team/type/map) to confirm against a live response.
- `mvp` — series MVP (player + optional vote count). Built by `MatchGroupInputUtil.readMvp`.

> ⚠️ **We fetch `extradata` at match level but discard it** — `NormalizeLiqMatch` never reads `m.ExtraData`. So `mapveto` and `mvp` are available but currently dropped (see §7).

---

## 3. Opponent / team fields

`match2opponent` (`lpdb-schema`). Parsed into `LiqOpponent` (`models`).

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `id` / `match2opponentid` | int | Opponent index (1/2) | models (`ID`) | F |
| `type` | string | `team` (or `literal`/`solo`) | models | F |
| `name` | string | Team page name | models | F |
| `template` | string | Team shortname/template → acronym + logo | models | F |
| `score` | number | **Series score (maps won)**; `-1` = not played (clamped to 0) | models `parseScore` | **L** |
| `placement` | int | Final placement (1=winner) | lpdb-schema | L→F |
| `status` | string | Opponent status (e.g. forfeit) | lpdb-schema / models | F |
| `icon`/`iconurl`/`icondark`/`icondarkurl` | string | Team logo (light/dark) | models | F |
| `match2players` | array | 5-man roster: `name`, `displayname`, `flag` | lpdb-schema / models (`Match2Players` passthrough) | F |
| `extradata` | object | **(Match Page only)** opponent aggregate stats | val-input `calculateOverallStatsForOpponent` / `extendMapOpponent` | F |

**Opponent `extradata` (Match Page only)** — `val-input`:
- `firstKills` — total first kills across maps
- `flawless` — flawless rounds won
- `thrifties` — thrifty rounds won (eco wins)
- `clutches` — clutch rounds won
- `postPlant` — `[postplantWinsAsAttacker, totalPlantedRounds]`

> ⚠️ Our `LiqOpponent` does **not** read opponent-level `extradata` → these aggregates are dropped.

---

## 4. Per-game (per-map) fields — `match2games`

`match2game` (`lpdb-schema`). The v3 API flattens each game into a JSON object our parser reads in `normalizeMatchGames` (`models`). LPDB stores per-game opponents in `opponents table[]`; the v3 response surfaces players as a `participants` map (see §5) plus a `scores` array.

| Field (JSON) | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `map` | string | Map name (Ascent, Bind, …) | models / val-normal `getMapName` | L (when set) |
| `winner` | string | Map winner index `1`/`2` | models / lpdb-schema | L→F |
| `finished` | bool/int | Map completed | models | L→F |
| `status` | string | Map status (incl. `notplayed`) | lpdb-schema | L |
| `scores` | array[int] | Per-team **round score** for the map (e.g. `[13,9]`) | models | **L** |
| `length` | string/int | Map duration (`mm:ss` or seconds) | models / val-matchpage `getLength` (`game_length_millis`) | F |
| `subgroup` | int | Map ordering group | lpdb-schema | F |
| `vod` | string | Per-map VOD | lpdb-schema | F |
| `patch` | string | Per-map patch (from `game_version`) | lpdb-schema / val-matchpage `getPatch` | F |
| `date` | string | Map date | lpdb-schema | F |
| `participants` | object | Per-player stat lines, keyed `"<opp>_<player>"` (see §5) | models `normalizeGameParticipants` | F (live = empty placeholders) |
| `extradata` | object | **Valorant per-map extradata (below)** | val-input `MapFunctions.getExtraData` | mixed |

**Per-map `extradata` keys (Valorant)** — `val-input MapFunctions.getExtraData`:

| Key | Type | Meaning | live? |
|---|---|---|---|
| `t1firstside` | `'atk'`/`'def'` | Team 1 starting side (regulation) | L (set at start) |
| `t1firstsideot` | `'atk'`/`'def'` | Team 1 starting side (overtime) | F |
| `t1halfs` | `{atk, def, otatk, otdef}` | **Team 1 rounds won per side** (attack/defense + OT) | F (needs round data) |
| `t2halfs` | `{atk, def, otatk, otdef}` | **Team 2 rounds won per side** | F |
| `rounds` | array of round objects | **Round-by-round results** (Match Page only; `nil` for normal input) | F |
| `publisherid` | string | Riot match id | F |
| `publisherregion` | string | Riot region (`eu`/`na`/`ap`/`kr`/`latam`/`br`/`pbe1`/`esports`) | F |
| `t1p1` … `t2p5` | string | Player name per slot | L (if entered) |
| `t1p1agent` … `t2p5agent` | string | **Agent picked per player slot** | L (if entered) |

**`rounds[]` element (Match Page only)** — `val-input ValorantRoundData` / `val-matchpage getRounds`:

| Key | Type | Meaning |
|---|---|---|
| `round` | int | Round number |
| `t1side` / `t2side` | `'atk'`/`'def'` | Each team's side that round |
| `winningSide` | `'atk'`/`'def'` | Side that won |
| `winBy` | string | `elimination` / `defuse` / `detonate` / `time` / `surrendered` |
| `planted` | bool | Spike planted |
| `defused` | bool | Spike defused |
| `flawless` | bool | Won with no deaths |
| `firstKill` | `{killer, victim, byTeam}` | First kill of the round (by puuid + team 1/2) |
| `ceremony` | string | `Ace` / `Clutch` / `Thrifty` / `Flawless` / … |
| `ceremonyFor` | string | puuid credited with the ceremony |

> Note: even on Match Pages, **only the first kill per round is stored** — the full per-round kill list is processed transiently to attribute aces/clutches, then discarded. There is **no stored full kill feed** (see §6).

---

## 5. Per-player fields — `match2games[].participants`

The v3 API exposes per-map players as a `participants` object keyed `"<opponentIndex>_<playerIndex>"` (e.g. `"1_1"`, `"2_5"`), confirmed by our production parser `normalizeGameParticipants` (`models`). Field names below come from `val-normal getParticipants` + `val-matchpage getParticipants` (`val-input MapFunctions.getPlayersOfMapOpponent`). During a **live/unfinished** map these entries are empty placeholders, which our parser skips.

| Field (JSON key) | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `player` | string | Player page name / id | models (typed `Player`) | F |
| `displayName` / `displayname` | string | Display name | models (folded into stdkeys) | F |
| `agent` (a.k.a. `character`) | string | **Agent played this map** | models (typed `Character`) | L (if entered) |
| `kills` | int | Kills | models (typed) | F |
| `deaths` | int | Deaths | models (typed) | F |
| `assists` | int | Assists | models (typed) | F |
| `acs` | number | **Average Combat Score** | models (→ `Extra`) / val | F |
| `adr` | number | **Average Damage per Round** | models (→ `Extra`) / val | F |
| `kast` | number | **KAST %** (Kill/Assist/Survive/Trade) | models (→ `Extra`) / val | F |
| `hs` | number | **Headshot %** | models (→ `Extra`) / val | F |
| `firstKills` | int | First kills (FK) | models (→ `Extra`) / val | F |
| `firstDeaths` | int | First deaths (FD) | models (→ `Extra`) / val | F |
| `puuid` | string | Riot player UUID | models (→ `Extra`) / val | F |
| `roundsPlayed` | int | Rounds played (Match Page derived) | val-matchpage | F |

**5 richest per-player stats reliably available:** ACS, ADR, KAST%, HS%, and first kills/deaths (FK/FD) — on top of K/D/A and the agent played per map.

**Player aggregate (series) stats** — `match2player.extradata.overallStats` (Match Page only, `val-input calculateOverallStatsForPlayer`): `agent[]` (agents played across maps), `acs`, `kills`, `deaths`, `assists`, `kast`, `adr`, `firstKills`, `firstDeaths`, `roundsPlayed`. We don't read the `match2player` level, so these series aggregates aren't surfaced (we'd recompute from per-map participants).

> Our `NormalizedParticipant` (`models`) types `player/character/role/team/kills/deaths/assists` and dumps everything else (`acs`, `adr`, `kast`, `hs`, `firstKills`, `firstDeaths`, `puuid`) into an untyped `Extra` map — so they reach the frontend but are unstructured/uncasted. Casing in the raw API (camelCase `firstKills` vs lowercase) should be confirmed against one real response; `Extra` captures it either way.

---

## 6. Live capability (explicit)

**There is NO real-time in-game telemetry from Liquipedia.** Confirmed by source architecture:

- **No live kill feed, no tick-by-tick / per-round live KDA, no live ACS/ADR/KAST.** These derive from `mw.ext.valorantdb.getMatchDetails(riotMatchId)` (`val-matchpage`), which needs a finished map's Riot match id. The `rounds[]` array is built only on Match Pages and only post-game (`val-normal getRounds` returns `nil`). Even then, only the **first kill** of each round is persisted — the full kill log is never stored.
- **What can move "live" (`L`):** series score (`match2opponent.score`), current map round score (`match2games[].scores`), map name, `winner`/`finished`, and agents/`t_p_agent` — **but only as fast as a human contributor edits the wiki** (or a bracket auto-refresh). Latency is typically minutes, not seconds.
- **Our freshness path:** the Liquipedia webhook → `DirtyTracker` → poller refresh (CLAUDE.md §11) means our Redis cache picks up a contributor's live edit within ~2 min. That is the ceiling on "live" for us.
- **Net:** a Valorant "live match" view can show live-ish series/map score and (sometimes) agents, but **cannot** show a live round timeline, live economy, or live per-player damage. Full per-map/per-player/round detail is a **post-game** experience.

If true real-time telemetry is a hard requirement, Liquipedia cannot supply it — a different source (Riot's live API, or a stats provider like rib.gg/vlr) would be needed. **Not fabricated: such telemetry does not exist in this dataset.**

---

## 7. Gap analysis

### Already parsed (cite `models` = `liquipedia_match.go`)
- **Match meta:** `id/pageid`, `name`, `status`, `begin_at` (from `date`), `bestof` → `number_of_games`/`match_type`, `tournament`/`series`/`league`, `match2id`, `wiki`, `section`, `match2bracketid`, opponents + series scores (`results`), streams (`stream`, with embeds).
- **Per-map:** `map`, `scores`, `length`, `winner`, `finished`; per-map `extradata` passed through **raw** as `NormalizedGameEntry.ExtraData` (`map[string]interface{}`).
- **Per-player:** `player`, `agent`/`character`, `role`, team slot, `kills/deaths/assists` (typed); `acs/adr/kast/hs/firstKills/firstDeaths/puuid` reach the frontend inside the untyped `Extra` map.

### Available but unparsed / dropped
| Data | Where | Status |
|---|---|---|
| **Match `extradata.mapveto`** (veto order) | match2.extradata | **Fetched then discarded** — `NormalizeLiqMatch` ignores `m.ExtraData` |
| **Match `extradata.mvp`** | match2.extradata | Discarded (same) |
| **Match `vod`** | match2.vod | Parsed into `LiqMatch.Vod` but **not mapped** into `NormalizedMatch` (no field) |
| **Match `patch`** | match2.patch | Parsed into `LiqMatch.Patch` but **not in output** |
| **Per-map atk/def half splits** (`t1halfs`/`t2halfs`), `t1firstside(ot)`, `publisherid/region`, `t_p_agent`, `rounds[]` | match2game.extradata | Reach frontend only as raw untyped `extradata` blob — **no typed structure** |
| **Per-map `vod` / `patch`** | match2game | Not extracted in `normalizeMatchGames` |
| **Opponent aggregates** (firstKills/flawless/thrifties/clutches/postPlant) | match2opponent.extradata | `LiqOpponent` doesn't read `extradata` → dropped |
| **Player series aggregates** (overallStats) | match2player.extradata | Not read (we only read game participants) |

### Single biggest gap
The **Valorant-specific per-map detail is available but not structured**: attack/defense half scores (`t1halfs`/`t2halfs`), starting sides, the round-by-round `rounds[]` timeline, and the **map veto order** (`match2.extradata.mapveto`, currently fetched and thrown away). These are exactly the fields a "detailed Valorant match page" is built around, yet today they either ride along as an untyped `extradata` blob or are dropped during normalization. Closing this is a backend normalization change only — the data is already in the API response (the on-demand detail fetch even requests all fields).

---

## 8. Proposed max-info detailed-match view for Valorant

Backed entirely by fields above; nothing requires a new data source. Data depth depends on whether a Match Page exists (§0) — degrade gracefully.

**Header**
- Team A vs Team B (logos light/dark), series score (`match2opponent.score`), BoN (`bestof`), status/live badge, tournament + tier, date, patch (`match2.patch`), VOD (`match2.vod`), live stream embed (`stream`).

**Map veto strip** *(needs typing `match2.extradata.mapveto`)*
- Ban/pick/decider order with team attribution.

**Per-map tabs** (one per `match2games[]`)
- Map name, final round score (`scores`), winner, duration (`length`), per-map VOD.
- **Attack/Defense breakdown:** `t1halfs`/`t2halfs` (`{atk, def, otatk, otdef}`) + first-side badges (`t1firstside`).
- **Round timeline** *(Match Page only)*: `rounds[]` — win-by icon (elim/defuse/detonate/time), plant/defuse, flawless, first-kill duel (`firstKill.killer→victim`), ceremony tags (ace/clutch/thrifty) with `ceremonyFor`.
- **Scoreboard (5v5):** per-player agent, K/D/A, ACS, ADR, KAST%, HS%, FK/FD (from `participants`), sortable; highlight map MVP / top ACS.

**Series aggregate panel**
- Per-player totals across maps (sum/derive from per-map participants, or read `match2player.extradata.overallStats` if present): agents played, total K/D/A, avg ACS/ADR/KAST.
- Team aggregates: total first kills, flawless, thrifties, clutches, post-plant win rate (`match2opponent.extradata`, Match Page only).
- Series MVP (`match2.extradata.mvp`).

**Live mode (degraded)**
- Poll our cached endpoint (webhook-refreshed, ~2 min). Show live series/map score, current map, agents if entered. **Explicitly do not promise** a live round feed or live per-player stats — populate the round timeline + scoreboard only once each map is `finished` and Riot data lands.

**Backend work implied** (research only — not done here): map match-level `vod`/`patch` into `NormalizedMatch`; read & type `match2.extradata` (mapveto, mvp); type the per-map `extradata` (halfs, firstside, rounds, agents); optionally read opponent/player `extradata` aggregates.
