# Call of Duty — Match data (Liquipedia wiki `callofduty`)

> Research deliverable. Goal: an exhaustive, source-cited map of every match field
> Liquipedia exposes for Call of Duty, to scope a per-game "max-info detailed match
> page". **Bottom line up front: standard CoD competitive matches (2-team
> Hardpoint / Search & Destroy / Control series) carry essentially NO per-player or
> mode-specific telemetry on Liquipedia — only map name, map mode, per-map team
> score, series winner, and an optional match MVP.** Everything richer (K/D, hill
> time, plants/defuses) is simply not entered into LPDB for CoD.

### Legend for "live?" column
- **L** = value changes during a live match (editor/bot-driven, map-completion granularity)
- **F** = only meaningful once final
- **?** = unconfirmed

### Sources used
- **Our Go models / query:** `backend-go/internal/models/liquipedia_match.go`, `backend-go/internal/services/liquipedia_poller.go:47` (`LiqMatchQueryFields`), `backend-go/internal/handlers/matches.go`.
- **Liquipedia open-source Lua modules** (`github.com/Liquipedia/Lua-Modules`, the code that actually writes the LPDB match2 datapoint):
  - `lua/wikis/callofduty/MatchGroup/Input/Custom.lua` — what CoD stores per match/map (the decisive source).
  - `lua/wikis/callofduty/MatchSummary.lua` + `MatchSummary/Ffa.lua` — what CoD displays.
  - `lua/wikis/callofduty/GetMatchGroupCopyPaste/wiki.lua` — the editor input template (proves which fields editors can even enter).
  - `lua/wikis/callofduty/Info.lua` — CoD title list / current game.
  - `lua/wikis/commons/MatchGroup/Input/Util.lua` — `standardProcessMaps` (per-map record shape), `readMvp` (MVP shape).
  - `lua/wikis/commons/MatchGroup/Display/Helper.lua` — `MapAndMode`, `Map`.
- **Liquipedia Commons docs** (via WebSearch summaries; direct fetch of `liquipedia.net` was HTTP 429 throughout — IP rate-limited as warned): `Help:LiquipediaDB/Match`, `Liquipedia:Brackets/Developers_Guide` — for the match2 schema philosophy and the participants `X_Y` JSON-key convention.

---

## 1. Identity & opponent format

