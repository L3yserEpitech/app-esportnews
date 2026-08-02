# Super Smash Bros. Ultimate — Match data (Liquipedia wiki `smash`)

Research reference for a per-game "detailed match page". Proposed internal acronym `smash`, frontend slug `smash`, Liquipedia wiki `smash` (`liquipedia.net/smash/`).

**`live?` legend:** `L` = updates live during the match · `F` = final / post-match (editor-filled after the fact) · `?` = uncertain.

Every field below is backed by a concrete source. Primary authoritative sources are the open-source Liquipedia Lua modules that *write* the match2 records (the parser, the storage encoder, and the editor copy-paste template), our own Go parser, and one observed live page. The Liquipedia API itself was not queried (its host is IP rate-limited / 429 and the API key can't be passed through WebFetch) — the Lua modules are the authoritative substitute since they define exactly what ends up in the `match`/`match2games` records the API returns.

Key sources (cited inline as `[Sn]`):
- `[S1]` Our model: `/Users/jules/Code/freelance/esportnews/backend-go/internal/models/liquipedia_match.go` (liquipedia branch)
- `[S2]` Our query projection: `LiqMatchQueryFields` in `/Users/jules/Code/freelance/esportnews/backend-go/internal/services/liquipedia_poller.go` (liquipedia branch)
- `[S3]` Smash match parser: `Lua-Modules/lua/wikis/smash/MatchGroup/Input/Custom.lua` (writes per-game player/character/stock data)
- `[S4]` Smash wiki config: `Lua-Modules/lua/wikis/smash/Info.lua` (game identifiers)
- `[S5]` Smash match summary renderer: `Lua-Modules/lua/wikis/smash/MatchSummary.lua` (what the popup shows)
- `[S6]` Smash editor template: `Lua-Modules/lua/wikis/smash/GetMatchGroupCopyPaste/wiki.lua` (exact input field set)
- `[S7]` Commons map processor: `Lua-Modules/lua/wikis/commons/MatchGroup/Input/Util.lua` → `standardProcessMaps`, `parseMapPlayers`, `getTournamentContext` (defines the stored `match2games[]` shape)
- `[S8]` Commons storage encoder: `Lua-Modules/lua/wikis/commons/Match.lua` → `encodeJson` (proves what JSON the record carries)
- `[S9]` Observed live page: `liquipedia.net/smash/Let's_Make_Big_Moves/2026` (a 2026 Ultimate event)
- `[S10]` API field reference: `/Users/jules/Code/freelance/esportnews/docs/liquipedia_match.md` (liquipedia branch)

---

## 0. Two-title wiki & how to filter Ultimate

The `smash` wiki hosts **six** Smash titles under one wiki, distinguished by the match record's `game` field. From `Info.lua` `[S4]`:

| `game` value | Title |
|---|---|
| `melee` | Super Smash Bros. Melee (**`defaultGame`**) |
| `brawl` | Super Smash Bros. Brawl |
| `wiiu` | Super Smash Bros. for Wii U |
| **`ultimate`** | **Super Smash Bros. Ultimate** |
| `pm` | Project M |
| `64` | Super Smash Bros. (N64) |

**Exact condition to isolate Ultimate: `[[game::ultimate]]`** (string value `ultimate`, lowercase, no spaces). Melee is `[[game::melee]]`.

This is reliable because the match-level `game` field is inherited from the tournament. In `getTournamentContext` `[S7]`:
```lua
vars.game = Logic.emptyOr(obj.game, parent.game, globalVars:get('tournament_game'))
```
i.e. each match's `game` resolves to the tournament's `tournament_game` (an Ultimate event page sets `tournament_game = ultimate`). Smash separates Melee and Ultimate into distinct tournament pages (e.g. `/Let's_Make_Big_Moves/2026` is Ultimate), so filtering by `[[game::ultimate]]` cleanly excludes Melee/other titles `[S9]`.

> **Pipeline implication:** our poller currently issues the *same* conditions for every wiki and does **not** filter by `game` (see `refreshMatches*` in `[S2]`). For `smash` we must append `AND [[game::ultimate]]` to all match conditions (running / upcoming / past) and tournament conditions. `smash` would be the **first** wiki needing an intra-wiki game filter — a new per-wiki concern in the poller.

**Singles vs doubles:** `Custom.lua` sets `CustomMatchGroupInput.DEFAULT_MODE = 'singles'` and `OPPONENT_CONFIG.maxNumPlayers = 10` `[S3]`. So the `mode` field is `singles` (1v1, the dominant format) or `doubles` (2v2); the high `maxNumPlayers` accommodates crew battles. Default stock counts per title are hardcoded `[S3]`: `melee=4, brawl=3, wiiu=2, ultimate=3, pm=4, '64'=5` — **Ultimate singles = 3 stocks**.

---

## 1. Identity & opponent format

**Opponents are solo players, not teams.** A singles match's two sides are individual players (opponent `type = "solo"`), confirmed three ways:
- Parser handles party opponents: `if Opponent.typeIsParty(opponent.type)` and the literal/TBD case `if opponent.type == Opponent.literal` `[S3]`.
- Renderer's team check returns false for singles: `match.opponents[1].type == Opponent.team and match.opponents[2].type == Opponent.team` `[S5]` (only true for crew/team battles).
- Observed `[S9]`: matches are `Hurt` (🇯🇵) vs `Sonix` (🇩🇴) — individual players with country flags, linking to `/smash/<Player>` pages, not team pages.

Opponent types you will encounter: **`solo`** (singles — the norm), **`duo`** (doubles, a party of 2), **`team`** (registered team / crew battle), **`literal`** (TBD placeholder).

> **This does not fit our team-centric pipeline.** Our `normalizeMatchOpponents` `[S1]` coerces *every* opponent into a `NormalizedTeamCompact` (built from `opp.Name`, `opp.Template`, team icon). For a solo opponent: `opp.Template` is empty (no team shortname → no acronym), `opp.Name` is the player's pagename, and the team `icon` is typically absent — the player's **country flag and avatar live in `match2players`, which the opponent-level normalizer never reads**. So a Smash player would render in a "team" slot showing only the name. It displays, but it is semantically wrong and drops player identity (flag, real name, player-page link). See §7.

---

## 2. Match-level fields

These are the top-level `match` fields. All are fetched today (our `LiqMatchQueryFields` already requests the full set `[S2]`) and parsed by `LiqMatch`/`NormalizeLiqMatch` `[S1]`. None update live — Liquipedia is wiki-edited, so values appear/refresh when an editor saves the page.

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `pageid` | int | Liquipedia page id (we use as `NormalizedMatch.ID`) | `[S1][S10]` | F |
| `pagename` | string | Full page name (e.g. `Let's_Make_Big_Moves/2026`) | `[S1][S10]` | F |
| `match2id` | string | Match id within the bracket (alphanumeric) | `[S1][S10]` | F |
| `match2bracketid` | string | Bracket id (groups matches into a bracket) | `[S1][S10]` | F |
| `objectname` | string | Unique object id (our dedup `UniqueKey`) | `[S1]` | F |
| `winner` | string | Winning opponent index `"1"`/`"2"` (`""`/`"0"` = none) | `[S1]` | F |
| `walkover` | string | Walkover flag | `[S1][S10]` | F |
| `resulttype` | string | Result type (e.g. default/walkover) | `[S1][S10]` | F |
| `finished` | int (0/1) | Whether the set is over | `[S1]` | F |
| `mode` | string | `singles` / `doubles` (per `DEFAULT_MODE`) | `[S3][S10]` | F |
| `type` | string | Match type | `[S1][S10]` | F |
| `section` | string | Bracket section / round label | `[S1]` | F |
| **`game`** | string | **`ultimate`** for SSBU (see §0) | `[S4][S7]` | F |
| `patch` | string | Game patch/version (often empty for Smash) | `[S1]` | F |
| `bestof` | int | Best-of N for the set (e.g. 3, 5) | `[S1][S6]` | F |
| `date` | datetime | Match date/time `YYYY-MM-DD HH:MM:SS` (→ our `begin_at`) | `[S1]` | F |
| `dateexact` | int (0/1) | Whether the time is exact | `[S1]` | F |
| `vod` | string | VOD link | `[S1][S6]` | F |
| `stream` | json | Stream IDs/URLs (Twitch etc.; we fetch with `rawstreams&streamurls`) | `[S1]` | F* |
| `tournament` | string | Tournament page name | `[S1]` | F |
| `parent` / `series` | string | Parent event / series | `[S1]` | F |
| `tickername` / `shortname` | string | Display names | `[S1]` | F |
| `icon` / `iconurl` / `icondark` / `icondarkurl` | string | Tournament icon (light/dark) | `[S1]` | F |
| `liquipediatier` / `liquipediatiertype` / `publishertier` | string | Tier metadata | `[S1]` | F |
| `extradata` | json | Additional match data — **effectively empty for Smash** (parser sets no match-level extradata keys `[S3]`) | `[S3][S8]` | F |
| `match2bracketdata` | json | Bracket layout metadata (positions, links) | `[S1]` | F |
| `links` | json | Related links | `[S1][S10]` | F |
| `match2opponents` | json | The two players (see §3) | `[S1]` | F |
| `match2games` | json | Per-game data (see §4) | `[S1]` | F |

\* `stream` is a scheduling field, not telemetry — it points at where the match will be broadcast; the URL exists before the match and doesn't change during play.

---

## 3. Opponent / player fields (`match2opponents`)

Each opponent object (parsed by `LiqOpponent` `[S1]`):

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `type` | string | **`solo`** (singles) / `duo` / `team` / `literal` | `[S3][S5]` | F |
| `name` | string | Player pagename (singles) or team name | `[S1]` | F |
| `template` | string | Team shortname — **empty for solo players** | `[S1]` | F |
| `score` | int/string | Set score = games won (e.g. `3`; `-1` = none yet) | `[S1]` | F |
| `status` | string | Opponent status (e.g. scored / forfeit) | `[S1]` | F |
| `id` | int | Opponent index (1, 2…) | `[S1]` | F |
| `icon`/`iconurl`/`icondark`/`icondarkurl` | string | Team icon (light/dark) — typically absent for solo | `[S1]` | F |
| `match2players` | json | **Player roster of this opponent** (see below) — for solo, one entry | `[S1]` | F |

**`match2players` (per player)** — *not* currently parsed at the opponent level by our Go code (`normalizeMatchOpponents` ignores it `[S1]`). Standard match2 player fields include `name` (pagename), `displayname`, `flag` (country), and `extradata`. This is where a singles player's **country flag and display name** live (the flag observed next to `Hurt`/`Sonix` `[S9]`). Capturing these requires a solo-aware code path (see §7).

---

## 4. Per-game fields — `match2games`

This is the heart of a Smash detailed match page. Each entry in `match2games` is one game (one stadium/stage) within the set. The stored shape comes from `standardProcessMaps` `[S7]` and the storage encoder `[S8]`:

| Field (in `match2games[i]`) | Type | Meaning | Source | live? |
|---|---|---|---|---|
| **`map`** | string | **The STAGE** (e.g. `Battlefield`, `Final Destination`, `Pokémon Stadium 2`, `Smashville`, `Small Battlefield`) | `[S6][S7][S9]` | F |
| `winner` | string | Game winner opponent index `"1"`/`"2"` | `[S3][S7]` | F |
| `scores` | int[] | Per-opponent game result: **`1` = won this game, `0` = lost** (NOT stock count) | `[S7]` | F |
| `finished` | bool | Whether the game is finished | `[S7]` | F |
| `status` | string | Game status | `[S7]` | F |
| **`opponents`** | json[] | **Per-opponent player/character/stock data** (the real payload — see §5) | `[S3][S7][S8]` | F |
| `participants` | json | **Legacy field — empty `{}` for Smash** (the smash parser never writes it; data is in `opponents`) | `[S8]` | F |
| `extradata` | json | `{ displayname: <stage display> }` only; **no game-specific extradata keys** for Smash (smash parser defines no `getExtraData`) | `[S3][S7]` | F |
| `comment` | string | Optional free-text note on the game (rendered by `GameComment` `[S5]`) | `[S5]` | F |
| `subgroup` / `mode` / `length` / `patch` / `date` | various | Generic per-game fields; smash defines no custom getters, so mostly unset (e.g. **no per-game `length`/duration**) | `[S3][S7]` | F |

**Editor input → stored fields** (from the copy-paste template `[S6]`): each `mapN` is
```
|map1={{Map |map=|winner= |o1p1={{Chars|}}|o2p1={{Chars|}}}}
```
i.e. per game the editor fills the **stage (`map`)**, the **`winner`**, and a **`{{Chars}}`** entry per player. The parser reads these per slot `[S3]`:
- `o<opp>p<idx>` → player name override for that slot
- `o<opp>c<idx>` → the `{{Chars}}`-encoded **character + stocks** string

### Stage-striking / counterpick
**Not recorded as structured data.** Only the *final stage played* per game is stored (`map`). There is no starter/counterpick flag, no strike order, no "stages struck" list in the schema `[S3][S7]`. (The `Φ` glyph observed before some stage names on `[S9]` is a display marker, not a queryable field.) So a "stage striking" view is **not feasible** from the data.

---

## 5. Per-player fields (characters & stocks)

Per game, per player, the parser produces `[S3]`:
```lua
{ characters = characters, player = playerIdData.name }
```
nested under `match2games[i].opponents[oppIndex].players[playerIndex]` `[S7][S8]`.

**Character input format:** `"character,remainingLife,startingLife"` (multiple characters allowed per player → an array of these). `?` for `remainingLife` means "unknown" `[S3]`.

The parser **expands stocks** into one entry per stock `[S3]`:
```lua
return Array.map(Array.range(1, startingLife), function(pos)
    return {name = character, status = characterStatus(...)}
end)
```
So each `characters` array element is `{ name: <fighter>, status: <0|1|-1> }` where status is:
- `1` = stock survived / still alive at end
- `0` = stock lost
- `-1` = unknown (used when `remainingLife = '?'`)

The renderer dims lost/unknown stocks (`opacity 0.3` when `status ~= 1`) and shows an "Unknown" icon for multiple `-1` `[S5]`.

| Data point | Type | Meaning | Source | live? |
|---|---|---|---|---|
| Player name | string | `players[i].player` (resolved pagename) | `[S3]` | F |
| **Character(s) picked** | string[] (icons) | Fighter per game; an array if the player switched/SD'd between fighters (e.g. Snake, Sonic observed `[S9]`) | `[S3][S5][S9]` | F |
| **Stocks** | encoded | `startingLife` total entries; count of `status==1` = **stocks remaining**; `status==0` = lost. Ultimate default = 3 stocks `[S3]` | `[S3][S5]` | F |
| Country flag / real name | string | Lives in `match2players` (§3), not in the per-game block | `[S1]` | F |

**Caveats:** characters and especially stocks are **optional editor input**. Many matches record only the character picked (or even just the set score), and stocks may be `?` (unknown) `[S3]`. Coverage is best for majors, sparse for minor events. There is **no notion of per-character damage, KOs, moves, or any in-game telemetry** — only fighter identity and a per-stock alive/dead flag.

---

## 6. Live capability

**There is essentially no live telemetry — confirmed.** Liquipedia match2 records are **wiki-edited**: every value (scores, characters, stocks, stage, winner) appears only when a human editor saves the page `[S3][S6][S8]`. There is no live data feed, no in-game hook, no real-time score push. Consequently:
- No `L` (live-updating) gameplay field exists anywhere in §2–§5.
- During a live match, fields are typically empty/partial and fill in afterward (often hours later, sometimes post-event for smaller tournaments).
- The only "live" notion available to us is the one **we synthesize**: a match whose `date` has passed and `finished == 0` is treated as `running` (`computeMatchStatus` `[S1]`). That is a clock heuristic, not data from Liquipedia.

This matches every other Liquipedia wiki we already integrate — Smash is no different here.

---

## 7. Gap analysis & feasibility

**What works out of the box (no code change):**
- Match listing / calendar / status: matches have two named opponents → pass `HasTwoNamedOpponents` `[S1]`; running/upcoming/past polling and match-start notifications work unchanged.
- Match-level metadata: name, date, bestof, tier, streams, VOD, tournament context — all already parsed `[S1]`.
- Per-game **stage** (`match2games[i].map`) → already read into `NormalizedGameEntry.Map` `[S1]`.
- Per-game **winner** and **scores [1,0]** → already parsed `[S1]`.

**What is silently dropped today (needs new code):**
1. **Game filter (poller).** Conditions are hardcoded identically for all wikis and don't filter `game` `[S2]`. Without `AND [[game::ultimate]]`, Melee/Brawl/etc. matches leak into the Ultimate feeds. Smash is the first wiki to need a per-wiki `game` condition — a small but structural poller change.
2. **Characters & stocks (parser).** Our `normalizeGameParticipants` reads `gameData["participants"]` keyed `"<team>_<idx>"` `[S1]` — but **Smash leaves `participants` empty and puts everything in `gameData["opponents"][].players[].characters`** `[S3][S7][S8]`. So with the current parser, characters and stocks are **100% missed**. A bespoke smash game-parser is required (the raw blob is already fetched — `match2games` is in `LiqMatchQueryFields` `[S2]` — so no query change, only parsing). This is the single largest content change.
3. **Solo opponent handling.** Players are forced into `NormalizedTeamCompact` `[S1]`, losing flag/real-name/player-page link (which live in `match2players`, currently unparsed at opponent level). To render singles correctly we need a solo-aware path that reads `match2players` (`name`, `flag`).

**How much of the team pipeline needs solo special-casing:** three layers.
- *Match parsing/display:* opponent normalizer + a new per-game character parser (above).
- *Team-centric features become meaningless:* favorite teams (`users.favorite_teams`), team search, team detail pages, team subscriptions — a Smash "opponent" is a person, not a team. These features would either be hidden for Smash or repurposed to "favorite players" (a larger product change). Match subscriptions/notifications themselves work (they key on match, not team).
- *Frontend types:* the `PandaMatch`/team shapes assume teams; a Smash detailed view needs player+character+stock rendering that no current game uses.

**Honest verdict on Smash as the 10th game:**
- **In favor:** It has a *dedicated* wiki (`smash`) — no shared-budget/cache plumbing with the `fighters` wiki, unlike Street Fighter/Tekken/2XKO. The per-game data (fighters + stages + per-stock survival) is genuinely **richer and more visual than most of our team games** — a Smash detailed match page can show "Game 3 — Final Destination — Joker (1 stock left) def. Steve" which is a compelling, distinctive view. Active 2026 scene with frequent majors `[S9]`.
- **Against:** It is the **highest-integration-effort** game of the ten because it breaks the team-centric assumption in three places (game filter, solo opponents, bespoke game parser) and renders our team features (favorites, team pages) inapplicable. Data is editor-sourced, optional, and never live, so coverage is uneven (majors good, minors thin) and there's no live scoreline.
- **Bottom line:** **Viable and arguably a showcase for the detailed-match-page feature**, *provided* the scope is "live matches + rich detailed match page" and we accept (a) adding a per-wiki `game` filter, (b) a Smash-specific `match2games.opponents[].players[].characters` parser, and (c) treating opponents as players (hide/skip team-only features for Smash). If "favorite teams" is considered core to the 10th-game value, Smash is a **poor fit** without a "favorite players" feature. Recommended only if the team-features gap is acceptable.

---

## 8. Proposed detailed-match view for Smash Ultimate (realistic field set)

Only fields that genuinely exist in the data:

**Header (set level)** — all `F`:
- Players: `P1 (flag, name)` vs `P2 (flag, name)` — from `match2opponents` + `match2players` (§3)
- Set score: `3 – 1` — opponent `score` (games won)
- Best-of, date/time, tournament + tier, round/section
- Stream link (pre-match) + VOD link (post-match)
- Winner highlight

**Per-game breakdown** (repeat per `match2games[i]`) — all `F`:
- Game number + **stage** (`map`, e.g. "Final Destination")
- Game winner (index → player)
- **P1 character(s)** with stock state: fighter icon(s); if stocks recorded, show "N stocks remaining" (count of `status==1`) and dim lost stocks
- **P2 character(s)** with stock state (same)
- Optional game comment

**Explicitly NOT available (do not build):**
- Stage striking / counterpick order, starter-vs-CP labels (only final stage exists)
- Any in-game telemetry: damage %, KOs, move usage, APM, durations (no per-game `length`), positions
- Live/real-time updates of any kind
- Team rosters / team identity (opponents are individuals)

A safe default: render character icons + stage + set/game scores everywhere; show the stock indicator **only when stock data is present** (it is frequently `?`/absent), and fall back gracefully to "character + game result" when it isn't.
