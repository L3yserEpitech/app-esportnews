# 2XKO — Match data (Liquipedia SHARED wiki `fighters`)

> Research deliverable. Goal: an accurate, source-backed reference of the match data Liquipedia exposes for **2XKO** (Riot's tag fighting game), to inform a per-game detailed match page. Proposed internal acronym `2xko`, frontend slug `2xko`.
>
> **Method note / constraint:** `api.liquipedia.net` and all `liquipedia.net` HTML pages are IP-rate-limited (HTTP 429) from this environment, so no live API call was made. Evidence below comes from (a) our own match2 parser, (b) the **Liquipedia Lua-Modules** source on GitHub (`github.com/Liquipedia/Lua-Modules`) which is the authoritative definition of how the `fighters` wiki stores match data, and (c) WebSearch snippets of the public 2XKO pages. Every field is cited. Where data does not exist, it is stated explicitly — nothing is invented.

---

## 0. Shared-wiki caveat & how to filter 2XKO

**The architectural special case.** Unlike our other 9 games, **2XKO has no dedicated Liquipedia wiki.** It lives on the shared **`fighters`** wiki (Liquipedia Fighting Games Wiki), the same wiki that hosts Street Fighter 6, Tekken 8, Guilty Gear Strive, Mortal Kombat, and dozens of others. URLs look like `liquipedia.net/fighters/2XKO/...`, `liquipedia.net/fighters/Evolution_Championship_Series/2026/2XKO`, etc.

- `wikiName = 'fighters'`, `defaultGame = 'fighters'`, and the games table contains every fighting game keyed by a short id. The 2XKO entry is literally:

  ```lua
  ['2xko'] = {
      abbreviation = '2XKO',
      name = '2XKO',
      link = '2XKO',
      logo = { darkMode = '2XKO Vertical darkmode.png', lightMode = '2XKO Vertical lightmode.png' },
      ...
  }
  ```
  Source: `Liquipedia/Lua-Modules` → `lua/wikis/fighters/Info.lua` (fetched via GitHub API, full file).

**Implication for the backend.** Querying `wiki=fighters` on the `/match` (or `/tournament`) endpoint returns **ALL fighting games**, not just 2XKO. 2XKO must be isolated with a condition.

**The exact filter.** The match2 record carries a **`game`** field (we already parse it — `LiqMatch.Game string \`json:"game"\`` in `backend-go/internal/models/liquipedia_match.go:29`). For the `fighters` wiki this field holds the per-game id from `Info.lua`. **2XKO = `2xko`.** So the isolating condition is:

```
GET /match?wiki=fighters&conditions=[[game::2xko]] AND [[finished::1]] ...
```

- The fighters match parser derives this id from the tournament: `Game.toIdentifier{game = Variables.varDefault('tournament_game')}` — i.e. the match inherits the game from its parent tournament, so the `game` field is reliably populated per match. Source: `lua/wikis/fighters/MatchGroup/Input/Custom.lua` (`MapFunctions._processPlayerMapData`).
- Confirmation that `2xko` is the canonical series/game id also appears in the wiki's `Module:GameSeries` / `Module:GameName/data` (WebSearch snippet, liquipedia.net/fighters/Module:GameName/data).

**Consequences vs our normal model (important for poller/cache design):**
1. **One wiki, one shared budget.** All fighting games share the single `fighters` request budget (`liq:budget:fighters:*`). If we ever add a second fighters-wiki game (SF6, Tekken…), they compete for the same 1000 req/h quota — unlike our 1-wiki-per-game model where each game has its own budget.
2. **Every poll must carry `[[game::2xko]]`.** A naive `wiki=fighters` poll would pull SF6/Tekken/etc. and pollute the 2XKO caches. The poller's condition builder must append the game filter for this wiki.
3. **`MapAcronymToWiki` becomes many-to-one.** `2xko → fighters`. The reverse (`WikiToAcronym['fighters']`) can no longer be a single acronym; resolving a `fighters` match back to a game requires reading the match's `game` field, not the wiki name.
4. **Cache keys** keyed by wiki (`liq:matches:running:fighters`) would collide across fighting games. For 2XKO they must be namespaced by game (e.g. `...:fighters:2xko`) or by acronym, not by wiki alone.

---

## 1. Identity & opponent format

**2XKO is a 2v2 tag fighter, but competitively it is played 1v1 by a single human per side.** Each player picks a **duo of two champions** and controls both (tag, assists, two health bars) — analogous to Marvel vs. Capcom. Sources: 2XKO official site (riotgames.com, "2v2 fighting game"); Mobalytics / allthings.how / Deltia's ("in 1v1 each player picks a duo and controls both champions").

**Tournament entrants are therefore individual players, not teams.** The public 2XKO tournament pages count *players*: EVO 2026 2XKO = **1080 players**, double-elimination, $135k (liquipedia.net/fighters/Evolution_Championship_Series/2026/2XKO); Combo Breaker 2026 = 674 players; Double K.O V.4 = 13 players; LVL UP EXPO 2026 = $10k double-elim. All are single-entrant brackets.

**Opponent type in match2.** Liquipedia match2 opponents are typed `team | solo | duo | trio | quad` (Help:LiquipediaDB/Match / Module:Match). The fighters wiki sets `DEFAULT_MODE = 'singles'` and `MatchSummary._isSolo()` treats a match as solo when every opponent is `Opponent.solo` (source: `lua/wikis/fighters/MatchGroup/Input/Custom.lua`, `lua/wikis/fighters/MatchSummary.lua`). **So a standard 2XKO 1v1 bracket match has two `solo` opponents, each wrapping ONE player.** (The opponent config allows `maxNumPlayers = 10`, so a `team`/`duo` opponent is *possible* if a 2-human-per-side event is ever entered, but that is not the standard 2XKO format.)

> **Net:** model a 2XKO match as **Player A vs Player B** (each `opponent.type = "solo"`, one player inside), NOT team-vs-team. This is the single biggest data-shape difference from our other 9 games.

---

## 2. Match-level fields

These are the standard match2 fields we already parse in `liquipedia_match.go` (lines cited). They exist for 2XKO matches that are entered as brackets/match-lists. "live?" = L (live/in-progress data), F (final/post-match only), ? (present but editor-dependent).

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `pageid` / `pagename` / `objectname` | int / string | Wiki page + unique object id of the match | `liquipedia_match.go:15-19` | F |
| `match2id` | string | Stable match id within its bracket (alphanumeric) | `liquipedia_match.go:19` | F |
| `match2bracketid` | string | Parent bracket id (groups a bracket's matches) | `liquipedia_match.go:20` | F |
| `game` | string | **Game id on the shared wiki — `2xko`.** The filter field | `liquipedia_match.go:29`; `Info.lua` | F |
| `finished` | int (0/1) | Whether the match is over | `liquipedia_match.go:25` | L→F |
| `winner` | string ("1"/"2") | Winning opponent index | `liquipedia_match.go:23` | F |
| `walkover` / `resulttype` | string | Walkover / special result flag | `liquipedia_match.go:24,? ` | F |
| `bestof` | int | Best-of N (set length, e.g. 3/5) | `liquipedia_match.go:31` | F (often pre-set) |
| `date` | string `YYYY-MM-DD HH:MM:SS` | Scheduled/played time (UTC) | `liquipedia_match.go:32` | F |
| `dateexact` | int (0/1) | Whether the time is exact or date-only | `liquipedia_match.go:33` | F |
| `mode` | string | Match mode; fighters default `'singles'` | `liquipedia_match.go:26`; Input Custom | F |
| `tournament` / `parent` / `series` | string | Tournament / parent page / series name | `liquipedia_match.go:35-39` | F |
| `tickername` / `shortname` | string | Display names | `liquipedia_match.go:37-38` | F |
| `liquipediatier` / `liquipediatiertype` / `publishertier` | string | Tier classification | `liquipedia_match.go:44-46` | F |
| `icon` / `iconurl` / `icondark` / `icondarkurl` | string | Tournament icon assets | `liquipedia_match.go:40-43` | F |
| `vod` | string | VOD URL (post-match) | `liquipedia_match.go:34` | F |
| `stream` | JSON | Live stream platform→channel map | `liquipedia_match.go:51` | L |
| `match2opponents` | JSON | The two players (see §3) | `liquipedia_match.go:49` | F |
| `match2games` | JSON | Per-game entries (see §4) | `liquipedia_match.go:50` | F |
| `extradata` | JSON | Misc match-level wiki data (sparse for fighters) | `liquipedia_match.go:53` | ? |
| `links` | JSON | External links | `liquipedia_match.go:52` | F |
| `match2bracketdata` | JSON | Bracket placement/header/round metadata | `liquipedia_match.go:54` | F |

**Notes.** `patch`, `map` (match-level) etc. exist in the schema but are not meaningful for 2XKO. There is **no series/league object beyond the strings** — we synthesize one (`buildMatchLeague`, `liquipedia_match.go:740`).

---

## 3. Opponent / player fields

Per `match2opponents[]` (we parse a subset in `LiqOpponent`, `liquipedia_match.go:59-71`). For 2XKO each opponent is `type = "solo"` and contains exactly **one** player in its `match2players`.

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `type` | string | `solo` for standard 2XKO 1v1 (could be `duo`/`team` if a 2-human event is entered) | Help:LiquipediaDB/Match; `liquipedia_match.go:64` | F |
| `name` | string | Player pagename / opponent name | `liquipedia_match.go:60` | F |
| `template` | string | Team/player template (often empty for solo players) | `liquipedia_match.go:61` | F |
| `score` | string/int | **Set score** (games won in the Bo-N). `-1` = not played yet | `liquipedia_match.go:62`; `parseScore` :795 | L→F |
| `status` | string | `S` scored / `W` walkover / `FF`, etc. | `liquipedia_match.go:63` | F |
| `id` | int | Opponent slot index (1/2) | `liquipedia_match.go:65` | F |
| `icon`/`iconurl`/`icondark`/`icondarkurl` | string | Opponent flag/logo assets | `liquipedia_match.go:66-69` | F |
| `match2players` | JSON | Player list (1 entry for solo) | `liquipedia_match.go:70` | F |

**Per-player fields** (inside `match2players`, per Module:Match / Help:LiquipediaDB/Match):

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `name` | string | Player pagename | Help:LiquipediaDB/Match (match2player) | F |
| `displayname` | string | Display name (gamertag) | Help:LiquipediaDB/Match | F |
| `flag` | string | Country code/name | Help:LiquipediaDB/Match | F |
| `extradata` | JSON | Misc per-player data (sparse) | Help:LiquipediaDB/Match | ? |

> Note: the **character/duo pick is NOT on the player object** — it is recorded **per game** (see §5), because a player can switch their duo between games in a set.

---

## 4. Per-game fields — `match2games`

Each entry in `match2games[]` is one game (one match within the Bo-N set). The fighters parser is deliberately minimal. From `lua/wikis/fighters/MatchGroup/Input/Custom.lua` and `MatchSummary.lua`:

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `winner` | int/string (1/2) | Which player won this game; drives the set score (`winner == opponentIndex → 1 else 0`) | Input Custom `MapFunctions.calculateMapScore` | F |
| `scores` | JSON array | Per-game score pair (rendered as `X - Y`). Often the round count or blank — **not standardized by the fighters input**, editor-dependent | `MatchSummary._createStandardGame` (`DisplayHelper.MapScore`); our parser `liquipedia_match.go:651` | F / ? |
| `participants` | JSON object | Keyed `X_Y` (`opponentIndex_playerIndex`); holds each player's **characters** for that game (see §5) | Help:LiquipediaDB/Match (match2game); Input Custom | F |
| `status` | string | Game status | `MatchSummary` (`DisplayHelper.MapScore(opponent, game.status)`) | L→F |
| `subgroup` | int | Game grouping within the match | Help:LiquipediaDB/Match (match2game) | F |
| `extradata` | JSON | Misc per-game data (sparse) | match2game schema; our parser `liquipedia_match.go:682` | ? |

**What does NOT exist per game (do not invent):**
- ❌ No `map` (fighting games have no maps; the field is null/irrelevant).
- ❌ No `length`/duration (the fighters input never sets it; our `estimateEndAt` will have nothing to sum).
- ❌ No rounds breakdown, no per-round timers, no health/damage/combo/meter telemetry.
- ❌ No KDA (our `NormalizedParticipant.Kills/Deaths/Assists` stay nil for 2XKO).

So the **reliable** per-game payload is: **winner + each player's character duo** (+ a possibly-blank score pair).

---

## 5. Per-player per-game fields — characters (the duo)

This is the one piece of real "in-game" data 2XKO exposes. The fighters parser stores, **per game, per player, an array of characters**, standardized against a per-game character list:

```lua
-- lua/wikis/fighters/MatchGroup/Input/Custom.lua  (MapFunctions._processPlayerMapData)
local game = Game.toIdentifier{game = Variables.varDefault('tournament_game')}   -- "2xko"
local CharacterStandardizationData = Lua.import('Module:CharacterStandardization/' .. game, ...)
...
local charInputs = Json.parseIfTable(map['o'..opponentIndex..'p'..playerIndex]) or {}  -- array of raw names
local characters = Array.map(charInputs, function(characterInput)
    local character = MatchGroupInputUtil.getCharacterName(CharacterStandardizationData, characterInput)
    return character and {name = character} or nil
end)
return { characters = characters, player = playerIdData.name }
```

And the match summary renders them per side, per game (source: `lua/wikis/fighters/MatchSummary.lua` `fetchCharactersOfPlayers` / `_createCharacterDisplay`):

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `characters` | array of `{name}` | The player's **picked champions for that game** — for 2XKO an array of (typically) **2** champion names, i.e. the duo/tag pair | Input Custom; `MatchSummary.fetchCharactersOfPlayers` | F |
| `player` | string | Owning player name (for the `X_Y` participant key) | Input Custom | F |

**Details & caveats:**
- Stored inside `match2games[].participants["X_Y"]` where `X` = opponent index, `Y` = player index. Maps onto our existing pass-through `normalizeGameParticipants` (`liquipedia_match.go:855`) — but note our parser currently reads scalar `character`/`agent`/`champion`/`hero` (`liquipedia_match.go:873`); for 2XKO the value is an **array `characters`** of multiple names, so the per-game duo would land in `Extra` unless we add an array path. (Flagged for implementation, not changed here.)
- Character names are **standardized** via `Module:CharacterStandardization/2xko` — so values come back as canonical champion names (e.g. "Ahri", "Darius", "Yasuo"), not free text.
- ❌ **Fuses are NOT recorded.** 2XKO's "Fuse" system (the team-mechanic modifier picked alongside the duo) appears nowhere in the fighters match input or summary modules. Only the two champions are stored. Do not surface fuses — the data does not exist.
- ❌ No per-character in-game stats (damage dealt, assists used, etc.).
- ⚠️ **Editor-dependent / sparse.** Characters are only present when an editor fills the `oXpY` inputs. For a 1080-player EVO bracket, expect characters mostly on later/feature stages; many early-round matches will have winner + score only, or exist only as **placements** (see §7).

---

## 6. Live capability

**Effectively none — confirm: NO live in-game data.**

- There is **no in-match telemetry** for 2XKO (no health bars, round state, combo counters via the API). Confirmed by the fighters input/summary modules carrying only winner + characters + score (§4, §5).
- The only fields that change while a match is in progress and *could* be polled live:
  - `match2opponents[].score` (set score, e.g. 1-0 → 2-1) and per-game `winner` as games conclude — **L**, but updates only as games finish, and only if an editor is live-updating the bracket (rare for fighters; brackets are usually filled post-hoc).
  - `stream` (Twitch/YouTube channel) — **L**, lets us deep-link the live broadcast.
- Everything else (characters, final winner, VOD) is **F** (post-match).

> Practical verdict: treat 2XKO as **non-live for data purposes**. We can show "live now + watch on stream" using `date` + `stream`, but we cannot show a live score ticker with any reliability. This matches the general fighting-game reality and the background brief.

---

## 7. Gap analysis & feasibility

**Does match data exist at all for 2XKO?** Yes — partially. Brackets ARE match2 data (a bracket = a MatchGroup of match2 records), and 2XKO bracket pages exist (EVO 2026, EVO Japan 2026 `/Bracket`, Combo Breaker, Double K.O, LVL UP EXPO). So `GET /match?wiki=fighters&conditions=[[game::2xko]]` should return real matches with opponents, set scores, winners, and (where filled) per-game character duos. **BUT** large open brackets are heavily **placement-driven**: hundreds of entrants resolve via `/placement` data, and only the bracket portion (top 8/16/etc.) is stored as detailed match2 matches. Expect **sparse, top-heavy** match coverage, not a full match feed like LoL/CS.

**Honest assessment of 2XKO as a 10th game:**

*Cons (significant):*
1. **Shared-wiki tax.** Every cache key, poller condition, budget accounting, and acronym↔wiki mapping in the backend assumes 1 wiki = 1 game. 2XKO breaks that invariant (§0). This is real plumbing work, not a config line — and it's a one-off special case that complicates code for one game.
2. **Sparse data.** Opponent = solo players (not the team-logo-driven cards our UI is built around); per-game data is just winner + a 2-champion duo, frequently absent; no live score; no telemetry. The "detailed match page" would be thin.
3. **Player-centric, not team-centric.** Our entire model (favorite *teams*, team search, team detail, opponent logos) is team-oriented. 2XKO is individuals with champion portraits — a different UI primitive.
4. **Young scene / volume.** Competitive 2XKO is new (Early Access Oct 2025, full launch Jan 2026); match volume is low outside majors.

*Pros:*
1. Riot title with strong brand pull and LoL-champion crossover (audience overlap with our existing LoL/Wild Rift coverage).
2. The data that exists (players, set scores, winners, champion duos, streams, VODs) is enough for a credible **lightweight** match card.
3. Tournament/placement/prize-pool data is rich on the fighters wiki (good for a tournaments page even if per-match detail is thin).

**Verdict:** 2XKO is **technically feasible but a poor fit as a drop-in 10th game.** The shared-`fighters`-wiki special-casing plus the player-vs-player (not team) shape means it cannot reuse our existing team-centric match pipeline without targeted changes. If the goal is "another live-match game like the other 9," 2XKO underdelivers (no live data, sparse matches). If the goal is "Riot ecosystem breadth + a tournaments/results destination," it's defensible — but scope it as a **distinct, lightweight integration**, not a clone of an existing wiki game. A dedicated-wiki fighting game would be simpler to add; among fighters-wiki titles, 2XKO is the most on-brand choice if we accept the shared-wiki work.

---

## 8. Proposed (minimal) detailed-match view for 2XKO

Given the data that actually exists, a realistic 2XKO match page:

**Header**
- Tournament name + tier + icon (`tournament`, `liquipediatier`, `iconurl`).
- Round/section label from `match2bracketdata` / `section`.
- Date (`date`, `dateexact`) → "Live now" if started & not finished, else scheduled/finished.
- Best-of badge (`bestof` → "BO5").

**Opponents (two PLAYERS, not teams)**
- Player A vs Player B: `displayname`, `flag` (country), player avatar/flag (no team logo).
- **Set score** from `match2opponents[].score` (e.g. `3 - 1`); highlight winner (`winner`).

**Per-game breakdown** (`match2games[]`, one row per game)
- `Game 1 … Game N`.
- Each side's **champion duo** (2 portraits) from `participants["X_Y"].characters` (standardized names → champion art).
- Per-game winner indicator (`winner`); score pair if present (often blank — hide if empty).

**Footer / actions**
- Live **stream** button (`stream`) when running; **VOD** link (`vod`) when finished.
- Link out to the Liquipedia match/bracket page.

**Explicitly omit (no data):** fuses, health/round/combo telemetry, per-character stats, KDA, map, game durations, live score ticker. Show champion duos + set score + winner — that is the honest extent of 2XKO match detail.

---

### Sources
- Our parser / baseline match2 model: `backend-go/internal/models/liquipedia_match.go` (field lines cited inline).
- `Liquipedia/Lua-Modules` (GitHub, authoritative): `lua/wikis/fighters/Info.lua` (game id `2xko`, `wikiName=fighters`); `lua/wikis/fighters/MatchGroup/Input/Custom.lua` (singles default, per-game per-player `characters` array, game id from tournament); `lua/wikis/fighters/MatchSummary.lua` (solo detection, character + winner + score display).
- Liquipedia commons match2 schema: `Help:LiquipediaDB/Match`, `Module:Match` (opponent types team/solo/duo/trio/quad; match2games scores + `X_Y` participants) — via WebSearch snippets (liquipedia.net 429-blocked for direct fetch).
- 2XKO format: riotgames.com (2v2), Mobalytics / allthings.how / Deltia's (1v1 = one player picks & controls a duo); en.wikipedia.org/wiki/2XKO (release dates).
- 2XKO competitive pages (WebSearch snippets): EVO 2026 2XKO (1080 players, double-elim, $135k), EVO Japan 2026 2XKO `/Bracket`, Combo Breaker 2026 2XKO (674), Double K.O V.4 2XKO (13), LVL UP EXPO 2026 2XKO ($10k); `Module:GameName/data` / `Module:GameSeries` (confirm `2xko` id).
