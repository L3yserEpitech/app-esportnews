# Overwatch — Match data (Liquipedia wiki `overwatch`)

> Scope: exhaustive, source-backed reference of EVERY match field Liquipedia exposes for **Overwatch** (wiki `overwatch`, internal acronym `ow`, frontend slug `ow`), to feed a per-game "detailed match page".
> `live?` legend: **L** = updates live during a match (editor-driven, near-real-time) · **F** = final-only (populated when the map/match finishes) · **?** = unclear / depends on editor.

## Sources used (verbatim, citable)

- **Our Go model** of the parsed `/match` response: `backend-go/internal/models/liquipedia_match.go` (`LiqMatch`, `LiqOpponent`, normalizers).
- **Our query field list** (what we actually request): `backend-go/internal/services/liquipedia_poller.go:47` (`LiqMatchQueryFields`).
- **Our request params**: `liquipedia_poller.go:526-600` and `handlers/matches.go:209-221` (`conditions`, `query`, `order`, `limit`, `rawstreams=true`, `streamurls=true`).
- **Liquipedia's own open-source Lua modules** (ground truth for the match2 schema; GitHub `Liquipedia/Lua-Modules`, branch `main`):
  - `lua/wikis/overwatch/MatchGroup/Input/Custom.lua` — Overwatch match/map parser → defines OW-specific extradata.
  - `lua/wikis/overwatch/GetMatchGroupCopyPaste/wiki.lua` — the OW match input template (the only fields editors can fill).
  - `lua/wikis/overwatch/MatchSummary.lua` — what the OW match summary renders.
  - `lua/wikis/overwatch/MapToMode.lua` — map name → map type (mode) table.
  - `lua/wikis/overwatch/InGameRoles.lua` — OW player roles (tank/dps/support/flex).
  - `lua/wikis/commons/Match.lua:444-518` — authoritative `match2` record field lists (`matchFields`, `opponentFields`, `playerFields`, `gameFields`) + `_addCommonGameExtradata` + participants keying (`opponentId.."_"..playerId`).
  - `lua/wikis/commons/MatchGroup/Input/Util.lua:343` — `readMvp` (MVP extradata shape).
- Liquipedia Commons `Help:LiquipediaDB/Match` and `Liquipedia:Brackets/Developers_Guide` (general match2 philosophy: standardize what can be, everything else → `extradata`; participants keyed `X_Y` = opponentid_playerid). *(Pages confirmed via web search snippets; direct fetch was HTTP 429 / IP-throttled at research time.)*

> **Note on direct verification**: `api.liquipedia.net` and the `liquipedia.net` web wiki were rate-limited (HTTP 429) for this IP during research, so a live OW match JSON could not be fetched. Every field below is instead grounded in (a) our production parser, or (b) Liquipedia's own published Lua source that *writes* the match2 records — which is strictly more authoritative than reading one sample page. Where a field's presence depends on editor input, it is marked `?`.

---

## 1. Identity & opponent format

- **Endpoint**: `GET https://api.liquipedia.net/api/v3/match` with `wiki=overwatch`, `Authorization: Apikey <key>` (see `liquipedia_service.go`).
- **Opponent format**: **team vs team** (2 opponents). Confirmed by `MatchFunctions.DEFAULT_MODE = 'team'` and `DEFAULT_BESTOF = 3` in `overwatch/MatchGroup/Input/Custom.lua`. The copy-paste template emits exactly `|opponent1=|opponent2=`. No FFA/battle-royale path for OW.
- **Series format**: best-of-N maps (`bestof`, default 3). Series score = number of maps won, computed from per-map winners (`computeMatchScoreFromMapWinners`).
- **Match identity** (frontend nav): we key matches by `pageid` (numeric, used as `NormalizedMatch.ID`) and carry `match2id` (alphanumeric) + `wiki` for detail lookups (`liquipedia_match.go:324-348`). `objectname` is the dedup key (`UniqueKey()`).

---

## 2. Match-level fields

