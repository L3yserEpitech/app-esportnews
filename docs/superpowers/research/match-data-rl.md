# Rocket League — Match data (Liquipedia wiki `rocketleague`)

> Internal acronym `rl` · frontend slug `rl` · Liquipedia wiki `rocketleague`.
> Purpose: enumerate **every** match field Liquipedia exposes for Rocket League, to design a max-info detailed-match page.
> **Live? legend:** `L` = updates while the series is live · `F` = only reliably present once the game/series is finished · `?` = depends on editor/automation, not guaranteed.

## Sources used

All claims below trace to one of these. Liquipedia data is the `match` datapoint (match2 schema): `match2opponents` → `match2players`, and `match2games` (one row per game in the series), with `extradata` maps at match / opponent / game level.

- **Our Go model** — `backend-go/internal/models/liquipedia_match.go` (what we currently parse).
- **Our query** — `LiqMatchQueryFields` in `backend-go/internal/services/liquipedia_poller.go:47` (fields we request).
- **RL input schema** — `Module:MatchGroup/Input/Custom` (rocketleague), GitHub `Liquipedia/Lua-Modules` → `lua/wikis/rocketleague/MatchGroup/Input/Custom.lua`. Defines RL-specific extradata.
- **RL display** — `Module:MatchSummary` (rocketleague), `lua/wikis/rocketleague/MatchSummary.lua`. Proves what RL actually renders → what data exists.
- **RL game config** — `Module:Info` (rocketleague), `lua/wikis/rocketleague/Info.lua`. Default mode / team size.
- **Shared schema** — commons `Module:MatchGroup/Util` (`lua/wikis/commons/MatchGroup/Util.lua`, `gameFromRecord`/`opponentFromRecord`/`playerFromRecord`) and commons `Module:MatchGroup/Input/Util` (`standardProcessMaps`, `standardProcessMatch`). Define the generic record field names returned by the API.
- **API docs** — `liquipedia.net/commons/Help:LiquipediaDB/Match` and `liquipedia.net/api` (consulted via search; direct fetch was HTTP 429 throttled, so field-name confirmation comes from the Lua source above, which reads the same records the API serves).

> Note: direct WebFetch of `liquipedia.net` pages returned HTTP 429 throughout this research, so a live RL match page could not be scraped. Every field below is instead backed by the open-source Lua modules that **produce and consume** these exact records, plus our own parser. Nothing here is inferred from a rendered page alone.

---

## 1. Identity & opponent format

- **Opponent format: `3v3` teams.** `Info.lua` sets `config.participants.defaultPlayerNumber = 3` and the RL parser sets `DEFAULT_MODE = '3v3'` (`MatchGroup/Input/Custom.lua`). Some events are `2v2` (e.g. RLCS 2v2 World Championship) or `1v1`; the per-match/per-game `mode` field carries the actual value. Opponents are almost always **teams** (`type = "team"`), occasionally `literal`/TBD.
- **Match identity:** `pageid` (numeric, what we expose as `id`), `match2id` (alphanumeric, e.g. `BAS26LCQD6_0001` — the real per-match key), `match2bracketid`, `objectname`, `pagename`. Source: `LiqMatch` struct, `liquipedia_match.go:14-55`.
- **Two named opponents** is enforced before display: `LiqMatch.HasTwoNamedOpponents()` (`liquipedia_match.go:75`).
- **Game variants:** `Info.lua` games = `rl` (Rocket League) and `sarpbc` (legacy predecessor). The `game` field on match/game distinguishes them.

---

## 2. Match-level fields

