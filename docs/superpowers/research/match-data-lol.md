# League of Legends — Match data (Liquipedia wiki `leagueoflegends`)

> Internal acronym `lol` · frontend slug `lol` · Liquipedia wiki `leagueoflegends` (see `GameWikiMapping` in `backend-go/internal/models/liquipedia.go`).
> Goal: enumerate **every** match field Liquipedia exposes for LoL to design a max-info detailed match page.

**Legend for the `live?` column**
- **L** = value can change *during* a live match (status, series score, current-game winner, streams). This is driven by Liquipedia editors and/or Liquipedia's own coverage updating the wiki page — **NOT** real-time telemetry from the game client.
- **F** = final / post-game only (populated after a game/match ends; for rich stats, only when a *MatchPage* exists).
- **?** = uncertain / depends on how the match was entered.

---

## 0. The single most important fact: TWO data tiers

LoL matches on Liquipedia are entered through one of two map systems, and **the available data differs enormously between them**:

1. **Normal map** (`{{Map}}` template) — `lua/wikis/leagueoflegends/MatchGroup/Input/Custom/Normal.lua`. Manual editor input. Provides only: **side, champion picks, champion bans, length, winner**. **No per-player KDA/gold/CS/items/runes, no objectives, no draft order.**
2. **MatchPage / ApiMap** (`{{ApiMap|matchid=…}}` template) — `lua/wikis/leagueoflegends/MatchGroup/Input/Custom/MatchPage.lua`, line 30: `mw.ext.LeagueOfLegendsDB.getData(mapInput.matchid, …)`. Pulls a full post-game dataset (Riot end-of-game data ingested by Liquipedia). Provides the **rich** per-player stats, objectives, and draft order described in §4–§5.

Source: the dispatcher `lua/wikis/leagueoflegends/MatchGroup/Input/Custom.lua` lines 62–66 picks `MatchPage` parser iff `options.isMatchPage`, else `Normal`. A plain match also auto-merges a standalone MatchPage if one exists (`Custom.lua` lines 53–58).