Source key: **[gomodel]** = `liquipedia_match.go` (we already parse it) · **[qf]** = present in `LiqMatchQueryFields` we request · **[lua]** = `commons/Match.lua` `matchFields`.

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `pageid` | int | Liquipedia page id (our `NormalizedMatch.ID`) | [gomodel][qf] | F |
| `pagename` | string | wiki page name | [gomodel][qf] | F |
| `namespace` | int | MediaWiki namespace (0 = main) | [gomodel][qf] | F |
| `objectname` | string | unique object id (dedup key) | [gomodel][qf] | F |
| `match2id` | string | match2 id (alphanumeric; frontend detail id) | [gomodel][qf] | F |
| `match2bracketid` | string | bracket id this match belongs to | [gomodel][qf] | F |
| `status` | string | match status (e.g. empty / `notplayed`) | [gomodel][qf][lua] | L |
| `winner` | string | winning opponent index `"1"`/`"2"` (`"0"`/empty = none/draw) | [gomodel][qf][lua] | L |
| `walkover` | string | walkover type (`ff`/`dq`/`l`) — v3 back-compat | [qf][lua] | F |
| `resulttype` | string | `np`/`draw`/`default`/`''` — v3 back-compat | [gomodel][qf][lua] | F |
| `finished` | int (0/1) | whether the match is over | [gomodel][qf][lua] | L |
| `mode` | string | match mode (`team`) | [gomodel][qf][lua] | F |
| `type` | string | match type | [gomodel][qf][lua] | F |
| `section` | string | bracket section / round label | [gomodel][qf][lua] | F |
| `game` | string | game/version tag | [gomodel][qf][lua] | F |
| `patch` | string | game patch | [gomodel][qf][lua] | F |
| `bestof` | int | maps needed (series length; default 3) | [gomodel][qf][lua] | F |
| `date` | string | match datetime `YYYY-MM-DD HH:MM:SS` (→ `begin_at`) | [gomodel][qf][lua] | F |
| `dateexact` | int (0/1) | whether the time is exact | [gomodel][qf][lua] | F |
| `vod` | string | VOD URL (match-level) | [gomodel][qf][lua] | F |
| `stream` | object | live stream handles (twitch/youtube/…) — see §below | [gomodel][qf][lua] | L |
| `links` | object | external links (e.g. headtohead, faceit) | [gomodel][qf][lua] | F |
| `tournament` | string | tournament page name | [gomodel][qf][lua] | F |
| `parent` | string | parent page | [gomodel][qf][lua] | F |
| `tickername` | string | short display name (our `name`) | [gomodel][qf] | F |
| `shortname` | string | short name | [gomodel][qf][lua] | F |
| `series` | string | series name | [gomodel][qf][lua] | F |
| `icon` / `iconurl` / `icondark` / `icondarkurl` | string | tournament icons (light/dark) | [gomodel][qf][lua] | F |
| `liquipediatier` | string | tier (e.g. `1`,`2`) | [gomodel][qf][lua] | F |
| `liquipediatiertype` | string | tier type (e.g. `Qualifier`) | [gomodel][qf][lua] | F |
| `publishertier` | string | publisher/official tier (e.g. OWCS) | [gomodel][qf][lua] | F |
| `match2opponents` | array | the two teams — see §3 | [gomodel][qf] | L |
| `match2games` | array | per-map records — see §4 | [gomodel][qf] | L |
| `match2bracketdata` | object | bracket placement/edges | [gomodel][qf] | F |
| `extradata` | object | OW match extradata — see below | [gomodel][qf][lua] | F |

### Match `extradata` (Overwatch-specific)
From `overwatch/MatchGroup/Input/Custom.lua` `MatchFunctions.getExtraData` + the standard input flow (`commons/.../Input/Util.lua:1442`):

| key | type | meaning | source | live? |
|---|---|---|---|---|
| `mvp` | object | MVP: `{players:[{name, displayname, flag, team, template, comment}], points:int}` | `Custom.lua` + `readMvp` (`Input/Util.lua:343`) | F |
| `casters` | array | casters (`caster1`,`caster2` from template) | template + standard flow | F |
| `headtohead` | bool/link | head-to-head link (if enabled) | standard flow | F |

> **Important**: For Overwatch the OW parser's `getExtraData` returns essentially only `mvp`. There is **no** map-pool / pick-ban-phase / economy / round-timeline data at match level. (`Custom.lua` is ~110 lines total — it is one of the leanest parsers in the repo.)

---

