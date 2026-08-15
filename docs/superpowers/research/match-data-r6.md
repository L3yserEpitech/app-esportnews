# Rainbow Six Siege — Match data (Liquipedia wiki `rainbowsix`)

> Internal acronym `r6siege` · frontend slug `r6` · wiki `rainbowsix`.
> Goal: catalogue **everything** Liquipedia exposes for an R6 match, to design a max-info detailed-match page.
> Every field below is backed by a concrete source. Where a desirable stat does **not** exist, it is called out explicitly.

## Sources used (authoritative)

- **Our Go model** (what we already deserialize): `/Users/jules/Code/freelance/esportnews/backend-go/internal/models/liquipedia_match.go`
- **Our query fields** (what we ask the API for): `LiqMatchQueryFields`, `backend-go/internal/services/liquipedia_poller.go:47`
- **R6 match parser** (defines exactly which keys R6 writes into `extradata`): `Liquipedia/Lua-Modules` → `lua/wikis/rainbowsix/MatchGroup/Input/Custom.lua`
- **R6 contributor template** (the complete list of inputs an editor can fill = the upper bound of what exists): `lua/wikis/rainbowsix/GetMatchGroupCopyPaste/wiki.lua`
- **R6 render module** (what is actually displayed on the wiki, i.e. what data is real): `lua/wikis/rainbowsix/MatchSummary.lua`
- **Generic match2 type definitions**: `lua/wikis/commons/MatchGroup/Util.lua`
- **General match2 schema**: Liquipedia Commons `Help:LiquipediaDB/Match` and `Module:Match`