**Consequence:** the rich LoL stats below exist **only for matches that have a MatchPage** (top-tier events: LCK/LEC/LPL/LTA/Worlds/MSI typically; smaller events frequently get only the Normal map's champions+bans+side). Plan the UI to **degrade gracefully** when a game has only picks/bans/side.

Powered-by note: MatchPages are branded "Powered by SAP" (`MatchPage.lua:751`) — the underlying stat feed is Riot/SAP post-game data, not a live tick stream.

---

## 1. Identity & opponent format

| Aspect | Value | Source |
|---|---|---|
| Opponent format | **team vs team**, exactly 2 opponents (`bestof` series of games). Opponent types possible: `team`, `solo`, `duo`, `trio`, `quad`, `literal` (TBD) — LoL is effectively always `team`. | `LiqOpponent` in `liquipedia_match.go:59`; Help:LiquipediaDB/Match opponent types |
| Players per opponent | up to **15** (5 starters + subs across games) | `Custom.lua:28` `maxNumPlayers = 15` |
| Series format | Best-of N (`bestof`); each game = one entry in `match2games` | `liquipedia_match.go:31`; `MatchFunctions.getBestOf` `Custom.lua:31` |
| Default mode | `team` | `Custom.lua:30` |
| Map | LoL is always Summoner's Rift → the per-game `map` field is essentially unused / empty. Don't surface it. | `gameFields` `commons/Match.lua:502` |

---

## 2. Match-level fields

These are the top-level fields on a `match` object (LPDB v3 `match2`). All are already in our `LiqMatch` struct (`liquipedia_match.go:14-55`) and requested in `LiqMatchQueryFields` (`liquipedia_poller.go:47`). Stored-field whitelist confirmed in `commons/Match.lua:444-476`.

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `pageid` | int | LPDB page id (we use as numeric match ID) | `liquipedia_match.go:15` | F |
| `pagename` | string | Wiki page name | `:16` | F |
| `objectname` | string | Unique LPDB object key (our dedup `UniqueKey`) | `:18`, `:96` | F |
| `match2id` | string | Stable match2 id (alphanumeric) — true detail key | `:19`; whitelist `commons/Match.lua:458` | F |
| `match2bracketid` | string | Bracket id (groups a bracket) | `:20` | F |
| `match2bracketdata` | json | Bracket tree position (round, header, next match) | `:54` | L (bracket fills as matches finish) |
| `status` | string | Match status | `:21` | L |
| `winner` | string | `"1"`/`"2"`/`"0"` (series winner; 0=draw/none) | `:22` | L |
| `walkover` | string | Walkover flag (FF/DQ/L) | `:23` | L |
| `resulttype` | string | `""`/`default`/`np`/`draw` | `:24` | F |
| `finished` | int(0/1) | Series finished | `:25` | L→F |
| `mode` | string | Game mode (`team`) | `:26` | F |
| `type` | string | Match type | `:27` | F |
| `section` | string | Page section / stage label | `:28` | F |
| `game` | string | Game/version tag | `:29` | F |
| `patch` | string | **Game patch** (e.g. `14.10`) at match level | `:30` | F |
| `bestof` | int | Series length (Bo1/Bo3/Bo5) → `number_of_games` | `:31` | F |
| `date` | string | Scheduled start `YYYY-MM-DD HH:MM:SS` | `:32` | L (reschedules) |
| `dateexact` | int(0/1) | Whether time is exact | `:33` | F |
| `vod` | string | Series VOD URL | `:34` | F (added post-match) |
| `tournament` | string | Tournament page name | `:35` | F |
| `parent` / `parentname` | string | Parent page | `:36`; `commons/Match.lua:461` | F |
| `tickername` | string | Short ticker label (our display `name`) | `:37` | F |
| `shortname` | string | Short name | `:38` | F |
| `series` | string | Series/league name | `:39` | F |
| `icon` / `iconurl` / `icondark` / `icondarkurl` | string | Tournament icons (light/dark) | `:40-43` | F |
| `liquipediatier` | string | Tier (1/2/3…) | `:44` | F |
| `liquipediatiertype` | string | Tier type (Qualifier, Showmatch…) | `:45` | F |
| `publishertier` | string | Riot-tier flag (e.g. premier/major) | `:46` | F |
| `stream` | json | Stream platforms map (we request `rawstreams=true&streamurls=true`) | `:51`; `poller.go:539-540` | L |
| `links` | json | External links (Reddit, GOL, etc.) | `:52` | F |
| `extradata` | json | Match-level extras — notably **`mvp`** (+ common: `comment`, `dateexact`, `timestamp`, `timezoneid`, `timezoneoffset`) | `:53`; `Custom.lua:174 readMvp`; `commons/Match.lua:344-353` | F |
| `match2opponents` | json | Teams + players (see §3) | `:49` | L |
| `match2games` | json | Per-game data (see §4–§5) | `:50` | L/F |

---

## 3. Opponent / team fields

Each entry of `match2opponents` (parsed as `LiqOpponent`, `liquipedia_match.go:59-71`). Stored-field whitelist: `commons/Match.lua:478-488`.

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `name` | string | Team page name | `liquipedia_match.go:60` | F |
| `template` | string | Team template / short code (e.g. `t1`, `g2`) | `:61` | F |
| `score` | string/int | **Series score** (games won); `-1` = no score yet | `:62`; parse `:795` | **L** |
| `status` | string | `""`/`FF`/`DQ`/`L` (forfeit etc.) | `:63` | L |
| `type` | string | `team`/`literal`… | `:64` | F |
| `id` | int | Opponent index (1/2) | `:65` | F |
| `icon`/`iconurl`/`icondark`/`icondarkurl` | string | Team logos (light/dark) | `:66-69` | F |
| `placement` | int | Final placement (bracket) | `commons/Match.lua:483` | F |
| `match2players` | json | Roster for this opponent (per-match players) | `:70` | F |
| `extradata` (opponent) | json | **Aggregated series stats** when MatchPage exists: `kills`, `deaths`, `assists`, `gold`, `towers`, `inhibitors`, `dragons`, `atakhans`, `heralds`, `barons` (summed over games) | `Custom.lua:89-99` | F |

**`match2players[]`** (whitelist `commons/Match.lua:490-495`): `name`, `displayname`, `flag`, `extradata`. For MatchPage matches, each player's `extradata` carries **series-aggregated** performance (`Custom.lua:100-134`): `role`, `characters` (array of champs played across games), `kills`, `deaths`, `assists`, `damage`, `creepscore`, `gold`, `gameLength` (sum of game lengths in s), `killparticipation`, plus `playerteam` (`commons/Match.lua:410`).

---

## 4. Per-game fields — `match2games[]`

Stored-field whitelist: `commons/Match.lua:497-518`. Our `normalizeMatchGames` (`liquipedia_match.go:598-704`) parses `finished`, `winner`, `map`, `scores`, `length`, `participants`, `extradata`.

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `winner` | string/int | Game winner `1`/`2`/`0` | `liquipedia_match.go:630`; `commons/Match.lua:517` | L (per game) |
| `length` | int(s) or `mm:ss` | **Game duration**. MatchPage stores seconds → display `mm:ss` (`MatchPage.lua getLength :55-61`); Normal is raw string (`Normal.lua:30-32`). Our parser handles both (`:665-673`). | `liquipedia_match.go:665` | F |
| `finished` | bool/int | Game finished | `:615-621` | L→F |
| `status` | string | Game status; `NOT_PLAYED` for unplayed maps in a series | `commons/Match.lua:511`; `Custom.lua:104` | L |
| `scores` | array | Per-team game scores (backwards-compat) | `liquipedia_match.go:651`; `commons/Match.lua:510` | L |
| `map` | string | Map name — unused for LoL (always SR) | `:644`; `commons/Match.lua:502` | F |
| `patch` | string | **Per-game patch** (can differ across a series) | `commons/Match.lua:506` | F |
| `vod` | string | **Per-game VOD** (also via legacy `vodgameN`) | `commons/Match.lua:515`; `Custom.lua:155-157` | F |
| `date`/`mode`/`type`/`subgroup`/`rounds` | mixed | Game metadata (rounds unused for LoL) | `commons/Match.lua:498-514` | F |
| `participants` | json map | Per-player stat lines keyed `"opp_player"` (e.g. `1_1`,`2_3`) — **deep copy of `opponents[].players[]`** (see §5). This is what our Go reads. | `commons/Match.lua:380-388`, `:505`; our `:678-680,:855` | F |
| `opponents` | json array | Structured per-team game block (alt to `extradata`): `side`, `picks[]`, `players[]`, and `stats{}` (see below) | `commons/Match.lua:507`; `Custom.lua:182-194` | F |
| `extradata` (game) | json | **The game-specific LoL map** — keys below | `:681-684`; `Custom.lua:183-216` | F |

### `match2games[].extradata` keys (LoL-specific)
Built in `Custom.lua` `MapFunctions.getExtraData` (lines 183–216). Keys are prefixed `team1…`/`team2…`:

| extradata key | Meaning | Source | live? |
|---|---|---|---|
| `team1side`, `team2side` | **Side** = `blue` / `red` | `Custom.lua:194`; Normal `team{N}side` `Normal.lua:37-43`; MatchPage `team.color` `MatchPage.lua:66-68` | F |
| `team1champion1` … `team1champion5`, `team2champion1` … | **Champion picks** per team, in pick slot order | `Custom.lua:197-199`; Normal `tNcM` `Normal.lua:76-79` | F |
| `team1ban1` … `team1ban5`, `team2ban1` … | **Champion bans** per team | `Custom.lua:200-202`; Normal `tNbM` `Normal.lua:85-91` | F |
| `team1objectives`, `team2objectives` | Object `{towers, inhibitors, barons, dragons, heralds, grubs, atakhans}` — **counts only** (see caveats) | `Custom.lua:157-169,193` | F |
| `vetophase` | **Draft order array**: each entry `{type: 'ban'|'pick', team: 1|2, character, vetoNumber}` — the full pick/ban sequence | `Custom.lua:145-152,210-213`; consumed `MatchPage.lua:98,119-132` | F |

### `match2games[].opponents[]` structured block (MatchPage path)
From `extendMapOpponent` (`MatchPage.lua:174-195`): `side`, `picks[]` (champion names), `players[]` (= §5), and `stats{}` = `{ kills, deaths, assists, gold, towers, inhibitors, dragons, heralds, grubs, atakhans, barons }`. Rendered as the per-game "Team Stats" panel (`MatchPage.lua:546-577`, `_buildTeamStatsList:287-355`).

### Objectives — important caveats (verified, not assumed)
- Captured per team as **integer counts**: `towers`/`towerKills`, `inhibitors`/`inhibitorKills`, `barons`/`baronKills`, `dragons`/`dragonKills`, `heralds`/`riftHeraldKills`, `grubs`/`grubKills` (Void Grubs), `atakhans`/`atakhanKills` (`MatchPage.lua getObjectives :157-169`).
- **Dragon soul / Elder / dragon element (Infernal/Ocean/Cloud/Mountain/Hextech/Chemtech) is NOT exposed** — only a total `dragons` count. Do not promise dragon-soul UI.
- **First blood is NOT a field** — not in objectives, not elsewhere. Cannot show "first blood" reliably.
- These counts exist **only with a MatchPage**; Normal maps return `nil` objectives (`Normal.lua:103-105`).

---

## 5. Per-player fields (per game)

For **MatchPage** games, each `participants["opp_player"]` (deep copy of `opponents[].players[]`, `commons/Match.lua:380-388`) is built by `MatchPage.lua getParticipants` (lines 80-119). Our `normalizeGameParticipants` (`liquipedia_match.go:855-896`) types `player/character/role/kills/deaths/assists` and dumps the rest into `Extra`.

| Field (API key) | Type | Meaning | Source | parsed-as | live? |
|---|---|---|---|---|---|
| `player` | string | Player page id | `MatchPage.lua:104`; `Custom.lua:236` | typed `Player` | F |
| `displayName` | string | Display name | `Custom.lua:237` | (in Extra) | F |
| `character` | string | **Champion** played | `MatchPage.lua:106` | typed `Character` | F |
| `role` | string | **Position**: `top`/`jungle`/`mid`/`bottom`/`support` (display `Top/Jungle/Mid/Bot/Support`) | `MatchPage.lua:105`; `InGameRoles.lua:9-15` | typed `Role` | F |
| `kills` | int | Kills | `:108` | typed `Kills` | F |
| `deaths` | int | Deaths | `:109` | typed `Deaths` | F |
| `assists` | int | Assists | `:110` | typed `Assists` | F |
| `gold` | int | **Total gold** | `:107` | Extra | F |
| `creepscore` | int | **CS** (creep score) | `:113` | Extra | F |
| `damagedone` | int | **Damage to champions** | `:112` | Extra | F |
| `killparticipation` | float(0–1) | **KP%** (kills+assists ÷ team kills) | `:111`, computed `:89-98` | Extra | F |
| `items` | array | **Item build** (names; UI shows up to 6, pads with `EmptyIcon`) | `:114`; render `MatchPage.lua:110-112,722-748` | Extra | F |
| `runes` | object | **Runes** = `{ primary:{tree, runes[]}, secondary:{tree, runes[]} }`; keystone = first primary rune in the keystone set | `:115` (`runeData`); render `:113-116,732-735` | Extra | F |
| `spells` | array | **Summoner spells** (2 names, e.g. Flash/Teleport) | `:116`; render `:738` | Extra | F |

Derived stats the wiki computes for display (we could replicate): **CSPM**, **GPM**, **DPM** = per-minute via `stat / gameLength * 60` (`MatchPage.lua:178-183`); **KDA** shown as `k/d/a`.

**Normal-map games**: per-player data only if the editor used the detailed `tNpM={{Json|player=|role=|character=|kills=|deaths=|assists=}}` form (`GetMatchGroupCopyPaste/wiki.lua:88-97`, `Normal.lua:48-63`). That maxes out at **champion + role + K/D/A** — **no gold/CS/items/runes/spells**. Otherwise only `tNcM` champion names exist.

---

## 6. Live capability (explicit)

**There is NO real-time in-game telemetry.** Verified:
- The only stat ingestion path is `mw.ext.LeagueOfLegendsDB.getData(matchid)` (`MatchPage.lua:30`), a **post-game** dataset (Riot/SAP end-of-game). There is no per-second / per-event stream of gold, KDA, CS, objectives, or map state.
- Consequently **all of §4–§5 (per-player KDA/gold/CS/items/runes, objectives, draft order, per-game length/winner) is final/post-game (F)** and typically appears only after a MatchPage is built — often minutes-to-hours after the game, and only for covered events.
- What can move **during** a live match (L), driven by Liquipedia editors / Liquipedia's coverage updating the wiki page (near-live, **not guaranteed real-time**):
  - `status` running→finished, `match2opponents[].score` (series score), match `winner`/`finished`, per-game `winner`/`finished` as games close, `match2bracketdata` (bracket fills), `stream` URLs.
- **No live scoreboard, no live gold graph, no live objective timers** are available from Liquipedia for LoL. Do not fabricate them. If true live in-game data is a hard requirement, it would need Riot's official live APIs (LoL Esports / Live Client Data), which is out of scope of Liquipedia.
- Our own freshness ceiling: the poller refreshes `matches_running` every 8 min (`CLAUDE.md §5.2`), so even the L fields are at best ~8-min stale unless a webhook forces a refresh.

---

## 7. Gap analysis

### Already parsed by our backend (cite our models)
- **All match-level fields** in §2 — `LiqMatch` (`liquipedia_match.go:14-55`), requested via `LiqMatchQueryFields` (`liquipedia_poller.go:47`). Normalized to `NormalizedMatch` (`:109-140`).
- **Opponents + series score + logos** — `normalizeMatchOpponents` (`:393-472`) → `NormalizedOpponent`/`NormalizedMatchResult`. (We do **not** read opponent `extradata` aggregates or `match2players[].extradata`.)
- **Streams** — `normalizeMatchStreams` (`:478-516`).
- **Per-game** `finished/winner/length/map/scores` — `normalizeMatchGames` (`:598-704`) → `NormalizedGameEntry`.
- **Per-game `extradata`** (champions, bans, side, objectives, vetophase) — passed through **untyped** into `NormalizedGameEntry.ExtraData map[string]interface{}` (`:183,:681-684`).
- **Per-player participants** — `normalizeGameParticipants` (`:855-896`): types `player/character/role/kills/deaths/assists`; **everything else (gold, creepscore, damagedone, killparticipation, items, runes, spells) lands untyped in `NormalizedParticipant.Extra`** (`:196,:879-887`).

**Net:** the rich LoL data already *flows through* to the frontend as raw JSON (`games[].extradata` and `games[].participants[].extra`), but nothing is **typed, named, or surfaced** — and the frontend `PandaMatch` types don't expose it.

### Available but unparsed / unsurfaced (the real opportunity)
1. **Champion picks & bans** — present in `game.extradata.team{N}champion{M}` / `team{N}ban{M}`, currently buried in the untyped `ExtraData` map. Not exposed in any typed field or in `PandaMatch`.
2. **Draft order (`vetophase`)** — full pick/ban sequence with `vetoNumber`; untyped.
3. **Side (blue/red)** per team per game — untyped in `ExtraData`.
4. **Objectives** (towers/inhibitors/barons/dragons/heralds/grubs/atakhans counts) — untyped in `ExtraData` (and the structured `game.opponents[].stats` block is **not read at all**).
5. **Rich per-player stats** (gold, CS, damage, KP%, items, runes/keystone, summoner spells) — present in `participants[].extra` but untyped; `PandaMatch` exposes none of it.
6. **Series-aggregated stats** — `match2opponents[].extradata` (team totals) and `match2players[].extradata` (per-player series totals incl. `characters[]`, `gameLength`, KP%) — **we never read opponent/player `extradata` at all**.
7. **MVP** — `match.extradata.mvp` — not read.
8. **Per-game patch & per-game VOD** — `game.patch` / `game.vod` exist but `NormalizedGameEntry` drops them (we only keep match-level `patch` and `vod`).

**Single biggest gap:** the entire **per-player performance layer (champion + KDA + gold + CS + damage + KP% + items + runes + summoner spells)** and the **draft (picks/bans/order/side) + objectives** — all already arrive in the JSON we fetch but are stuffed into untyped `extra`/`extradata` maps and never typed or shown.

---

## 8. Proposed max-info detailed match view for LoL

A faithful clone of Liquipedia's own MatchPage layout (`MatchPage.lua`), degrading by data tier:

**Header (always available)**
- Team A vs Team B, logos, **series score**, status badge (live/finished), Bo-N, date, tournament + tier, patch, stream button (live) / VOD links.

**Series overview (Bo3/Bo5)**
- Per-game strip: game #, **blue/red side** per team, winner (W/L), **length** (`mm:ss`), per-game champions.
- *MatchPage tier:* "Overall Team Stats" (summed KDA, gold, towers, inhibitors, grubs, heralds, atakhan, dragons, barons) + "Overall Player Performance" (per player: champions played, KDA, KP%, CSPM, GPM, DPM) — from opponent/player `extradata` (`MatchPage.lua:137-280`).

**Per-game tabs** (one per game)
1. **Draft panel** — pick/ban grid per team by side, plus collapsible **Draft Order** (`vetophase` with `vetoNumber`).
2. **Team Stats** — side, KDA, gold, towers, inhibitors, void grubs, rift heralds, atakhan, dragons (count), barons (`game.opponents[].stats` / `team{N}objectives`).
3. **Player Performance** — 5v5 rows sorted by role (Top→Jungle→Mid→Bot→Support): champion icon + name, **role**, summoner spells, **keystone + secondary tree**, **6 item slots**, KDA, KP%, CS, gold, damage.

**Graceful degradation**
- *Normal map, champions-only:* show only picks/bans + side + length + winner. Hide stats/objectives/draft-order panels.
- *Normal map, detailed input:* add champion + role + KDA per player; still no gold/CS/items/runes.
- *No MatchPage at all:* header + series score + per-game winner/side/champions only.

**Do NOT build (data does not exist from Liquipedia)**
- Live gold/XP graphs, live KDA/CS ticker, objective timers, gold-difference timeline.
- First-blood indicator; dragon-soul / elder / dragon-element breakdown (only a dragon count exists).
- Any "live" per-player scoreboard during the game — all rich stats are post-game.

---

### Sources
- Our code: `backend-go/internal/models/liquipedia_match.go`; `backend-go/internal/services/liquipedia_poller.go` (`LiqMatchQueryFields`); `backend-go/internal/handlers/matches.go`.
- Liquipedia Lua-Modules (GitHub `Liquipedia/Lua-Modules`, `main`):
  - `lua/wikis/leagueoflegends/MatchGroup/Input/Custom.lua` (extradata assembly, aggregation, MVP)
  - `lua/wikis/leagueoflegends/MatchGroup/Input/Custom/MatchPage.lua` (rich participant + objectives parser, `mw.ext.LeagueOfLegendsDB`)
  - `lua/wikis/leagueoflegends/MatchGroup/Input/Custom/Normal.lua` (manual `tNcM`/`tNbM`/`teamNside`)
  - `lua/wikis/leagueoflegends/MatchPage.lua` (display: draft, team stats, player loadout, runes/spells/items)
  - `lua/wikis/leagueoflegends/GetMatchGroupCopyPaste/wiki.lua` (template param names: `ApiMap`, `Map`, `tNpM`)
  - `lua/wikis/leagueoflegends/InGameRoles.lua` (role values/aliases)
  - `lua/wikis/commons/Match.lua` (LPDB store: match/opponent/player/game field whitelists; `participants` X_Y backwards-compat build)
- Liquipedia wiki docs: [Liquipedia:Match2 (LoL)](https://liquipedia.net/leagueoflegends/Liquipedia:Match2), [MatchPage Tutorial](https://liquipedia.net/leagueoflegends/Liquipedia:Match2/MatchPage_Tutorial), [Help:LiquipediaDB/Match](https://liquipedia.net/commons/Help:LiquipediaDB/Match) (opponent types, X_Y participant keying).