All requested via `LiqMatchQueryFields` and mapped onto the `LiqMatch` struct (`liquipedia_match.go:14`). `extradata` is requested but **not surfaced** by `NormalizeLiqMatch` (see §7).

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `pageid` | int | numeric page id (our `id`) | `LiqMatch.PageID` | F |
| `match2id` | string | unique match key (alphanumeric) | `LiqMatch.Match2ID` | L |
| `match2bracketid` | string | bracket this match belongs to | `LiqMatch.Match2BracketID` | L |
| `objectname` / `pagename` | string | LPDB object / wiki page | `LiqMatch.ObjectName/PageName` | L |
| `status` | string | match status (LPDB) | `LiqMatch.Status` | L |
| `winner` | string | `"1"`/`"2"`/`""` winning opponent index | `LiqMatch.Winner` | F |
| `walkover` | string | walkover type (`l`/`ff`/`dq`) | `LiqMatch.Walkover` | F |
| `resulttype` | string | e.g. default/np | `LiqMatch.ResultType` | F |
| `finished` | int(0/1) | series complete | `LiqMatch.Finished` | F (the 0→1 flip) |
| `bestof` | int | series length (Bo3/Bo5/Bo7…) | `LiqMatch.BestOf` | L |
| `mode` | string | `3v3`/`2v2`/`1v1` | `LiqMatch.Mode` | L |
| `type` | string | match type | `LiqMatch.Type` | L |
| `section` | string | bracket section/round label | `LiqMatch.Section` | L |
| `game` | string | `rl`/`sarpbc` | `LiqMatch.Game` | L |
| `patch` | string | game patch | `LiqMatch.Patch` | ? |
| `date` | string `YYYY-MM-DD HH:MM:SS` | scheduled/start time (UTC) | `LiqMatch.Date` → `begin_at` | L |
| `dateexact` | int(0/1) | whether time (not just date) is known | `LiqMatch.DateExact` | L |
| `vod` | string | series VOD URL | `LiqMatch.Vod` | F |
| `tournament` / `parent` | string | tournament name / parent page | `LiqMatch.Tournament/Parent` | L |
| `tickername` / `shortname` | string | display names | `LiqMatch.TickerName/ShortName` | L |
| `series` | string | series/league name | `LiqMatch.Series` | L |
| `icon` / `iconurl` / `icondark` / `icondarkurl` | string | tournament icons | `LiqMatch.Icon*` | L |
| `liquipediatier` | string | tier (1,2,3…) | `LiqMatch.LiquipediaTier` | L |
| `liquipediatiertype` | string | tier type (Qualifier/Showmatch…) | `LiqMatch.LiquipediaTierType` | L |
| `publishertier` | string | publisher tier (e.g. RLCS premier flag) | `LiqMatch.PublisherTier` | L |
| `match2opponents` | json | opponents array (see §3) | `LiqMatch.Match2Opponents` | L |
| `match2games` | json | per-game array (see §4) | `LiqMatch.Match2Games` | L |
| `stream` | json | stream platforms→channels (with `rawstreams=true&streamurls=true`) | `LiqMatch.Stream` | L |
| `links` | json | external links | `LiqMatch.Links` | L |
| `extradata` | json | **match-level extradata (see below) — requested but dropped by our normalizer** | `LiqMatch.ExtraData` | mixed |
| `match2bracketdata` | json | bracket positioning / advance edges | `LiqMatch.Match2BracketData` | L |

**Match-level `extradata` keys for Rocket League** (from `standardProcessMatch` + RL `getExtraData`, `MatchGroup/Input/Custom.lua` + `MatchGroup/Input/Util.lua:1193`):

| extradata key | type | meaning | source | live? |
|---|---|---|---|---|
| `casters` | array | broadcaster/caster list (name, flag) | commons `readCasters`, `Info.config.match2.sortCasters=true` | L |
| `isfeatured` | bool | featured match flag (tier 1/2, RLCS premier, or ≥ $10k team earnings) | RL `getExtraData` | L |
| `hasopponent1` / `hasopponent2` | bool | opponent-present flags | RL `getExtraData` | L |
| `liquipediatiertype2` | string | secondary tier type | RL `getExtraData` | L |
| `comment`, `timestamp`, `timezoneid` | string/num | generic match metadata | commons `MatchGroupUtil.matchFromRecord` (`Util.lua:570,596,597`) | L |

> **No match-level `mvp` for Rocket League.** The shared `standardProcessMatch` path does **not** populate `mvp`, and the RL `getExtraData` does not add it. MVP exists in the schema generically but RL doesn't fill it.

---

## 3. Opponent / team fields

Per entry of `match2opponents` (parsed into `LiqOpponent`, `liquipedia_match.go:59`; record shape from `MatchGroupUtil.opponentFromRecord`, `Util.lua:683`):

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `name` | string | team page name | `LiqOpponent.Name` | L |
| `template` | string | team shortname/template (→ acronym, logo) | `LiqOpponent.Template` | L |
| `type` | string | `team` / `literal` | `LiqOpponent.Type` | L |
| `id` | int | opponent index (1,2) | `LiqOpponent.ID` | L |
| `score` | int/string | **series score = games (sets) won** | `LiqOpponent.Score` → `results[].score` | L |
| `status` | string | `S`(score) / `W` / `L` / `FF` / `DQ` | `LiqOpponent.Status` | L/F |
| `icon`/`iconurl`/`icondark`/`icondarkurl` | string | team logos (light/dark) | `LiqOpponent.Icon*` | L |
| `match2players` | json | roster for this opponent (see §5) | `LiqOpponent.Match2Players` | L |
| `placement` | int | final placement (bracket) | `opponentFromRecord` (`Util.lua:702`) — **not in our struct** | F |
| `extradata` | json | **per-series goal breakdown — NOT parsed by us** | `opponentFromRecord` | L |

