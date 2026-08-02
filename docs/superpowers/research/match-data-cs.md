# Counter-Strike 2 — Match data (Liquipedia wiki `counterstrike`)

> Internal acronym `csgo` · frontend slug `cs` · Liquipedia wiki `counterstrike`.
> Scope: every field the Liquipedia API v3 `match` endpoint (match2 schema) exposes for CS2, what we already parse, what's live, and a realistic max-info detailed-match view.

## Sourcing note / method

- **Primary sources** (authoritative — this is the code that *produces* the stored data and renders the wiki):
  - Liquipedia's open-source Lua modules on GitHub (`github.com/Liquipedia/Lua-Modules`):
    - `lua/wikis/counterstrike/MatchGroup/Input/Custom.lua` — defines exactly which match-level and per-map `extradata` keys CS2 stores.
    - `lua/wikis/counterstrike/MatchSummary.lua` — defines exactly what the CS2 match page renders.
    - `lua/wikis/counterstrike/MatchExternalLinks.lua` — the external match/stats providers CS2 links out to.
    - `lua/wikis/commons/MatchGroup/Input/Util.lua` — `standardProcessMaps` (per-game schema) and `getMapVeto` (veto structure).
  - Our own Go models / queries: `backend-go/internal/models/liquipedia_match.go`, `backend-go/internal/services/liquipedia_poller.go` (`LiqMatchQueryFields`).
- **Could NOT fetch**: live `api.liquipedia.net` (IP rate-limited, per task constraint) and `liquipedia.net` rendered match pages (returned HTTP 429 on every WebFetch attempt during this session). The Lua module source is the source of truth for field names and is more reliable than scraping a rendered page, so findings below are grounded in it. No field below is invented.
- **Live? legend**: **L** = updates during a running match · **F** = final / post-match only · **?** = uncertain.

---

## 1. Identity & opponent format