> ⚠️ NOTE on `api.liquipedia.net`: not queried live (rate-limited 429, key can't be passed via WebFetch). The R6 `extradata` shape is taken directly from the R6 Lua parser/render modules, which are the single source of truth for what the `match` datapoint contains — more reliable than eyeballing one match page.

---

## 1. Identity & opponent format

- **Opponent format**: `team` vs `team` (2 opponents). R6 `MatchFunctions.DEFAULT_MODE = 'team'` (Input/Custom.lua). Matches are always 2 named teams; our `HasTwoNamedOpponents()` filter (liquipedia_match.go:75) already drops TBD/literal/1-sided entries.
- **Series length**: `bestof` (Bo1/Bo2/Bo3/Bo5…). We parse it (`LiqMatch.BestOf`) → `number_of_games` / `match_type=best_of_N`.
- **Identity**: `pageid` (numeric, used as our `id`), `pagename`, `objectname`, `match2id` (alphanumeric, used for detail navigation), `match2bracketid`/`section` (bracket placement). All parsed in `LiqMatch`.
- **A match's data lives in three layers** (match2 schema, confirmed in `Module:Match`):
  1. **match-level** — top-level fields + `extradata`
  2. **opponent-level** — `match2opponents[]`, each carrying `match2players[]` (the roster lineup)
  3. **per-map** — `match2games[]`, each carrying its own `scores`, `winner`, and an R6-specific `extradata` block

---

## 2. Match-level fields

`live?` legend: **L** = changes during a live match (editor-driven, see §6) · **F** = final/static · **?** = depends.

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `pageid` | int | Wiki page id (our `match.id`) | `LiqMatch.PageID`, queried | F |
| `match2id` | string | Stable match id (detail nav) | `LiqMatch.Match2ID`, queried | F |
| `match2bracketid` / `section` | string | Bracket / round placement | `LiqMatch.Match2BracketID`, `.Section`, queried | F |
| `pagename` / `objectname` | string | Source page / object key (slug, dedup) | `LiqMatch`, queried | F |
| `tournament` / `parent` / `series` | string | Tournament / parent page / series name | `LiqMatch`, queried | F |
| `tickername` / `shortname` | string | Display name of the match | `LiqMatch`, queried | F |
| `date` | datetime | Scheduled start `YYYY-MM-DD HH:MM:SS` | `LiqMatch.Date`, queried | ? (can be rescheduled) |
| `dateexact` | 0/1 | Whether the time is confirmed | `LiqMatch.DateExact`, queried | ? |
| `bestof` | int | Series length | `LiqMatch.BestOf`, queried | F |
| `finished` | 0/1 | Series over | `LiqMatch.Finished`, queried | **L** (0→1) |
| `status` | string | Match status (e.g. empty / `notplayed`) | `LiqMatch.Status`, queried | **L** |
| `winner` | "1"/"2"/"0" | Winning opponent index | `LiqMatch.Winner`, queried | **L** |
| `walkover` / `resulttype` | string | Forfeit / result type (e.g. `default`, `np`) | `LiqMatch`, queried | **L** |
| `mode` | string | `team` for R6 | `LiqMatch.Mode`, queried | F |
| `game` / `patch` | string | Game version / patch label | `LiqMatch`, queried | F |
| `liquipediatier` / `liquipediatiertype` / `publishertier` | string | Tournament tier metadata | `LiqMatch`, queried | F |
| `icon` / `iconurl` / `icondark` / `icondarkurl` | string | Tournament icons (light/dark) | `LiqMatch`, queried | F |
| `vod` | string | VOD URL of the **series** | `LiqMatch.Vod`, queried | F (post-match) |
| `stream` | object | Live stream handles per platform (twitch/youtube/…) | `LiqMatch.Stream` (`rawstreams=true&streamurls=true`) | **L** (pre/live) |
| `links` | object | External match links (e.g. SiegeGG, datdota-equivalents) | `LiqMatch.Links`, queried | F |
| `match2opponents` | array | Teams + rosters + scores (see §3) | `LiqMatch.Match2Opponents`, queried | **L** |
| `match2games` | array | Per-map data (see §4) | `LiqMatch.Match2Games`, queried | **L** |
| `extradata` | object | **Match-level R6 extras: `mapveto`, `mvp`** (see below) | `LiqMatch.ExtraData`, queried | **L**/F |
| `match2bracketdata` | object | Bracket tree wiring | `LiqMatch.Match2BracketData`, queried | F |

**Match-level `extradata` keys for R6** (authoritative — `MatchFunctions.getExtraData`, Input/Custom.lua):

| Key | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `mapveto` | object | Full veto sequence: `firstpick`, `types` (e.g. `ban,ban,pick,ban,decider`), `t1map1..4` / `t2map1..4`, `decider` | Input/Custom + copy-paste `MapVeto` block; rendered by `MatchSummaryWidgets.MapVeto` | F (set pre-match) |
| `mvp` | object | Series MVP player(s) — names + points | `MatchGroupInputUtil.readMvp`; rendered by `MatchSummaryWidgets.Mvp` | F (post-match) |
| `casters` | list | Casters (`caster1`, `caster2` inputs) — stored in match extradata by the generic util | copy-paste `caster1/caster2`; generic `MatchGroupInputUtil` | F |

---

## 3. Opponent / team fields (`match2opponents[]`)

Each opponent (generic match2 + `MatchGroupUtil.Util`):

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `name` | string | Team page name | `LiqOpponent.Name`, parsed | F |
| `template` | string | Team shortname/template (≈ acronym) | `LiqOpponent.Template`, parsed | F |
| `score` | int/string | **Series** score (maps won); `-1` = not played yet | `LiqOpponent.Score`, parsed (`parseScore` clamps -1→0) | **L** |
| `status` | string | e.g. `S` (scored) / `FF` (forfeit) | `LiqOpponent.Status`, parsed | **L** |
| `type` | string | `team` / `literal` | `LiqOpponent.Type`, parsed | F |
| `id` | int | Opponent index 1/2 | `LiqOpponent.ID`, parsed | F |
| `icon`/`iconurl`/`icondark`/`icondarkurl` | string | Team logos (light/dark) | `LiqOpponent`, parsed | F |
| `match2players` | array | **Team roster/lineup for this match** | `LiqOpponent.Match2Players` (raw, parsed into struct but **not normalized** — see §7) | F |

**Per-player fields inside `match2players[]`** (generic `standardPlayer`, `MatchGroup/Util.lua`): `displayName`, `pageName`, `flag` (country), `team`, `faction`, `extradata`. → These are **roster identities only** (who played), **not stat lines**. See §5.

---

## 4. Per-game (per-map) fields — `match2games[]`

Generic per-game fields (`MatchGroupUtilGame`, Util.lua) — all parsed by `normalizeMatchGames` (liquipedia_match.go:598):

| Field | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `map` | string | Map name (Bank, Clubhouse, …) | parsed → `NormalizedGameEntry.Map` | **L** |
| `mapDisplayName` | string | Pretty map name | Util.lua (not separately parsed) | F |
| `winner` | "1"/"2" | Map winner index | parsed → `NormalizedGameEntry.Winner` | **L** |
| `scores` | int[] | **Total rounds won per team on this map** (`[t1total, t2total]`) | parsed → `NormalizedGameEntry.Scores` | **L** |
| `length` | int/string | Map duration (seconds) — rarely set for R6 | parsed → `NormalizedGameEntry.Length` | F |
| `finished` | bool/0/1 | Map complete | parsed → `NormalizedGameEntry.Finished` | **L** |
| `date` / `dateIsExact` | datetime | Per-map start (usually empty for R6) | Util.lua | ? |
| `vod` | string | Per-map VOD | Util.lua (not separately parsed) | F |
| `participants` / `opponents[].players` | object/array | Per-player per-map stat slots | parsed → `NormalizedGameEntry.Participants` — **EMPTY for R6** (see §5) | — |
| `extradata` | object | **R6-specific per-map block** (below) | parsed → `NormalizedGameEntry.ExtraData` (pass-through) | **L** |

### Per-map `extradata` — the R6 gold (authoritative: `MapFunctions.getExtraData`, Input/Custom.lua)

| Key | Type | Meaning | Source | live? |
|---|---|---|---|---|
| `t1firstside` | object `{rt, ot}` | Which side **team 1** started on in regular time (`rt`) and overtime (`ot`): `atk`/`def` | Input/Custom; rendered side-by-side in `MatchSummary.lua` | F |
| `t1halfs` | object `{atk, def, otatk, otdef}` | **Rounds team 1 won** while on attack / defense / OT-attack / OT-defense | Input/Custom (`t1atk`,`t1def`,`t1otatk`,`t1otdef`); rendered as partial scores | **L** |
| `t2halfs` | object `{atk, def, otatk, otdef}` | Same, for team 2 | Input/Custom | **L** |
| `t1bans` | string[] | **Operators banned by team 1** on this map (resolved character names) | Input/Custom (`t1ban1..N` via `CharacterNames`); rendered by `CharacterBanTable` | F |
| `t2bans` | string[] | Operators banned by team 2 | Input/Custom | F |
| `t1bantypes` / `t2bantypes` | string[] | Side type (`atk`/`def`) of each ban slot. `siege` format = 2 bans/team; `siegeX` format = 6 bans/team | Input/Custom `OPERATOR_BAN_FORMATS` | F |

**Map score derivation** (`MapFunctions.calculateMapScore`): map score = `t#atk + t#def + t#otatk + t#otdef`. So the per-side breakdown reconstructs the full round count (e.g. a 7–5 with 4 atk / 3 def). This is **the richest live-updatable R6 datum we have.**

---

## 5. Per-player fields (K/D, operators, entry, plants…)

**Verdict: Liquipedia stores NO per-player in-match statistics for Rainbow Six.** This is not an omission on our side — R6's parser simply never writes them.

Evidence (all from the R6 modules, which are the source of truth):
- `lua/wikis/rainbowsix/MatchGroup/Input/Custom.lua` — the R6 `MapFunctions` defines **only** `getExtraData` (halfs/bans/firstside) and `calculateMapScore`. There is **no** `getPlayersOfMapOpponent` / participant-stats function. By contrast, wikis like VALORANT/LoL define per-player map stat extraction; R6 does not.
- `lua/wikis/rainbowsix/GetMatchGroupCopyPaste/wiki.lua` — the complete contributor input set contains **zero** per-player stat fields. Per map you can only enter: `map`, `score`, `finished`, `bantype`, `t#ban1..N`, `t#firstside(ot)`, `t#atk/def/otatk/otdef`. No kills, deaths, KDA, entries, plants, defuses, KOST, HS%, ratings, or per-player operators.
- `lua/wikis/rainbowsix/MatchSummary.lua` — the renderer outputs only: per-map side scores, MVP, MapVeto, and the operator **CharacterBanTable**. No player stat table exists to render.

| Desired R6 stat | Available on Liquipedia? | Notes |
|---|---|---|
| Player K / D / A | ❌ No | not in schema |
| Entry frags / opening kills | ❌ No | — |
| Plants / defuses (per player) | ❌ No | — |
| KOST / SRV / clutches / HS% / rating | ❌ No | (exist on SiegeGG/r6analyst, **not** Liquipedia structured data) |
| Operators **played** per player | ❌ No | only team **bans** are stored (`t#bans`), not per-player picks |
| **Roster / lineup** (who played) | ✅ Yes | `match2opponents[].match2players[]` → `displayName`, `pageName`, `flag`. Identities only, no stats |
| **Series MVP** (single highlighted player) | ✅ Yes | match `extradata.mvp` |

→ The only "player-level" R6 data points that exist are **the two rosters** and **the MVP**. Everything granular (K/D, entries, plants, KOST, operators-per-player) must come from a **non-Liquipedia source** (e.g. SiegeGG, r6analyst, Ubisoft) if ever wanted — it is not in the `match` datapoint. Do not fabricate it.

`live?` for these: roster = **F**, MVP = **F** (post-match). N/A for the unavailable stats.

---

## 6. Live capability

- **No real-time in-game telemetry exists.** Liquipedia is a wiki: the `match` datapoint is **edited by humans**, so "live" data is only as fresh as the volunteer editor updating the page. There is no round-by-round automatic feed, no kill feed, no live operator/utility state.
- **What can update during a live match (L):** `finished`, `winner`, opponent `score` (maps won), per-map `scores`, per-map `t#halfs` (round counts by side), `status`, and `stream` (the live Twitch/YouTube handle). In practice editors update these between maps / at notable points, with minutes-to-tens-of-minutes lag — sometimes only after the series ends.
- **Our pipeline already supports catching these edits near-real-time**: the Liquipedia webhook → `DirtyTracker` → targeted poller refresh path (see CLAUDE.md §11) marks the wiki dirty on `edit` and re-fetches. So "as live as Liquipedia gets" is achievable without extra API budget.
- **Practical live UX for R6:** the genuinely useful live element is the **embedded stream** (already parsed into `streams_list`) plus the **series score + per-map round score** as editors update them. Treat per-round detail as "best-effort, may lag," never as a real-time scoreboard.

---

## 7. Gap analysis

### Already fetched AND surfaced to the frontend
- Match identity, status, schedule, bestof, winner, tier, tournament/series, icons — `NormalizeLiqMatch` (liquipedia_match.go).
- Opponents + **series scores** + team logos — `normalizeMatchOpponents`.
- Live **streams** (twitch/youtube embeds) — `normalizeMatchStreams` (`rawstreams=true&streamurls=true`).
- Per-map: `map`, `scores`, `winner`, `length`, `finished` — `normalizeMatchGames`.
- **Per-map `extradata` is passed through verbatim** → `NormalizedGameEntry.ExtraData` (liquipedia_match.go:681-684). This means **`t1halfs`/`t2halfs`, `t1firstside`, `t1bans`/`t2bans`, `t#bantypes` already reach the frontend today** under `games[].extradata`. The data is there; it's just not yet shaped/labelled for a UI.

### Fetched but DROPPED in normalization (low-effort wins — no extra API cost)
1. **Match-level `extradata` (`mapveto`, `mvp`, `casters`)** — `LiqMatch.ExtraData` is queried but `NormalizedMatch` has **no** field carrying it (struct liquipedia_match.go:109-140). → Veto board, MVP, and casters are currently lost. **Biggest single gap.**
2. **`vod`** — `LiqMatch.Vod` parsed but not mapped into `NormalizedMatch`. → Post-match VOD link dropped.
3. **Rosters (`match2opponents[].match2players`)** — `LiqOpponent.Match2Players` is deserialized into the struct but `normalizeMatchOpponents` never reads it. → Per-team lineups (player names + flags) are dropped.
4. **`links`** — `LiqMatch.Links` parsed, not surfaced. → External match links (SiegeGG etc.) dropped.
5. **`participants`** is parsed (`NormalizedGameEntry.Participants`) but is **always empty for R6** — correct behavior, just note it carries nothing for this game.

### Not available from Liquipedia at all (cannot be parsed — do not promise it)
- All per-player in-match stats: K/D/A, entries, plants/defuses, KOST/SRV/clutch/HS%/rating, operators-played-per-player. (§5)

---

## 8. Proposed max-info detailed-match view for R6

Built **only** from data that provably exists. Ordered by impact.

**Header**
- Team A vs Team B (logos light/dark), **series score** (maps won), status badge (live/finished/upcoming), tournament + tier + date. *(all already surfaced)*
- **Live stream embed** when running (already in `streams_list`); **VOD** button when finished *(needs gap-fix #2)*.

**Map veto strip** *(needs gap-fix #1 — `extradata.mapveto`)*
- Render the ban/pick order using `firstpick` + `types` (`ban,ban,pick,ban,decider`) and `t1map1..`/`t2map1..`/`decider`. High-value, R6-fans love the veto board.

**Per-map cards** *(data already in `games[].extradata` — just needs UI shaping)*
- Map name + map winner + **final round score** (`scores`).
- **Side breakdown**: from `t#firstside` + `t#halfs` show "ATK x / DEF y (+ OT)" per team, with atk/def icons (mirror `MatchSummary.lua`'s partial-score layout). This is the signature R6 detail.
- **Operator ban table** per map: `t1bans` / `t2bans` (operator portraits via the wiki character names), labelled atk/def from `t#bantypes`.

**Match footer**
- **MVP** (player name) *(gap-fix #1 — `extradata.mvp`)*.
- **Lineups**: Team A / Team B rosters with player names + country flags *(gap-fix #3 — `match2players`)*.
- **Casters** + external **links** (SiegeGG…) *(gap-fixes #1/#4)*.

**Explicitly NOT in this view** (no source): per-player K/D, entry frags, plants/defuses, KOST, per-player operators. If these are ever desired, they require a second, non-Liquipedia data provider — flag as out of scope for the Liquipedia integration.

---

### One-paragraph engineering takeaway
The R6 `match` datapoint is **team/map-centric, not player-centric**. We already pull and pass through the richest part (per-map side-split round scores + operator bans via `games[].extradata`); the cheapest high-impact improvements are purely in normalization — surface match-level `extradata` (**mapveto + mvp + casters**), `vod`, rosters (`match2players`), and `links`, none of which cost extra API budget. There is **no per-player stat data and no real-time telemetry** to be had from Liquipedia for R6; the live experience tops out at the stream embed plus editor-updated scores.