**Opponent `extradata` keys for Rocket League** (from RL `getOpponentExtradata`, `MatchGroup/Input/Custom.lua`). Present only when a secondary score is given (the legacy "goals per game" entry style):

| extradata key | type | meaning | live? |
|---|---|---|---|
| `score1`, `score2`, `score3` | int | **goals this team scored in game 1 / 2 / 3** | L |
| `set1win`, `set2win`, `set3win` | bool | whether this team won game 1 / 2 / 3 | L |
| `additionalScores` | bool | true when score1/2/3 present (then `opponent.score` is derived as set wins) | L |

> Important distinction: **`opponent.score` = number of games won in the series**; per-game goal totals live either in opponent `extradata.scoreN` (legacy entry) or in `match2games[i].scores` / `match2games[i].opponents[].score` (modern entry, see §4). For modern RL matches the per-game array (§4) is the reliable source of goal counts.

**`match2players` (roster) fields** (`MatchGroupUtil.playerFromRecord`, `Util.lua:730`): `displayname`, `name` (page name), `flag` (country), `extradata.faction`, `extradata.playerteam`. These are **roster identities, not stats**.

---

## 4. Per-game fields — `match2games`

One element per game in the series. Parsed into `NormalizedGameEntry` (`liquipedia_match.go:165`). Record field names from `MatchGroupUtil.gameFromRecord` (`Util.lua:747`) and `standardProcessMaps` (`MatchGroup/Input/Util.lua:1248`).

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `map` | string | arena/map name (e.g. "DFH Stadium") | `gameData["map"]` → `NormalizedGameEntry.Map` | L |
| `game` | string | `rl`/`sarpbc` | `gameFromRecord` | L |
| `mode` | string | per-game mode (`3v3`…) | `gameFromRecord` | L |
| `winner` | int(1/2) | winning opponent of this game | `gameData["winner"]` → `Winner` | F (per game) |
| `scores` | number[] | **`[team1 goals, team2 goals]` for this game** | `gameData["scores"]` → `Scores []int` | L |
| `opponents` | array | `[{score, status, players}]` per game (modern shape; `score` = goals) | `gameFromRecord` (record.opponents) — **we read `scores` instead, not `opponents`** | L |
| `length` | num/string | game duration (seconds) | `gameData["length"]` → `Length` | F |
| `finished` | bool/int | game complete | `gameData["finished"]` → `Finished` | F (per game) |
| `status` | string | game status | `gameFromRecord` | L |
| `resulttype` | string | result type | `gameFromRecord` | F |
| `walkover` | string | per-game walkover | `gameFromRecord` | F |
| `subgroup` | int | sub-series grouping | `gameFromRecord` | L |
| `type` | string | game type | `gameFromRecord` | L |
| `date` | string | per-game timestamp | `gameFromRecord` | ? |
| `patch` | string | per-game patch | `gameFromRecord` | ? |
| `vod` | string | **per-game VOD URL — NOT parsed by us** | `gameFromRecord` | F |
| `participants` | object | legacy `X_Y`→stats map (see §5) — **empty for modern RL** | `gameData["participants"]` → `Participants` | n/a |
| `extradata` | object | **RL game-specific extradata (below)** | `gameData["extradata"]` → `ExtraData` (pass-through) | L |

**Per-game `extradata` keys for Rocket League** (from RL `MapFunctions.getExtraData`, `MatchGroup/Input/Custom.lua`, and rendered by `MatchSummary.lua`):