- **Opponent format**: **2 teams (best-of-N series)**. CS2 `OPPONENT_CONFIG` in `Input/Custom.lua` sets `maxNumPlayers = 5` (standard 5v5), default mode `team`. Matches are 1v1 between two team opponents; an FFA path exists in the module but is irrelevant to pro CS2 (no real pro FFA CS).
- A match is a **series of maps** (`bestof` = 1/2/3/5…). Each map is one `match2games` entry.
- Our pipeline already drops any match without 2 named, non-`TBD`, non-`literal` opponents (`LiqMatch.HasTwoNamedOpponents`, `liquipedia_match.go:75`).
- Map pool format is MR12 (CS2 standard: first to 13, 12+12 regulation halves) — Liquipedia does not store an explicit "MR12/MR15" flag; the half-score arrays make it derivable (sum of a team's two regulation halves = 13 for a won map). CS:GO legacy maps were MR15 (first to 16). **Source**: derived from `t1halfs`/`t2halfs` arrays (`Input/Custom.lua` `_getHalfScores`).

---

## 2. Match-level fields

Top-level fields of the `match` datapoint we already request via `LiqMatchQueryFields` (`liquipedia_poller.go:47`) and map in `LiqMatch` (`liquipedia_match.go:14`).

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `pageid` | int | Liquipedia page id (our `NormalizedMatch.id`) | `LiqMatch.PageID` | F |
| `pagename` | string | wiki page (e.g. `BLAST/Premier/...`) | `LiqMatch.PageName` | F |
| `objectname` | string | unique object key (used for dedup) | `LiqMatch.ObjectName` | F |
| `match2id` | string | alphanumeric match id (detail navigation) | `LiqMatch.Match2ID` | F |
| `match2bracketid` | string | bracket this match belongs to | `LiqMatch.Match2BracketID` | F |
| `status` | string | match status (empty / not-played markers) | `LiqMatch.Status` | L |
| `winner` | string | `"1"`/`"2"` winning opponent index, `"0"`/empty if none | `LiqMatch.Winner` | L (set when decided) |
| `walkover` | string | walkover/forfeit indicator | `LiqMatch.Walkover` | F |
| `resulttype` | string | e.g. default/np/draw | `LiqMatch.ResultType` | F |
| `finished` | int (0/1) | 1 = series over | `LiqMatch.Finished` | L |
| `mode` | string | match mode (`team`) | `LiqMatch.Mode` | F |
| `bestof` | int | maps in series (Bo1/3/5) | `LiqMatch.BestOf` | F |
| `date` | string | start datetime `YYYY-MM-DD HH:MM:SS` (UTC) | `LiqMatch.Date` | F |
| `dateexact` | int (0/1) | 1 = exact time known | `LiqMatch.DateExact` | F |
| `game` | string | game version tag (e.g. `cs2`, `csgo`) | `LiqMatch.Game` | F |
| `patch` | string | game patch | `LiqMatch.Patch` | F |
| `vod` | string | series VOD link | `LiqMatch.Vod` | F |
| `stream` | object | live stream handles per platform (twitch/youtube/…) | `LiqMatch.Stream` (raw) | L |
| `links` | object | external match/stats links (HLTV, FACEIT, …) — see §4 | `LiqMatch.Links` (raw) | F |
| `extradata` | object | CS2 match-level extras: `mapveto`, `featured`, `overturned`, `hidden`, `status` | `LiqMatch.ExtraData` (raw) | mostly F (`mapveto` L as picks happen) |
| `tournament` | string | tournament name | `LiqMatch.Tournament` | F |
| `parent` | string | parent tournament page | `LiqMatch.Parent` | F |
| `series` | string | series/circuit name | `LiqMatch.Series` | F |
| `tickername` / `shortname` | string | display names | `LiqMatch.TickerName/ShortName` | F |
| `section` | string | bracket section/round label | `LiqMatch.Section` | F |
| `liquipediatier` | string | tier (1/2/3…) | `LiqMatch.LiquipediaTier` | F |
| `liquipediatiertype` | string | tier qualifier (Qualifier/Showmatch…) | `LiqMatch.LiquipediaTierType` | F |
| `publishertier` | string | Valve/publisher tier (e.g. Major) | `LiqMatch.PublisherTier` | F |
| `icon` / `iconurl` / `icondark` / `icondarkurl` | string | tournament icons | `LiqMatch.Icon*` | F |
| `match2opponents` | array | the 2 teams — see §3 | `LiqMatch.Match2Opponents` (raw) | L (scores) |
| `match2games` | array | per-map data — see §4 | `LiqMatch.Match2Games` (raw) | L |
| `match2bracketdata` | object | bracket positioning (next/upper/lower) | `LiqMatch.Match2BracketData` (raw) | F |

**Match-level `extradata` keys (CS2-specific)** — `Input/Custom.lua` `MatchFunctions.getExtraData`:

| key | type | meaning | source | live? |
|---|---|---|---|---|
| `mapveto` | array | the full ban/pick sequence — see §4 veto block | `MatchFunctions.getExtraData` → `getMapVeto` | L |
| `featured` | bool | marquee match (tier 1/2 or high-earnings teams) | `MatchFunctions.isFeatured` | F |
| `overturned` | bool | result overturned (e.g. ruling) | `Logic.isNotEmpty(match.overturned)` | F |
| `hidden` | bool | hidden from listings | `Variables match_hidden` | F |
| `status` | string | set to the finished-input when match was "not played" | `processMatch` | F |

---

## 3. Opponent / team fields — `match2opponents`

Each of the 2 entries (`LiqOpponent`, `liquipedia_match.go:59`):

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `id` | int | opponent index (1, 2) | `LiqOpponent.ID` | F |
| `name` | string | team page name | `LiqOpponent.Name` | F |
| `template` | string | team short template (→ our acronym) | `LiqOpponent.Template` | F |
| `type` | string | `team` / `literal` (TBD) / `solo` | `LiqOpponent.Type` | F |
| `score` | string/int | **series score** (maps won); Liquipedia uses `-1` for "no score yet" (we clamp to 0) | `LiqOpponent.Score` → `parseScore` | **L** |
| `status` | string | opponent result status (`S` scored / `W` / `L` / `FF` forfeit / `DQ` …) | `LiqOpponent.Status` | L |
| `placement` | int | final placement (when applicable) | (in raw, not modelled) | F |
| `icon`/`iconurl`/`icondark`/`icondarkurl` | string | team logo (light/dark) | `LiqOpponent.Icon*` | F |
| `match2players` | array | the team roster for this match — see below | `LiqOpponent.Match2Players` (raw) | F |

**`match2players` (per team, up to 5)** — standard match2 opponent players. CS2 does **NOT** attach any in-match performance stats here (see §5). Each player carries identity only:

| field | type | meaning | live? |
|---|---|---|---|
| `name` | string | player page name | F |
| `displayname` | string | display nick | F |
| `flag` | string | country | F |
| `pageid` / `extradata` | int/obj | page reference / minor extras | F |

> We currently parse `score` (→ `Results[].score`) and team identity/logo (→ `NormalizedTeamCompact`), but **we do not surface the per-team `match2players` roster** into `NormalizedMatch`.

---

## 4. Per-game (per-map) fields — `match2games`

Per-map schema produced by `standardProcessMaps` (`commons/MatchGroup/Input/Util.lua:1248`) + CS2 `MapFunctions`. We pass most of this through `NormalizedGameEntry` (`liquipedia_match.go:165`); the raw map `extradata` lands in `NormalizedGameEntry.ExtraData`.

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `map` | string | map name (e.g. `Mirage`, `Inferno`, `Nuke`) | `gameData["map"]` → `NormalizedGameEntry.Map` | F (set when map starts) |
| `winner` | string | `"1"`/`"2"` map winner index | `gameData["winner"]` | L (on map end) |
| `scores` | array[int] | **total rounds per team** on this map (e.g. `[13, 9]`) | `gameData["scores"]` → `NormalizedGameEntry.Scores` | **L** |
| `finished` | bool | map completed | `gameData["finished"]` | L |
| `status` | string | map status | derived | L |
| `length` | int? | duration — **CS2 does not populate this** (no `getLength` in CS `MapFunctions`) | `gameData["length"]` | — |
| `opponents[].score` | int | per-team map round total | `Util.lua:1294` | L |
| `opponents[].players` | array | **always empty/absent for CS2** (no `getPlayersOfMapOpponent`) | `Util.lua:1302` | — |
| `vod` | string | per-map VOD | `gameData["vod"]` (raw; **we don't parse it**) | F |
| `subgroup` / `date` | int/string | map ordering / per-map datetime | `Util.lua` | F |
| `extradata` | object | **CS2 half/side scores** — see below | `gameData["extradata"]` → `NormalizedGameEntry.ExtraData` | **L** |

**Per-map `extradata` keys (CS2-specific)** — `Input/Custom.lua` `MapFunctions._getHalfScores`. These are the richest live CS2 data Liquipedia stores:

| key | type | meaning | source | live? |
|---|---|---|---|---|
| `t1halfs` | array[int] | team 1's rounds won **per half** in order (regulation H1, H2, then OT halves) e.g. `[9, 3, 1]` | `_getHalfScores` | **L** |
| `t2halfs` | array[int] | team 2's rounds won per half | `_getHalfScores` | **L** |
| `t1sides` | array[str] | team 1's side per half: `"ct"` / `"t"` (parallel to `t1halfs`) | `_getHalfScores` | L |
| `t2sides` | array[str] | team 2's side per half | `_getHalfScores` | L |
| `displayname` | string | map display name override | `standardProcessMaps:1331` | F |

> Input mechanics (for completeness): editors enter `t1firstside` (`ct`/`t`), `t1ct`/`t1t`/`t2ct`/`t2t` per map, and overtime halves prefixed `o1...`, `o2...`. The module collapses these into the four arrays above. The total map score = sum of a team's `tNhalfs`.

**Map veto — `match.extradata.mapveto`** (array; `getMapVeto`, `Util.lua:589`). Order = veto sequence:

| key | type | meaning | live? |
|---|---|---|---|
| `type` | string | `ban` / `pick` / `decider` | L |
| `team1` | string | map team 1 banned/picked at this step | L |
| `team2` | string | map team 2 banned/picked at this step | L |
| `decider` | string | the decider map (for `type=decider`) | L |
| `vetostart` | string | which team vetoes first (on entry [0]) | L |
| `format` | string | veto format label (on entry [0]) | F |

**External match & stats links — `match.links`** (`MatchExternalLinks.lua`). CS2 links out to **HLTV** (`hltv`/`legacystats`/`stats` → per-map `mapstatsid`), **FACEIT**, **ESEA**, **ESL Play**, **Esportal**, **Esplay**, **Gamers Club**, **Draft5**, **5EPlay/5Ewin/5E Arena**, **B5csgo**, **FASTCUP**, **99Damage**, **Pinger**, **SoStronk**, plus `preview` / `lrthread` (live report). The detailed per-player stats CS fans expect (ADR/KAST/rating) live on these external sites — **HLTV is the canonical one** — not inside Liquipedia. (We fetch `links` but do not surface it.)

---

## 5. Per-player fields (game-specific stats)

**Critical finding — CS2 stores essentially NO per-player in-match statistics in Liquipedia.**

- The CS2 map parser (`Input/Custom.lua` `MapFunctions`) implements **only** `getExtraData` (half scores) and `calculateMapScore`. It does **not** implement `getPlayersOfMapOpponent`, so `match2games[].opponents[].players` is empty for CS2 (`Util.lua:1302` makes that function optional).
- `MatchSummary.lua` renders only: map name, map score, per-half partial scores with CT/T color, the map veto, VOD/stat links, and a match comment. **There is no player stats table.** (Contrast: Valorant/LoL CS modules *do* implement `getPlayersOfMapOpponent` with rich stats; CS2 deliberately does not.)

So none of the game-specific stats the brief asks to hunt for are available from Liquipedia for CS2:

| desired stat | available in Liquipedia CS2? | where it actually lives |
|---|---|---|
| per-player K / D / A | **NO** | HLTV / FACEIT (external link) |
| ADR | **NO** | HLTV |
| KAST | **NO** | HLTV |
| HLTV rating (1.0/2.0) | **NO** | HLTV |
| HS% | **NO** | HLTV |
| first kills / opening duels | **NO** | HLTV |
| clutches / multikills | **NO** | HLTV |
| utility / flash damage | **NO** | HLTV |
| per-round economy / kill feed | **NO** | nowhere public via API; in-game/HLTV demo only |

The **only** per-player data Liquipedia exposes for a CS2 match is **identity** (match-level `match2players`): player name, displayname, country flag, page link, and the (up to 5) roster per team — all **F** (final). These are not even per-map; they are the match roster.

> Net: for a CS2 "max-info" page, per-player performance must come from an external source (HLTV match link from `match.links`) — Liquipedia cannot supply it.

---

## 6. Live capability

**What Liquipedia provides for a running CS2 match (L):**
- Series score per team (`match2opponents[].score`) — updates as maps are decided.
- Per-map round totals (`match2games[].scores`) and per-half scores/sides (`t1halfs`/`t2halfs`/`t1sides`/`t2sides`) — fill in as halves/rounds complete.
- Map winner / `finished` per map, overall `winner` / `finished` when decided.
- Map veto (`mapveto`) — appears as picks/bans are entered, usually before/at series start.
- Stream handles (`stream`) — the actual live video (Twitch/YouTube) for real-time viewing.

**What it does NOT provide (no real-time in-game telemetry — explicitly confirmed):**
- **No live kill feed**, no tick-by-tick or per-round events.
- **No live player KDA/ADR/HP/economy/positions** — there are no per-player stat fields at all (§5).
- No bomb/round-timer/utility state.

**Important caveat on "live":** Liquipedia match data is **community/bot-edited**, not a real-time game feed. For covered (tier 1/2) matches, live-reporting bots/editors update scores within seconds-to-minutes of each round/map. Latency and completeness depend on whether someone is live-reporting that match — lower-tier matches may only get a final result. So treat live fields as **near-live, best-effort**, not a guaranteed real-time socket. Cache TTLs on our side (`liq:matches:running` 10 min, poller 8 min) add further lag; a detailed live page would want a tighter on-demand fetch of the single match.

For genuine real-time per-player telemetry, the only path is the external **HLTV** match page (linked in `match.links`) or the live stream embed — neither is structured data we can ingest cleanly.

---

## 7. Gap analysis — what we already parse vs available-but-unparsed

**Already parsed / surfaced** (`liquipedia_match.go`):
- All scalar match fields (id, name, status, dates, bestof→`number_of_games`/`match_type`, winner, tier, tournament/series/league, videogame). ✅
- Opponents: identity, logo (light/dark derivation), template→acronym, and **series score** (`Results[].score`). ✅
- Streams: normalized to embed/raw URLs with main-stream priority (`normalizeMatchStreams`). ✅
- Per-map: `map`, `scores`, `winner`→team id, `finished`/`status`, and **raw map `extradata` passed through** (`NormalizedGameEntry.ExtraData`) — so `t1halfs/t2halfs/t1sides/t2sides` **are already available to the frontend** (just unused). ✅
- Generic per-player participant normalizer exists (`normalizeGameParticipants`, KDA + `Extra`) — but for CS2 it receives nothing because CS has no participants. ⚠️ (works for Valorant/LoL, no-op for CS)
- Bracket fields (`Section`, `Match2BracketID`). ✅

**Fetched from the API but DROPPED in normalization** (present on `LiqMatch`, absent on `NormalizedMatch`):
- **`extradata.mapveto`** — the full ban/pick sequence. **Biggest gap.** We request match `extradata` but `NormalizeLiqMatch` never reads `m.ExtraData`, so map veto, `featured`, `overturned` are lost. *(High value, zero extra API cost — already in the payload.)*
- **`links`** — HLTV/FACEIT/ESEA/etc. external stats & match links. We fetch `m.Links`, never surface it. This is the only route to per-player CS stats.
- **`patch`** — on `LiqMatch`, not on `NormalizedMatch`.
- **Match-level `vod`** and **per-map `vod`** — `m.Vod` and `gameData["vod"]` not parsed (we only handle live streams, not VODs).
- **Per-team `match2players` roster** — fetched inside `match2opponents` raw but not extracted into the normalized opponent.
- **`publishertier`, `walkover`, `resulttype`, opponent `status`/`placement`** — modelled on raw structs but not all carried to the normalized output.

**Not available anywhere from Liquipedia (cannot be a gap on our side):**
- All per-player performance stats (KDA/ADR/KAST/rating/HS%/clutches/openings) — §5.
- Real-time in-game telemetry — §6.

---

## 8. Proposed max-info detailed-match view for CS2 (realistic field set)

Everything below is achievable **from Liquipedia data we already fetch** unless marked *(external)*. No new API fields beyond what `LiqMatchQueryFields` already requests.

**Header**
- Both team logos (light/dark), names, acronyms — *parsed*.
- **Series score** (maps won) — *parsed*, live.
- Bo-N format, tier badge (+ publisher tier / "Major"), tournament + series + round/section — *parsed* (publisher tier needs surfacing).
- Status pill: upcoming / **LIVE** / finished — *parsed*; date/time (localized) — *parsed*.
- Live stream embed (Twitch/YouTube) when running — *parsed*.

**Map veto strip** *(needs surfacing `extradata.mapveto`)*
- Ordered ban/pick/decider chips: `Team A ban Anubis`, `Team B pick Mirage`, … with `vetostart`/`format` — available, currently dropped.

**Per-map breakdown** (one card per `match2games` entry)
- Map name + thumbnail (map name → asset) — *parsed*.
- Final/live round score `13–9` — *parsed* (`scores`).
- **Half-by-half with CT/T sides**: render `t1halfs`/`t2halfs` zipped with `t1sides`/`t2sides` (e.g. `CT 9 – 3 T` | `T 4 – 9 CT` | OT…) — **already in `NormalizedGameEntry.ExtraData`**, just render it. Live.
- Map winner highlight — *parsed*.
- Per-map external stats/VOD buttons *(needs surfacing `links` map-stats + per-map `vod`)*.

**Rosters**
- Each team's up-to-5 players with country flag, linking to player page *(needs surfacing `match2players`)* — identity only.

**External deep-links** *(needs surfacing `links`)*
- "Full stats on HLTV / FACEIT / ESEA" buttons — the realistic way to give users ADR/KAST/rating without us storing them.

**Footer / meta**
- Patch *(needs surfacing `patch`)*, series VOD *(needs surfacing `vod`)*, tournament link — mostly available.

**Explicitly OUT of scope (cannot deliver from Liquipedia):**
- Per-player KDA/ADR/KAST/rating/HS% tables, live kill feed, round-by-round economy/timeline. If these are required, integrate HLTV (out of band) or embed the HLTV match page link only. Do **not** fabricate these.

**Live strategy**: for the detail page of a *running* match, bypass the 8–10 min poller cache and do an on-demand single-match fetch (`MakeRequest` with a short TTL) so half-scores/series-score refresh closer to real time — but communicate to users it's near-live (community-reported), not a real-time game feed.