## 3. Opponent / team fields  (`match2opponents[]`)

Authoritative list: `commons/Match.lua:478-488` (`opponentFields`). Our parser reads a subset (`liquipedia_match.go:59-71`).

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `name` | string | team page name | [gomodel][lua] | F |
| `template` | string | team template / shortname (→ acronym) | [gomodel][lua] | F |
| `type` | string | `team` (or `literal` for TBD) | [gomodel][lua] | F |
| `score` | string/int | **series score** = maps won (`-1` = no score yet) | [gomodel][lua] | L |
| `status` | string | `W`/`L`/`FF`/`DQ`/… | [gomodel][lua] | L |
| `placement` | int | placement (bracket) | [lua] | F |
| `icon` / `icondark` | string | team logo (light/dark) | [gomodel][lua] | F |
| `match2players` | array | the team's roster for this match — see below | [gomodel] | F |

`match2opponents[].match2players[]` — player fields (`commons/Match.lua:490-495`):

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `name` | string | player page name | [lua] | F |
| `displayname` | string | display nick | [lua] | F |
| `flag` | string | country | [lua] | F |
| `extradata` | object | per-player extras; `extradata.playerteam` set to team | [lua] (`Match.lua:410`) | F |

> These players are the **roster line-up**, NOT per-map performers. There are no per-player match stats here.

---

## 4. Per-game (per-map) fields — `match2games[]`

Authoritative field list: `commons/Match.lua:497-518` (`gameFields`). Our parser maps a subset (`liquipedia_match.go:597-704`).

| field | type | meaning | source | live? |
|---|---|---|---|---|
| `map` | string | map name (e.g. `King's Row`, `Ilios`) | [gomodel][lua] | F |
| `mode` | string | **map type**: `Control` / `Escort` / `Hybrid` / `Push` / `Assault` (see §map types) | [lua] (OW `MapToMode.lua`) | F |
| `winner` | string | map winner index `"1"`/`"2"` | [gomodel][lua] | L |
| `scores` | array[int] | per-opponent map score `[s1, s2]` (e.g. `[2,1]`; Push = meters) | [gomodel][lua] | L |
| `opponents` | array | per-game opponent objects, each with `score`, `status`, `players` | [lua] (used by `MatchSummary.lua`) | L |
| `status` | string | per-map status | [gomodel via extradata path][lua] | L |
| `length` | int/string | map duration (seconds) — **rarely populated for OW** | [gomodel][lua] | F |
| `date` | string | per-map datetime | [lua] | F |
| `game` / `patch` | string | per-map game/patch | [lua] | F |
| `type` | string | per-map type | [lua] | F |
| `subgroup` | int | sub-group index | [lua] | F |
| `rounds` | array | round-by-round data **(generic field; NOT populated by OW parser)** | [lua] | F |
| `resulttype` / `walkover` | string | v3 back-compat | [lua] | F |
| `vod` | string | per-map VOD (from match `extradata.vodgameX` convention) | [lua] | F |
| `participants` | object | per-player-per-map map `"opp_player" → {…}` — **empty for OW** (see §5) | [gomodel][lua] | F |
| `extradata` | object | per-map extras — see below | [gomodel][lua] | F |

### Per-map `extradata` (Overwatch-specific)
From `overwatch/MatchGroup/Input/Custom.lua` `MapFunctions.getExtraData` + common game extradata (`Match.lua:395-405`):

| key | type | meaning | source | live? |
|---|---|---|---|---|
| `team1ban1` | string | team 1's hero **ban** (1 max; resolved hero name) | OW `Custom.lua` | F |
| `team2ban1` | string | team 2's hero **ban** (1 max; resolved hero name) | OW `Custom.lua` | F |
| `banstart` | int (1/2) | which team banned first | OW `Custom.lua` | F |
| `comment` | string | editor comment | common (`Match.lua:397`) | F |
| `dateexact` | bool | exact-time flag | common | F |
| `timestamp` | int | unix timestamp | common | F |
| `timezoneid` / `timezoneoffset` | string | timezone | common | F |

> `MAX_NUM_BANS = 1` (`overwatch/MatchSummary.lua`) — Overwatch records **exactly one hero ban per team per map**, no pick phase. The match summary renders a "Character Ban Table" from these.