| extradata key | type | meaning | source | live? |
|---|---|---|---|---|
| `ot` | bool | **game went to overtime** | RL `getExtraData`; `MatchSummary` renders " - OT" | F |
| `otlength` | string | overtime duration (e.g. `1:23`) | RL `getExtraData`; rendered " (otlength)" | F |
| `timeout` | int[] | which team(s) called timeout (`1`/`2`) | RL `getExtraData`; rendered with timeout icon | F |
| `t1goals` / `t2goals` | string | **team 1 / team 2 "goal times"** (when goals were scored), shown as `Abbreviation` titled "Team N Goaltimes" | RL `getExtraData`; `MatchSummary._goalDisaplay` | F |
| `header` | string | optional game header/label | RL `getExtraData`; rendered bold above the game | L |
| `comment` | string | per-game comment | `gameFromRecord` | F |
| `dateexact`, `displayname` | string | exactness flag / map display name override | `gameFromRecord` | L |

> `t1goals`/`t2goals` are **goal-time annotations (text)**, not counts. The **goal counts** are `scores` / `opponents[].score`.

---

## 5. Per-player fields (goals / assists / saves / shots / score)

**Verdict: Rocket League does NOT expose per-player, per-game statistics. None. No goals, assists, saves, shots, or score/MVP at player level.** This is a data-availability fact, not a parsing gap.

Evidence:

1. **Input never collects them.** RL `MapFunctions` in `MatchGroup/Input/Custom.lua` implements only `getExtraData` and `mapIsFinished`. It does **not** implement `getPlayersOfMapOpponent`, `calculateMapScore`, or any participant-stat parser.
2. **Generic builder gates players on that hook.** In `standardProcessMaps` (`MatchGroup/Input/Util.lua:1302`): `players = Parser.getPlayersOfMapOpponent and Parser.getPlayersOfMapOpponent(...) or nil`. With no RL implementation, each game's `opponents[].players` is `nil`. So `match2games[].opponents[].players` is empty for RL.
3. **Display renders no stat lines.** `MatchSummary.lua` `createGame` renders only: map score per team (`DisplayHelper.MapScore` of `game.opponents[i]`), win/loss indicator, map name, OT marker, OT length, timeout icons, and goal-time comments. There is **no per-player table** anywhere.
4. **The legacy `participants` `X_Y` map** (key = `match2opponentid_match2playerid`, documented on `Help:LiquipediaDB/Match`) is the only schema slot that *could* hold per-player game stats. Modern RL (Info `match2.status = 2`) uses the `opponents`/`scores` shape, not `participants`, and even when present RL writes no stat fields into it. Our `normalizeGameParticipants` (`liquipedia_match.go:855`) correctly skips empty placeholders → yields nothing for RL.

| stat | available? | source | live? |
|---|---|---|---|
| player goals | **No** | not collected (no `getPlayersOfMapOpponent`) | — |
| player assists | **No** | idem | — |
| player saves | **No** | idem | — |
| player shots | **No** | idem | — |
| player score / MVP | **No** | RL fills no per-player score; no match-level `mvp` | — |
| player identity (name, flag, faction) | Yes (roster only) | `match2opponents[].match2players` (§3) | L |

The richest *player-adjacent* RL data is therefore the roster (who played) plus **team-level per-game goal counts** — not individual contribution.

---

## 6. Live capability

- **No real-time in-game telemetry.** Liquipedia exposes **no** ball position, boost, possession, live goal feed, or per-second state. Confirmed by absence in every schema/module above.
- **What "live" means here:** Liquipedia match2 records are **editor/automation-maintained**. During a live series an editor (or an ingestion bot for top events) updates the bracket: opponent `score` (games won), per-game `scores` (goals), `winner`, and `finished` flip as results are entered — typically **between games or after the series**, not goal-by-goal. So treat per-game goals/OT/timeouts as `F` (settle when the game ends) and series-level score/status as `L` but coarse.
- **The genuinely live element is the stream.** `stream` (with `rawstreams=true&streamurls=true`) gives Twitch/YouTube channels; we already build embed URLs (`normalizeMatchStreams`, `liquipedia_match.go:478`). A "live" RL page = embedded stream + best-effort series score + scheduled time. Real-time scoreboard would require a non-Liquipedia source (none integrated).
- **Freshness in our system:** running matches are polled every 8 min (`liq:matches:running:<wiki>`, TTL 10 min) per `CLAUDE.md` §12 / poller. So even the coarse score updates lag up to ~8–10 min unless a webhook forces a refresh.

---

## 7. Gap analysis — parsed vs available

