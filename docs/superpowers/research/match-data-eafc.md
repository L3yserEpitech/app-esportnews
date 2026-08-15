# EA Sports FC — Match data (Liquipedia wiki `easportsfc`)

> Research deliverable. Goal: enumerate **all** match data Liquipedia exposes for EA Sports FC to feed a per-game "detailed match page" (ideally live).
> Internal acronym `fifa` → **wiki name is `easportsfc`** (confirmed: `liquipedia.net/easportsfc`, and `models.GameWikiMapping` maps `fifa` → `easportsfc` per `CLAUDE.md` §1). Frontend slug `eafc`.

## Sources used
- Our parser / what we already request:
  - `backend-go/internal/models/liquipedia_match.go` (`LiqMatch`, `NormalizeLiqMatch`, game/opponent/participant normalizers)
  - `backend-go/internal/services/liquipedia_poller.go:47` (`LiqMatchQueryFields` — the exact `query=` field list we send)
- **Authoritative EA FC schema** (Liquipedia's own open-source Lua, not rate-limited):
  - `Liquipedia/Lua-Modules` → `lua/wikis/easportsfc/MatchGroup/Input/Custom.lua` (storage/parse rules)
  - `lua/wikis/easportsfc/MatchSummary.lua` (what gets displayed)
  - `lua/wikis/easportsfc/GetMatchGroupCopyPaste/wiki.lua` (the input template = the only fields an editor can fill)
  - `lua/wikis/easportsfc/Match/Legacy.lua`
  - generic `lua/wikis/commons/MatchGroup/Util.lua` (`matchFromRecord`, `gameFromRecord`, `opponentFromRecord`, `playerFromRecord` — the canonical LPDB→object field lists, i.e. the columns the API returns)
  - generic `lua/wikis/commons/MatchGroup/Input/Util.lua` (`standardProcessMaps` — how per-leg scores/opponents/players are stored)
- WebSearch on `Help:LiquipediaDB/Match`, `Module:Match` (commons) for opponent/game field confirmation.
- **NOTE:** `api.liquipedia.net` and all of `liquipedia.net` returned HTTP 429 from this host, so no byte-level live API sample could be captured. Every field below is backed by Liquipedia's storage source code (which defines exactly what the API returns) or by our own model. One caveat is flagged in §7.

`live?` legend: **L** = changes/appears live during a match · **F** = final/static (only meaningful once finished or pre-set) · **?** = depends on editor / not reliably present.

---

## 1. Identity & opponent format

- **Wiki:** `easportsfc`. Default match mode: **`solo`** — i.e. **1v1, player vs player** (`CustomMatchGroupInput.DEFAULT_MODE = 'solo'`). This is the dominant format (FC Pro / eChampions / Esports World Cup / Nations Cup are 1v1 PvP).
- **Secondary format:** **team / club with "submatches"** (`match.hasSubmatches=1`). Used when two clubs/teams each field multiple players and the tie is decided by sub-game **wins** rather than aggregate goals. In this mode each leg can carry up to 2 players per side (`t1p1, t1p2, t2p1, t2p2`).
- **Score model** (`CustomMatchGroupInput.getScoreType`): exactly one of
  - `mapScores` (default 1v1) → **match score = sum of per-leg goals (aggregate)**.
  - `mapWins` (when `hasSubmatches`) → match score = number of submatches won.
  - `penalties` (when a leg has the `penalty` flag) → match score taken from the penalty-shootout leg.
- **There is no "map"/character/loadout dimension.** EA FC has no maps, agents, heroes, or champions. The `map` field is repurposed as a **leg label** only (see §4).
- **Data is editor-curated** (it's a wiki). There is **no automated feed and no in-game telemetry** (see §6).

---

## 2. Match-level fields

Columns the API returns on a match record (from `MatchGroupUtil.matchFromRecord`), cross-checked against our `LiqMatch` struct and `LiqMatchQueryFields`.

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `pageid` | int | LPDB page id (our `NormalizedMatch.ID`) | `LiqMatch.PageID`; we request it | F |
| `pagename` | string | wiki page (tournament page the match lives on) | `LiqMatch.PageName` | F |
| `objectname` | string | unique object id; our dedup key (`UniqueKey`) | `LiqMatch.ObjectName` | F |
| `match2id` | string | stable match id (alphanumeric) — detail navigation | `LiqMatch.Match2ID` | F |
| `match2bracketid` | string | bracket grouping id | `LiqMatch.Match2BracketID` | F |
| `match2bracketdata` | json | bracket position / header / lower-edge wiring | `LiqMatch.Match2BracketData`; `bracketDataFromRecord` | F |
| `winner` | string/int | winning opponent index `1`/`2` (`0`/empty = none/draw) | `LiqMatch.Winner` | L (set when decided) |
| `walkover` | string | walkover type (`ff`/`dq`/`l`) if applicable | `LiqMatch.Walkover` | F |
| `resulttype` | string | e.g. walkover/default result type | `LiqMatch.ResultType` | F |
| `finished` | int (0/1) | match completed | `LiqMatch.Finished` | L |
| `status` | string | match status flag | `LiqMatch.Status` | L |
| `bestof` | int | number of legs/games planned (Bo) | `LiqMatch.BestOf` → `number_of_games` | F |
| `mode` | string | opponent mode: `solo` (1v1) or `team` | `LiqMatch.Mode` | F |
| `type` | string | match type | `LiqMatch.Type` | F |
| `section` | string | bracket section label | `LiqMatch.Section` | F |
| `date` | string `YYYY-MM-DD HH:MM:SS` | scheduled/kickoff time | `LiqMatch.Date` → `begin_at` | F |
| `dateexact` | int (0/1) | whether time is exact | `LiqMatch.DateExact` | F |
| `extradata` | json map | **match-level extras**; EA FC sets **`hassubmatches`** (`"true"`/`"false"`). Base also adds `comment`, `timestamp`, `timezoneid` | EA FC `getExtraData`; commons `matchFromRecord` | ? |
| `stream` | json map | live stream handles by platform (`twitch`, `youtube`, …) — with `rawstreams=true&streamurls=true` we get URLs | `LiqMatch.Stream`; we request both flags | **L** |
| `vod` | string | VOD link (post-match) | `LiqMatch.Vod` | F |
| `links` | json | external links | `LiqMatch.Links` | F |
| `tournament` | string | tournament name | `LiqMatch.Tournament` | F |
| `parent` | string | parent page | `LiqMatch.Parent` | F |
| `series` | string | series name | `LiqMatch.Series` | F |
| `tickername` / `shortname` | string | display names | `LiqMatch.TickerName/ShortName` | F |
| `icon` / `iconurl` / `icondark` / `icondarkurl` | string | tournament icons | `LiqMatch.Icon*` | F |
| `liquipediatier` / `liquipediatiertype` / `publishertier` | string | tournament tier | `LiqMatch.LiquipediaTier*` | F |
| `game` | string | game/edition (e.g. FC 24/25) | `LiqMatch.Game` | F |
| `patch` | string | rarely used for EA FC | `LiqMatch.Patch` | F |
| `match2opponents` | json[] | the two players/teams (see §3) | `LiqMatch.Match2Opponents` | L (scores) |
| `match2games` | json[] | per-leg records (see §4) | `LiqMatch.Match2Games` | L |

> We already request all of the above via `LiqMatchQueryFields` (poller line 47). The only match-level item we request but **drop in normalization** is `extradata` (so `hassubmatches` never reaches the frontend — see §7).

---

## 3. Opponent / player fields

`match2opponents[]` — for EA FC this is **2 entries**, each a player (`type=solo`) or a club (`type=team`). Fields from `MatchGroupUtil.opponentFromRecord` + `playerFromRecord`.

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `name` | string | opponent/player page name (or club name for team) | `LiqOpponent.Name` | F |
| `template` | string | team/player template (logo/shortname key) | `LiqOpponent.Template` | F |
| `type` | string | `solo` (player) or `team` (club) | `LiqOpponent.Type` | F |
| `score` | int | **match-level score**: aggregate goals (mapScores) or submatch wins (mapWins). `-1` = not played yet (we clamp to 0) | `LiqOpponent.Score` → `Results[].Score` | **L** |
| `status` | string | `S` (scored), `W`/`L`/`FF`/`DQ`… | `LiqOpponent.Status` | L |
| `placement` | int | final placement of this opponent | `opponentFromRecord` (not in our struct) | F |
| `icon` / `icondark` (+ `*url`) | string | logo (club) or flag/avatar | `LiqOpponent.Icon*` | F |
| `match2players` | json[] | players inside the opponent (for `team`; for `solo` the player ≈ the opponent) | `LiqOpponent.Match2Players` | F |
| `extradata` | map | opponent extras: `bg` (advance bg color), `advances` (bool) | `opponentFromRecord` | ? |

Per **player** inside `match2players[]` (`playerFromRecord`):

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `name` | string | player page name | `playerFromRecord.pageName` | F |
| `displayname` | string | display nick | `playerFromRecord.displayName` | F |
| `flag` | string | country flag | `playerFromRecord.flag` | F |
| `extradata.faction` | string | faction — **not used by EA FC** (StarCraft/Warcraft concept) | `playerFromRecord.faction` | F |
| `extradata.playerteam` | string | player's team, if relevant | `playerFromRecord.team` | F |

> Bo1 special case (`opponentFromRecord`, `gameScoresIfBo1`): for a single-leg match the opponent's match score may be sourced from leg 1's opponent score. So even a 1-leg EA FC match exposes a goal score on the opponent.

---

## 4. Per-game fields — `match2games[]` (the per-leg records)

This is where EA FC's per-leg goal scores live. Fields from `MatchGroupUtil.gameFromRecord` + how EA FC fills them (`Input/Custom.lua`) + the input template (`copyPaste/wiki.lua`).

| field | type | meaning (EA FC) | source | live? |
|---|---|---|---|---|
| `opponents[]` | json[] | **per-leg opponent objects**, each `{score, status, players}`. `score` = **goals scored by that side in this leg** | commons `standardProcessMaps` → `{score, status, players}`; EA FC `score1`/`score2` inputs | **L** |
| `scores` | int[] | flat `[goals1, goals2]` derived from `opponents[].score` (commons `map.scores = map(opponents, .score)`) | `gameFromRecord.scores`; we read `gameData["scores"]` | **L** |
| `winner` | int | leg winner `1`/`2` (`0` = draw, valid in football) | `gameFromRecord.winner`; we map it | L |
| `map` | string | **leg label only** (no real map): `"1st Leg"`, `"2nd Leg"`, … (Ordinal), or `"Penalties"` (penalty leg), or `"Game N"` (submatch) | EA FC `MapFunctions.getMapName`; we store as `Map` | F |
| `status` | string | leg status | `gameFromRecord.status` | L |
| `extradata.penaltyscores` | int[] | **penalty shoot-out scores** `[p1, p2]` — only set in `hasSubmatches`/penalty legs | EA FC `MapFunctions.getExtraData` → `penaltyscores`; we pass game `extradata` through | L |
| `length` | string/int | duration — **rarely set for EA FC** | `gameFromRecord.length`; we read it | ? |
| `subgroup` | int | sub-group index (sequencing legs/submatches) | `gameFromRecord.subgroup` (**we don't read it**) | F |
| `date` | string | per-leg date | `gameFromRecord.date` | F |
| `vod` | string | per-leg VOD | `gameFromRecord.vod` | F |
| `resulttype` / `walkover` | string | leg-level walkover/forfeit | `gameFromRecord` | F |
| `comment` / `header` | string | (in game `extradata`) free-text note / row header | `gameFromRecord` (extradata) | ? |
| `game` / `mode` / `patch` / `type` | string | per-leg meta (mostly inherited/empty) | `gameFromRecord` | F |

**Aggregate vs per-leg vs series:**
- **Per-leg goals:** `match2games[i].opponents[].score` (and the `scores` array). E.g. leg1 `2–1`, leg2 `0–3`.
- **Aggregate:** opponent-level `match2opponents[].score` (sum of leg goals under `mapScores`). For the example above → `2–4`.
- **Series/submatch wins:** under `hasSubmatches` the opponent score is the count of submatches won (`mapWins`), with per-submatch goals still in each game's `opponents[].score`.
- **Penalties:** a dedicated leg flagged `penalty` (label `"Penalties"`); shoot-out values in `extradata.penaltyscores`.

**Input template (proves the universe of editable per-leg fields)** — from `GetMatchGroupCopyPaste`:
```
{{Map|finished= |score1= |score2= |penalty= }}                         # 1v1 leg
{{Map|finished= |score1= |score2= |penaltyScore1= |penaltyScore2=       # submatch leg
       |t1p1= |t1p2= |t2p1= |t2p2= }}
```
That is the **entire** per-leg input surface: goals (`score1/score2`), a penalty flag/penalty scores, and (submatch only) up to 2 players per side. **No possession, shots, xG, cards, formation, or club-used field exists** in the schema.

---

## 5. Per-player fields (per leg / per match)

| field | type | meaning | source | live? |
|---|---|---|---|---|
| match-level player: `name`, `displayname`, `flag` | string | identity of each 1v1 player | `playerFromRecord` (§3) | F |
| per-leg lineup (submatch only): `opponents[].players[]` via `t1p1/t1p2/t2p1/t2p2` | string[] | who played each submatch; only `{played=true}` stored, no per-player stats | EA FC `MapFunctions.getPlayersOfMapOpponent` | F |
| **per-player in-game stats (goals scored by player, assists, shots, …)** | — | **DO NOT EXIST** | n/a — no field in schema | — |

There is **no per-player statline** for EA FC. The richest per-"player" datum is the goals the player's side scored per leg (which, in 1v1, equals that player's goals). No KDA-equivalent, no possession/shots, nothing analogous to the `NormalizedParticipant` ACS/ADR/KAST stats we parse for FPS/MOBA wikis.

---

## 6. Live capability (explicit)

- **No real-time in-game telemetry. Confirmed denial.** Liquipedia is an editor-maintained wiki; match2 data is written by humans via templates. There is no live feed of possession, ball position, minute-by-minute score, or any in-match event stream. Nothing in `easportsfc` modules ingests a live data source.
- **What updates "live" in practice** (only as fast as an editor edits the page, then propagates to LPDB / API, then to our cache):
  - `match2opponents[].score` (aggregate goals / submatch wins) — **L**
  - `match2games[].opponents[].score` / `scores` per leg — **L**
  - per-leg / match `winner`, `status`, `finished` — **L**
  - `extradata.penaltyscores` once a shoot-out is entered — **L**
  - `stream` map → the **genuinely real-time** asset is the **embedded Twitch/YouTube stream** (we already request `rawstreams=true&streamurls=true`). For a "live" EA FC page, the live experience = the stream embed + whatever scores an editor has typed.
- **Latency stack:** editor edit → LPDB → API → our poller cache. Our running-match cache TTL is ~10 min (`CLAUDE.md` §8), so even editor updates surface with up to several minutes' delay. A truly "live" EA FC page would lean on the stream embed, not on score freshness.

---

## 7. Gap analysis (already-parsed vs available-but-unparsed)

**Already parsed correctly (cite our models):**
- All match-level meta in §2 — we request the full field list (`liquipedia_poller.go:47`) and map it in `NormalizeLiqMatch` (`liquipedia_match.go`).
- Opponents + aggregate score → `normalizeMatchOpponents` (`Results[].Score`).
- Per-leg goals → `normalizeMatchGames` reads `gameData["scores"]` into `NormalizedGameEntry.Scores` (the flat `[g1,g2]` array; commons confirms this array is populated from `opponents[].score`).
- Per-leg label → stored as `NormalizedGameEntry.Map` ("1st Leg" / "Penalties" …).
- Per-leg `winner`, `length`, `finished` → mapped.
- **Penalty shoot-out scores** → captured **incidentally**: we pass each game's `extradata` straight through into `NormalizedGameEntry.ExtraData`, so `penaltyscores` rides along (just unlabelled).
- Streams + VOD → `normalizeMatchStreams`, `LiqMatch.Vod`.

**Available but NOT parsed / not surfaced:**
1. **Match-level `extradata` is dropped entirely.** `NormalizeLiqMatch` never reads `m.ExtraData`, so **`hassubmatches`** (the flag that tells you whether the score is aggregate-goals vs submatch-wins) — plus `comment`, `timezoneid` — never reach the frontend. Without it you can't correctly label/interpret the opponent score.
2. **Per-leg `opponents[]` objects are ignored.** We only read the flat `scores` array and the legacy `participants` map. For the **club/submatch** format the per-leg player lineups live in `match2games[].opponents[].players` (and per-side leg status), which our `normalizeGameParticipants` (keyed on `"1_1"` style maps) does **not** pick up. (For the dominant 1v1 format this is moot — the player is the match-level opponent.)
3. `match2games[].subgroup` (leg/submatch ordering), per-leg `date`/`vod`, opponent `placement`, opponent `extradata.advances/bg` — requested in the blob but not mapped.
4. `penaltyscores` is captured only as opaque `ExtraData` — not normalized into a typed penalty field.

**Single biggest gap:** we **discard the match-level `extradata`**, losing **`hassubmatches`** — the one flag needed to know whether the opponent score means *aggregate goals* (1v1) or *submatch wins* (club), i.e. how to render the scoreline at all. (Caveat to verify against a live API sample once un-rate-limited: that `match2games[].scores` is in fact populated for `easportsfc` — Liquipedia's storage code populates it from `opponents[].score`, but a byte-level confirmation from `api.liquipedia.net` was blocked by HTTP 429.)

---

## 8. Proposed max-info detailed-match view for EA FC

Given how sparse the schema is, a "max info" EA FC page is essentially: **identity + scoreline structure + penalties + the live stream.** Concretely:

**Header**
- Player A vs Player B (avatars/flags from opponent `icon`/player `flag`), tournament name + tier + icon, date/time, Bo (`bestof`), status badge (live / finished).
- Big **aggregate scoreline** from `match2opponents[].score` — **labelled using `hassubmatches`** ("Aggregate 4–2" for 1v1 goals vs "Series 2–1" for club submatch wins). *(requires fixing gap #1.)*

**Legs table** (the core content — from `match2games[]`)
- One row per leg: leg label (`map`), **goals** `opponents[0].score – opponents[1].score`, winner highlight, optional `length`/`date`, per-leg VOD link.
- If a `"Penalties"` leg exists: render `(p1)–(p2)` from `extradata.penaltyscores`. *(surface penalties as a typed field — gap #4.)*
- Submatch (club) mode: show the per-leg lineup (`opponents[].players`) and per-submatch goal + penalty scores. *(requires gap #2.)*

**Live block**
- Embedded Twitch/YouTube player from `stream` (the only true real-time element). Show "watch live" when `status=running` and a stream handle exists. Post-match: swap to `vod`.

**Context**
- Bracket position (`match2bracketdata` → section/round header), links to both player pages and the tournament page.

**Explicitly NOT available — do not design UI around these (would require fabrication):**
- Possession, shots/shots-on-target, xG, formation, cards, minute-by-minute timeline, club/nation used per player, per-player goal/assist stats. None of these exist anywhere in the `easportsfc` match2 schema.