- **Wiki:** `callofduty`. Internal acronym `codmw`; mapped in `models.GameWikiMapping` (`liquipedia.go:32` → `"codmw": "callofduty"`). Videogame numeric ID `23`, display name `Call of Duty`, frontend slug `codmw` (`liquipedia_tournament.go:179/193/207`). Note: the task brief calls the frontend slug `cod`; the backend currently emits `codmw` — flag this mismatch if the new page routes on slug.
- **Current title:** Liquipedia tracks many CoD games under one wiki (`Info.lua` `games` table): `bo6` = **Black Ops 6** (current premier title, e.g. CDL 2025/EWC 2025), `bo7` = Black Ops 7 (upcoming), `codm` = **Call of Duty: Mobile** (separate competitive scene, FFA-heavy), plus legacy `bo4`, `bocw`, `cod4`, etc. The per-match title lives in the top-level `game` field (e.g. `"bo6"`).
- **Opponent format (two flavours):**
  1. **Standard (the competitive norm):** exactly **2 opponents**, each a team. CDL / EWC / most CoD esports are 2-team Bo3/Bo5/Bo7 series. `GetMatchGroupCopyPaste/wiki.lua` routes `opponents <= 2` to `getStandardMatchCode`. Our `LiqMatch.HasTwoNamedOpponents()` filter keeps these.
  2. **FFA / battle-royale (`opponents > 2`):** `getFfaMatchCode` — many opponents scored by placement + kill points. Relevant to Warzone-style and some CoDM bracket formats, **not** to 2-team CDL maps. Our normalizer drops these (it requires ≥2 named team opponents and they aren't "team vs team").

---

## 2. Match-level fields

All of these are requested in `LiqMatchQueryFields` (`liquipedia_poller.go:47`) and mapped on `LiqMatch` (`liquipedia_match.go:14-55`). Source = "ours" means we already parse it.

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `pageid` | int | LPDB page id; our `NormalizedMatch.ID` | ours (`liquipedia_match.go:15`) | F |
| `pagename` | string | wiki page (tournament page) | ours (`:16`) | F |
| `objectname` | string | unique object key; our dedup `UniqueKey()` | ours (`:20`,`:96`) | F |
| `match2id` | string | unique match id (e.g. `EWC25CODxx_0001`); used in our detail URLs | ours (`:19`,`matches.go:387`) | F |
| `match2bracketid` | string | bracket grouping id | ours (`:54` via field) | F |
| `status` | string | match status string | ours (`:21`) | L |
| `finished` | int(0/1) | series over | ours (`:25`) | L |
| `winner` | string("1"/"2") | winning opponent index | ours (`:22`) | L (set at end) |
| `walkover` | string | walkover flag | ours (`:23`) | F |
| `resulttype` | string | e.g. default/draw | ours (`:24`) | F |
| `bestof` | int | series length (3/5/7) → `number_of_games` | ours (`:31`) | F |
| `mode` | string | match mode (`team`) — NOT the CoD game mode | ours (`:26`) | F |
| `type` | string | match type | ours (`:27`) | F |
| `section` | string | bracket section label | ours (`:28`) | F |
| `game` | string | **CoD title** (`bo6`,`codm`,…) per `Info.lua` | ours (`:29`) | F |
| `patch` | string | game patch | ours (`:30`) | F |
| `date` | string | start datetime → `begin_at` | ours (`:32`) | F |
| `dateexact` | int(0/1) | whether time is exact | ours (`:33`) | F |
| `vod` | string | match-level VOD URL | ours (`:34`) | F→L |
| `tournament` / `parent` | string | tournament / parent page | ours (`:35-36`) | F |
| `tickername`/`shortname`/`series` | string | display names / series | ours (`:37-39`) | F |
| `icon*` (`icon`,`iconurl`,`icondark`,`icondarkurl`) | string | tournament icons | ours (`:40-43`) | F |
| `liquipediatier` / `liquipediatiertype` / `publishertier` | string | tier (S/A/B…), official-tier flag | ours (`:44-46`) | F |
| `stream` | json | stream handles (with `rawstreams=true&streamurls=true`) → `streams_list` | ours (`:51`, `matches.go:389`) | L |
| `links` | json | external links | ours (`:52`, not surfaced) | F |
| `match2opponents` | json | see §3 | ours (`:49`) | L |
| `match2games` | json | see §4 | ours (`:50`) | L |
| `match2bracketdata` | json | bracket tree position | ours (`:54`, partly surfaced) | F |
| `extradata` | json | **match-level extras; for CoD = only `{ mvp }`** (see §5) | ours-rawkept (`:53`); content per `Input/Custom.lua getExtraData` | F |

**Match-level `extradata` content for CoD** — from `callofduty/MatchGroup/Input/Custom.lua` `MatchFunctions.getExtraData`, the ONLY key produced is:
- `mvp` → `{ players: [ { name, displayname, team, template, comment } ], points }` (shape from `commons/.../Util.lua` `readMvp`, lines 343-372). Optional; present only when an editor sets `|mvp=`.

There is **no** match-level series-score, map-veto, or head-to-head object in CoD `extradata`. (Some wikis add `vodgameX`, `matchsection` per the commons standard, but CoD's `getExtraData` does not.)

---

## 3. Opponent / team fields  (`match2opponents[]`)

Parsed by us into `NormalizedOpponent` + `NormalizedMatchResult` (`liquipedia_match.go:393-472`). `LiqOpponent` model at `:59-71`.

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `name` | string | team page name | ours (`:60`) | F |
| `template` | string | team shortname/template → acronym | ours (`:61`) | F |
| `type` | string | `team` (or `literal` for TBD) | ours (`:64`) | F |
| `id` | int | opponent index (1/2) | ours (`:65`) | F |
| `score` | string\|int | **series score** (maps won) → `results[].score` | ours (`:62`,`parseScore`) | **L** |
| `status` | string | scoring status (e.g. `S`, `W`, `FF`) | ours (`:63`) | L |
| `icon`/`iconurl`/`icondark`/`icondarkurl` | string | team logo (light/dark) | ours (`:66-69`) | F |
| `match2players` | json | **roster for this match** (player names) | ours-rawkept (`:70`, currently NOT normalized) | F |
| `placement` | int | final placement (FFA/group) | available, not parsed | F |
| `extradata` | json | opponent extras (e.g. FFA `startingpoints`) | available, not parsed | F |

**`match2players[]`** (commons-standard sub-object): `name`, `displayname`, `flag`, `extradata`. For CoD these are just the participating roster names/flags — **no per-player stats attached at this level**. We currently keep `match2players` only as raw JSON inside the opponent and do not surface it (see §7).

---

## 4. Per-game (per-map/mode) fields — `match2games[]`

This is the heart of the question. We pass each game through `normalizeMatchGames` (`liquipedia_match.go:598-704`) into `NormalizedGameEntry` (`:165-184`), keeping `map`, `scores`, `winner`, `length`, plus a generic `participants` and `extradata` pass-through.

**What CoD actually writes per game** is defined by `callofduty/MatchGroup/Input/Custom.lua`, where `MapFunctions = {}` is **empty** — i.e. CoD adds no custom per-map processing beyond the commons `standardProcessMaps` (`commons/.../Util.lua:1290-1336`). The editor input template is literally `{{Map|map=|mode=|score1=|score2=|winner=}}` (`GetMatchGroupCopyPaste/wiki.lua`). Resulting per-game record:

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `map` | string | **map name** (e.g. `Skyline`, `Vault`, `Protocol`) | Input template + ours (`:179`,`:645`) | F (set when map starts) |
| `mode` | string | **CoD game mode** — `Hardpoint`, `Search & Destroy`, `Control` (free-text from `|mode=`) | Input template; displayed via `Helper.lua MapAndMode`/`game.mode`; **ours: only inside `extradata` pass-through, NOT a typed field** | F |
| `scores` | int[] | **per-map team score** (e.g. Hardpoint `[250,213]`, SnD `[6,4]`, Control `[3,1]`) | ours (`:180`,`:649-662`); built from `score1`/`score2` | **L** |
| `winner` | string("1"/"2") | map winner index | ours (`:629-641`) | **L** |
| `finished` | bool/int | map complete | ours (`:615-621`) | **L** |
| `status` | string | map status | ours (`:623-626`) | L |
| `opponents[]` | obj | per-map `{ score, status, players }` — `players` is **nil for CoD** (no `getPlayersOfMapOpponent`) | commons `Util.lua:1293-1310`; ours reads top-level `scores` instead | L |
| `length` | int(sec) | map duration — **not set for CoD** (`getLength` undefined) → effectively absent | ours parses if present (`:665-673`); CoD won't emit it | F |
| `extradata` | obj | **CoD: only `{ displayname }`** (the map's display name); no stats | commons `Util.lua:1331-1334` (CoD `getExtraData` undefined); ours pass-through (`:183`,`:681-684`) | F |
| `participants` | obj | per-player stat lines keyed `X_Y` — **EMPTY for standard CoD** | commons `X_Y` convention; ours parses generically (`:677-680`,`855-896`) but there is nothing to parse | — |
| `date` / `vod` | string | per-map date / VOD (FFA template exposes `|date=|vod=`) | commons; ours doesn't surface per-map vod | F→L |
| `subgroup` | int | sub-series grouping | commons; not parsed | F |

**Key facts**
- **Mode IS available per map** (`Hardpoint` / `Search & Destroy` / `Control`) — but as a free-text `mode` string. Our pipeline currently buries it in `extradata` pass-through rather than exposing it as a first-class field. Confirmed it's read game-wide as `game.mode` in `MatchSummary.lua`/`Helper.lua MapAndMode`.
- **Per-map score IS available** (`scores: [s1, s2]`) and we already parse it. This is the richest reliably-present CoD datum after map name + mode.
- **No per-map duration** in practice (CoD doesn't set `length`).

---

## 5. Per-player fields

**For standard 2-team CoD matches: there are effectively none.** `match2games[].participants` is not populated (CoD defines no `getPlayersOfMapOpponent` / `getExtraData` for maps), and `match2opponents[].match2players` carries only identity (name/flag), not stats. This is a hard, source-confirmed gap — Liquipedia editors are not given inputs for CoD per-player K/D, hill time, plants, or defuses (the `{{Map}}` template has no such params).

| desired stat | available for CoD? | source / note | live? |
|---|---|---|---|
| Player K / D / A per map | **NO** | no participants block; `{{Map}}` has no `t1p1kills`-style params | — |
| +/- (kill differential) | **NO** | not stored | — |
| Hill time (Hardpoint) | **NO** | not stored | — |
| Plants / defuses (SnD) | **NO** | not stored | — |
| Control tick/round stats | **NO** | not stored | — |
| Player agent/loadout | **NO (N/A)** | CoD has no per-game character model | — |
| **Match MVP** | **YES (optional)** | match `extradata.mvp` = `{players:[{name,displayname,team,template,comment}],points}` (`Util.lua readMvp`) | F |
| Roster (who played) | **YES (identity only)** | `match2opponents[].match2players[]` `{name,displayname,flag}` | F |

**Exception — FFA matches only** (`opponents > 2`, e.g. CoDM/BR brackets), from `getFfaMatchCode`:
- Per-opponent **placement** + **placement points** and **kill points** (kills × per-kill multiplier `p_kill`/`p1_kill`…`p25_kill`), plus opponent `extradata.startingpoints`. Aggregated to a points total (`FfaMatchFunctions.calculateMatchScore`). Still **team/opponent-level**, not granular individual game telemetry, and irrelevant to 2-team CDL series. We do not parse FFA matches today.

The five "richest per-player" stats one could surface for CoD therefore reduce to: **(1) MVP name, (2) MVP comment, (3) which roster played (names), (4) player nationality flag, (5) — for FFA only — kill points / placement points.** There is no traditional scoreboard.

---

## 6. Live capability

- **No real-time in-game telemetry exists.** Liquipedia is a human-edited (sometimes bot-assisted) wiki. There is no live kill feed, no live Hardpoint hill timer, no live SnD round ticker. Confirmed structurally: the match2 schema has no streaming/telemetry channel and CoD stores no per-player or per-round live data.
- **What DOES update during a live match** (granularity = a map finishing, latency = however fast an editor/bot edits the page): series score (`match2opponents[].score`), per-map `scores`/`winner`/`finished`, overall `status`/`finished`/`winner`, and `stream` handles. These are marked **L** above.
- **Our own freshness ceiling:** running matches are polled every 8 min (TTL 10 min) per the poller config; on-demand match detail by `match2id` is cached 5 min. So even the editor-driven "live" fields reach our frontend with up to ~8-10 min lag for list views (faster on a direct detail fetch). "Live (ideally)" for CoD therefore means: live series/map score that refreshes every few minutes — **not** a live scoreboard.
- **Streams** (`stream` field with `rawstreams=true&streamurls=true`) give Twitch/YouTube handles we already turn into embed URLs (`liquipedia_match.go:478-593`) — that's the only genuine "watch it live" capability.

---

## 7. Gap analysis (already-parsed vs available-but-unparsed)

**Already parsed & surfaced (ours):**
- All match-level scalars in §2 (`liquipedia_match.go:14-55`, `NormalizeLiqMatch`).
- Opponents → teams + series score/results (`:393-472`).
- Per-game: `map`, `scores`, `winner`, `finished`, `length` (`:598-704`), plus generic `participants` and `extradata` pass-through (`:677-700`).
- Streams → embeddable list (`:478-593`).

**Available but NOT surfaced (low effort, real value for CoD):**
1. **Per-map `mode`** — we receive it (lands in the game `extradata`/raw) but don't expose it as a typed field. This is the single most CoD-defining datum after the map name. *Fix: read `game.mode` into a first-class field on `NormalizedGameEntry`.*
2. **Match MVP** (`extradata.mvp`) — we keep match-level `extradata` only as raw `json.RawMessage` on `LiqMatch` and never lift it into `NormalizedMatch`. *Fix: parse `extradata.mvp` → typed field.*
3. **Roster who-played** (`match2opponents[].match2players[]`) — kept as raw JSON inside `LiqOpponent.Match2Players`, never normalized. *Fix: surface names + flags per team.*
4. **Per-map VOD / date** (FFA template, sometimes set on standard maps via `vodgameX`) — not surfaced.
5. **`liquipediatiertype` / `publishertier`** — parsed onto the model but not all carried into the normalized tournament/league badge.

**Wanted but genuinely UNAVAILABLE (do not build UI for these — there is no data):**
- Per-player K/D / +/-, hill time, plants/defuses, any mode-specific player stat. **Confirmed absent in LPDB for CoD.** Building a scoreboard UI would leave it permanently empty.

**Single biggest gap:** the per-map **`mode`** (Hardpoint / SnD / Control) is the defining piece of a CoD series and is available from Liquipedia, yet we currently drop it into untyped `extradata` instead of exposing it. Everything truly "rich" (player scoreboards) does not exist upstream.

---

## 8. Proposed max-info detailed-match view for CoD

Given the data ceiling, the best honest "detailed match page" for CoD is a **series-and-map view**, not a scoreboard:

**Header**
- Tournament name + tier badge + CoD title (`game` → "Black Ops 6"), Bo3/Bo5/Bo7, date/time, status (Upcoming / **LIVE** / Finished).
- Two team blocks: logo (light/dark), name, **series score** (maps won), winner highlight.
- Live "Watch" button(s) from `streams_list` (Twitch/YouTube embed) — the only true live element.

**Map-by-map timeline (the core, one row per `match2games[]`)**
- Map # · **mode icon/label (Hardpoint / Search & Destroy / Control)** ← *requires surfacing `game.mode`* · map name.
- Per-map score `scores: [s1,s2]` with winner side highlighted (e.g. Hardpoint `250–213`, SnD `6–4`, Control `3–1`).
- Map status (live / final); per-map VOD link if present.

**Match meta**
- **MVP** (if set) with team + comment ← *requires surfacing `extradata.mvp`*.
- Rosters per team (player names + flags) ← *requires surfacing `match2players`*.
- Series VOD, bracket context (section/round from `section`/`match2bracketdata`), tournament link.

**Explicitly omit** (no upstream data): individual player scoreboards, K/D, hill time, plants/defuses, round-by-round breakdowns. If a future "premium stats" need arises, it cannot come from Liquipedia and would require a different provider (e.g. an official CDL stats feed).

**To realize this, the only backend work is small:** promote three already-received values to typed fields — per-game `mode`, match `extradata.mvp`, and opponent `match2players` rosters. No new Liquipedia endpoints or query changes are needed (`LiqMatchQueryFields` already requests `match2opponents`, `match2games`, and `extradata`).
