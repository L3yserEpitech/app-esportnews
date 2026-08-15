# Tier-1 `participant.extra` / `extradata` / `links` keys (Task 0)

**Status: UNVERIFIED against live data.** Live capture was blocked on 2026-06-27 ~14:xx UTC: the per-wiki hourly Liquipedia budget was already exhausted for `valorant`/`rocketleague` (and tier-1 caches were cold), so the local backend returned `budget exhausted, no stale cache`. Budget resets at the top of each clock hour.

Keys below come from the research docs (`match-data-{lol,valorant,dota2}.md`, derived from Liquipedia's open-source Lua modules) and are the **best-guess** key names used by `statColumns.ts` (Task 4) and `draft.ts` (Task 7).

**Why this is safe to proceed on:** `buildPlayerRows` reads each `extra` key defensively (`ex(p, key)` → `'-'` when absent). A wrong/renamed key shows `-` in that column rather than crashing. So unverified keys are low-risk and correctable in one edit once live data is available.

## Per-player `participant.extra` (best-guess keys)

| wiki | character field | extra keys (best-guess) |
|------|-----------------|--------------------------|
| `leagueoflegends` | `character` (champion) | `gold`, `cs`, `damage` |
| `valorant` | `character` (agent) | `acs`, `adr`, `kast` |
| `dota2` | `character` (hero) | `netWorth`, `gpm`, `xpm` |

Common typed fields (already parsed into `NormalizedParticipant`): `player`, `character`, `role`, `team`, `kills`, `deaths`, `assists`.

## Per-game `extradata` draft keys (best-guess)

Bans: `team1bans`/`team2bans` (fallback `t1bans`/`t2bans`), comma-joined string. Picks derived from `participants[].character` by `team`.

## Match-level

`mvp` (string, from `extradata.mvp`), `vod`, `patch`, `links` (map of provider → URL, e.g. `dotabuff`, `stratz`, `opgg`).

## Verify later (next clock hour, stack up)

```bash
python3 /tmp/tier1_keys.py lol leagueoflegends
python3 /tmp/tier1_keys.py valorant valorant
python3 /tmp/tier1_keys.py dota2 dota2
```
If any key differs, update `frontend/app/match/_components/sections/statColumns.ts` (and `draft.ts`) accordingly — no other code changes needed.