### Map types (modes) — `MapToMode.lua` (OW)
`Control`, `Escort`, `Hybrid`, `Push`, `Assault` (Assault = legacy 2CP). Map→type examples: Ilios/Nepal/Busan/Oasis/Lijiang Tower→Control; Dorado/Route 66/Junkertown/Circuit Royal/Shambali→Escort; King's Row/Hollywood/Eichenwalde/Midtown/Numbani→Hybrid; Colosseo/New Queen Street/Esperança→Push; Hanamura/Volskaya/Temple of Anubis/Paris→Assault.
**Gap to flag**: the current `MapToMode.lua` does **not** include OW2's **Flashpoint** (New Junk City, Suravasa) or **Clash** (Hanaoka, Throne of Anubis) maps → for those the map `mode` only appears if the editor sets `|mode=` manually; otherwise it may be blank. The frontend must tolerate an empty/unknown `mode`.
**Push quirk**: Push scores are distances in **meters**; the parser strips a trailing `m` (`computeOpponentScore` `gsub('m','')`) and the summary re-appends `m` for display.

---

## 5. Per-player fields (heroes, role, stats)

**This is the critical finding for Overwatch.**

The Overwatch match input template (`overwatch/GetMatchGroupCopyPaste/wiki.lua`) defines a map as exactly:

```
|mapN={{Map|map=|mode=|score1=|score2=|winner=|t1b1=|t2b1=|banstart=}}
```

There are **no per-player input fields** on an Overwatch map. Consequently:

| desired stat | available? | source / reason |
|---|---|---|
| Heroes **played** per player | **NO** | not in OW Map template; only **bans** (`team1ban1`/`team2ban1`) exist | n/a |
| Hero **bans** (1 per team per map) | **YES (F)** | per-map `extradata.team1ban1` / `team2ban1` | OW `Custom.lua` |
| Player role (tank/dps/support/flex) | **NO (match data)** | roles exist only as *player-page* metadata (`InGameRoles.lua`), never written into match2 | n/a |
| Eliminations / Deaths / Assists (KDA) | **NO** | not parsed, not in OW input template | n/a |
| Damage / Healing / Mitigation | **NO** | not in OW input template | n/a |
| Per-player `participants[]` (`opp_player`) | **EMPTY for OW** | `Match.lua:380-388` builds `participants["1_1"]…` only from `game.opponents[].players`, which the OW parser never populates per map | n/a |
| MVP (match level) | **YES (F)** | `match.extradata.mvp` (player name, team, points) | `Custom.lua` + `readMvp` |

> Net: an Overwatch match2 record carries **no per-player, per-map performance statistics whatsoever**. The only character-level data is **one ban per team per map** plus a **match MVP**. (Contrast: VALORANT/LoL/Dota2 OW-sibling parsers in the same repo populate rich `participants` with agents/champions + KDA + econ; Overwatch deliberately does not.)

Our generic parser (`normalizeGameParticipants`, `liquipedia_match.go:855`) is ready to surface hero/KDA if present, but for OW it will produce an empty `participants` list every time.

---

## 6. Live capability

- **There is NO real-time in-game telemetry.** Liquipedia is an editor-maintained wiki; the v3 API serves whatever editors have typed. There is no feed of live hero positions, ult charge, health, round timers, or live KDA. (Confirmed by the schema: the only "live-moving" fields are scores/winner/status, which editors update as maps conclude.)
- **What is effectively "live" (L)**: `match2opponents[].score` (series score), per-map `scores`/`winner`/`status`, `finished`, and the `stream` object — these are updated by editors during a match, so polling yields **near-real-time, map-granular** updates (minutes of lag, not seconds, and dependent on an editor being active).
- **Live broadcast link**: the `stream` field (we request `rawstreams=true&streamurls=true`) gives twitch/youtube/etc. handles; our parser builds embeddable URLs (`normalizeMatchStreams`, `liquipedia_match.go:478`). This is the real "watch it live" path. `NormalizedMatch.Live` is synthesized client-side from stream presence + computed status (`liquipedia_match.go:286-298`), not from any Liquipedia "live" field.
- **Practical implication**: a "live detailed match page" for OW = live stream embed + auto-refreshing series/map scoreboard + map list with types + bans + MVP. Per-player live stats are **not possible** from this source.