**Already parsed & surfaced** (cite `liquipedia_match.go`):
- All match-level scalar fields → `LiqMatch` struct + `NormalizeLiqMatch` (`:14`, `:209`).
- Opponents + series score → `normalizeMatchOpponents` → `Opponents[]` + `Results[]` (`:393`). (`score` = games won.)
- Streams → `StreamsList[]` with embed URLs (`:478`).
- Per-game core → `normalizeMatchGames` → `Games[]`: `map`, `scores` (per-game goals), `length`, `winner`, `finished`, status (`:598`).
- Per-game `extradata` → passed through verbatim as `NormalizedGameEntry.ExtraData` (`:681-684`). So `ot`, `otlength`, `timeout`, `t1goals`, `t2goals`, `header` **reach the frontend** as a raw map — but no typed fields / no UI for them.

**Available but NOT parsed / NOT surfaced:**
1. **Match-level `extradata`** (`casters`, `isfeatured`, `liquipediatiertype2`, `comment`, `timestamp`, `timezoneid`): `LiqMatch.ExtraData` is unmarshalled into the struct but `NormalizeLiqMatch` never reads it → **dropped entirely**. Casters are the notable loss.
2. **Opponent `extradata`** (`score1/2/3`, `set1win/2/3win`, `additionalScores`): `LiqOpponent` has no `extradata` field → **dropped**. (Redundant with per-game `scores` for modern matches, but the only goal source for some legacy entries.)
3. **Opponent `placement`**: not in `LiqOpponent` → dropped (matters for bracket context).
4. **Per-game `vod`**: `normalizeMatchGames` reads `map/scores/length/winner/finished/extradata/participants` but **not** `gameData["vod"]` → per-game VODs dropped (match-level `vod` is kept).
5. **Per-game `opponents[]` (modern shape)**: we read the flat `scores` array (sufficient for goals) but ignore `opponents[].status` (which team forfeited a game, etc.).
6. **`match2bracketdata`** advance edges: parsed as raw JSON but not turned into bracket navigation.

**Single biggest gap vs what we currently parse:** the **game-level `extradata` is reaching the frontend as an untyped blob but is never rendered** — Rocket League's *entire* RL-specific richness (overtime, OT length, timeouts, goal-times) lives there and is invisible today. Closing it is pure frontend work (no new API fields needed), since `NormalizedGameEntry.ExtraData` already carries it. (Caveat: there are simply **no per-player stats to gain** — that ceiling is Liquipedia's, not ours.)

---

## 8. Proposed max-info detailed-match view for Rocket League

Everything below is buildable from data Liquipedia actually returns (no fabricated stats).

**Header**
- Team A vs Team B logos (light/dark), series score **A 3 – 2 B** (`opponent.score`), `bestof` ("Best of 5"), tier badge (`liquipediatier`/`tiertype`), `isfeatured` star, tournament name + icon (`tournament`/`series`/`icon`), date/time (`date`, respect `dateexact`), status pill (running/finished from `finished`+date).
- If running: **embedded stream** (Twitch/YouTube via `StreamsList[]`) as the primary live element. If finished: **VOD** button (`vod`).

**Per-game timeline** (one card per `match2games[]`, the core RL value-add — needs surfacing the existing `ExtraData` blob):
- Game N · **Map/Arena** (`map`) · **goal scoreline** `team1 – team2` (`scores`) · winner highlight (`winner`).
- **OT badge** when `extradata.ot` (+ `extradata.otlength`).
- **Timeout icons** per team from `extradata.timeout`.
- **Goal-times** tooltip from `extradata.t1goals`/`t2goals` (already-formatted text).
- Optional game length (`length`) and per-game VOD (needs adding `gameData["vod"]` parse).

**Rosters** (no stats available — identity only)
- Per team, the 3 players (`match2players`): display name, country flag. Clearly **no per-player goals/saves/etc.** — do not design a stat table; it cannot be filled.

**Context strip**
- Casters (needs surfacing match `extradata.casters`), bracket round (`section`), patch (`patch`), head-to-head link (RL stores a `Special:RunQuery/Head2head` link pattern).

**Explicitly out of scope (data does not exist):** live ball/boost/possession telemetry, per-player performance, live per-goal feed. The "most live" achievable RL page = embedded stream + coarse series/game scores refreshed on the poll/webhook cycle.

**Lowest-effort, highest-impact next steps**
1. Frontend: render the per-game `ExtraData` we *already pass through* (OT, OT length, timeouts, goal-times) — zero backend change.
2. Backend: surface match `extradata.casters` and per-game `vod` (two small additions in `NormalizeLiqMatch` / `normalizeMatchGames`).
3. Optional: parse opponent `extradata` set-win breakdown for legacy matches lacking a clean `match2games` array.