---

## 7. Gap analysis

### Already parsed by us (cite models)
- All match-level scalars in §2 (`LiqMatch`, `liquipedia_match.go:14-55`; requested via `LiqMatchQueryFields`, `liquipedia_poller.go:47`).
- Opponents + series scores (`normalizeMatchOpponents`, `liquipedia_match.go:393`) → `opponents[]`, `results[]`.
- Streams → embeddable URLs (`normalizeMatchStreams`, `:478`).
- Per-map: `map`, `scores`, `winner`, `length`, plus **pass-through** of the whole per-game `extradata` and `participants` (`normalizeMatchGames`, `:597`; `NormalizedGameEntry.ExtraData`/`Participants`, `:165-184`).
- Generic per-player normalizer exists (`NormalizedParticipant`, `:188`) and already maps `hero`/`champion`/`agent`, `role`, KDA — **unused for OW** (no data).

### Available in the source but NOT surfaced today
| data | where it lives | currently |
|---|---|---|
| Per-map **map type / `mode`** (Control/Escort/Hybrid/Push/Assault) | `match2games[].mode` | **NOT mapped** — `normalizeMatchGames` reads `map`, `scores`, `length` but **drops `mode`**. Easy win: add `mode` to `NormalizedGameEntry`. |
| Per-map **hero bans** + `banstart` | `match2games[].extradata.team1ban1/team2ban1/banstart` | Passed through inside `ExtraData` map but not typed/labelled. |
| **MVP** | `match.extradata.mvp` | We pass `match.extradata`? **No** — `NormalizeLiqMatch` does not surface match-level `extradata` at all → MVP currently lost. |
| **casters** | `match.extradata.casters` | Same — match `extradata` not surfaced. |
| Roster `match2players` (per team) | `match2opponents[].match2players` | `LiqOpponent.Match2Players` is captured as raw but not normalized into output. |
| `publishertier`, `liquipediatiertype`, `section`/round, `match2bracketdata` | match-level | Some carried (`Section`, `Match2BracketID`); `publishertier`/tiertype not surfaced. |

### Biggest single gap
**The per-map `mode` (map type) is dropped in `normalizeMatchGames`** even though it is the most OW-distinctive, always-present, free piece of data — and the match-level `extradata` (MVP, casters) is never surfaced at all. These are the two highest-value, lowest-effort additions for an OW detail page.

---

## 8. Proposed max-info detailed-match view for Overwatch

Given the data ceiling (no per-player stats), the richest *honest* OW match page is:

1. **Header**: both teams (logo light/dark, name, template/acronym), **series score** (maps won), status (live/upcoming/finished), tournament + tier + `publishertier` (OWCS badge), date/time, best-of.
2. **Live bar** (when running): embedded **stream** (twitch/youtube) + auto-refresh of series & current-map score (poll cache; map-granular, not second-granular — set expectations in UI).
3. **Map list** (the core, one row per `match2games[]`):
   - Map name + **map-type icon/badge** (Control/Escort/Hybrid/Push/Assault) ← *requires surfacing `mode`*.
   - Per-map score `[s1,s2]` (append `m`/meters for Push), map winner highlight.
   - **Hero ban chips**: `team1ban1`, `team2ban1` (+ who banned first via `banstart`) ← *surface from per-map extradata*.
   - Per-map VOD link if present.
4. **MVP card**: from `match.extradata.mvp` (player, team, points) ← *requires surfacing match extradata*.
5. **Rosters**: each team's `match2players` (nick, flag) — line-ups only; can enrich names→player pages.
6. **Context footer**: bracket section/round, head-to-head link, casters, match VOD.

**Do NOT design for** per-player KDA / damage / healing / heroes-played / role-in-match / round timeline / economy — **none exist** in Liquipedia's Overwatch match data. If those are product requirements, they need a different data source (e.g. OWCS/official stats APIs), not Liquipedia.

**Minimal backend changes to unlock the above** (research note, not a code change): add `mode` to `NormalizedGameEntry`; surface `match.extradata` (at least `mvp`, `casters`) on `NormalizedMatch`; optionally type the per-map ban keys. Everything else is already parsed.
