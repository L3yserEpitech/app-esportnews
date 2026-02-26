# Documentation Players v3 — Liquipedia API

## Endpoint

- **URL** : `https://api.liquipedia.net/api/v3/player`
- **Method** : `GET`
- **Description** : Get information from the player table. Contains detailed player profiles including real name, nationality, birthdate, current team, earnings, and external links.

The v3 API is OpenAPI compliant, you can find the OpenAPI documentation here!

## General Rules

- All requests have to be made as GET requests.
- Each API call needs the parameter `wiki` and the API key in the `Authorization` header like `Apikey ThisIsALongStringThatIsOurExampleApiKey`.
- Multi-wiki calls can be done by pipe-separating (`|`) wiki names. API keys can be obtained on the API keys page (ask your manager if you don't have access).
- On failed requests the API will return a non-200 http status code.
- There is a chance duplicates will be in the API, filter the results yourself or use a relevant `groupby` clause.
- Other parameters have to be submitted as query parameters in the url.
- Your client must accept gzip encoding.
- When doing multi-wiki requests, mind that all of `limit`, `offset`, `order` and `groupby` are done on a per wiki basis.

## Response Format

The return value of a proper API call is a json object with up to 3 keys:

- **result** : The result of the query as an array of objects. This key will be an empty array on invalid requests.
- **error** (optional) : Invalid API calls will have this key to tell you what went wrong. This key is an array of strings.
- **warning** (optional) : We will use this to notify you of non-fatal issues with your request. Examples for this are deprecations, or if the API struggled to return data from some page. If this unexpectedly happens repeatedly, feel free to notify us about it. This key is an array of strings.

## Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `wiki` | string | **required** | The wikis you want data from. Pipe-separate multiple wikis for multiwiki requests. | `dota2`, `dota2\|counterstrike` |
| `conditions` | string | optional | The filters you want to apply to the request. | `[[pagename::Some/Liquipedia/Page]] AND [[namespace::0]]` |
| `query` | string | optional | The datapoints you want to query. | `pagename, pageid, namespace` |
| `limit` | integer | optional | The amount of results you want. | `20` |
| `offset` | integer | optional | This can be used for pagination. | `20` |
| `order` | string | optional | The order you want your result in. | `pagename ASC` |
| `groupby` | string | optional | What you want your results grouped by (can be helpful when using aggregate functions). | `pagename ASC` |

## Data Points

This API makes the following data points available:

| Field | Type | Description |
|-------|------|-------------|
| `pageid` | number | Page ID on Liquipedia (unique numeric identifier) |
| `pagename` | string | Player page name on Liquipedia (e.g. `Alfajer`, `s1mple`) |
| `namespace` | number | Namespace (0 = main content) |
| `objectname` | string | Object identifier (unique per player) |
| `id` | string | Player in-game name / IGN / pseudo (e.g. "Alfajer", "s1mple") |
| `alternateid` | string | Alternative in-game name (previous IGN, smurf, etc.) |
| `name` | string | Player real name (e.g. "Emir Ali Beder", "Oleksandr Kostyliev") |
| `localizedname` | string | Localized version of the real name (native script, e.g. Japanese, Korean, Chinese) |
| `type` | string | Entity type (e.g. "player", "caster", "analyst", "coach") |
| `nationality` | string | Primary nationality (country name or ISO code) |
| `nationality2` | string | Second nationality (dual citizenship) |
| `nationality3` | string | Third nationality |
| `region` | string | Player region (e.g. "Europe", "North America", "Korea") |
| `birthdate` | date | Date of birth (YYYY-MM-DD) |
| `deathdate` | date | Date of death (YYYY-MM-DD, very rarely used) |
| `teampagename` | string | Current team page name (e.g. "Fnatic", "Team_Liquid") |
| `teamtemplate` | string | Current team template identifier (lowercase, e.g. "fnatic") |
| `links` | json | External links (twitter, twitch, youtube, instagram, etc.) |
| `status` | string | Player status (e.g. "active", "inactive", "retired") |
| `earnings` | number | Total career earnings in USD |
| `earningsbyyear` | json | Earnings breakdown by year (e.g. `{"2024": 150000, "2025": 50000}`) |
| `extradata` | json | Additional player metadata |

## Key Field Values

### `type` — Player type

| Value | Description |
|-------|-------------|
| `player` | Professional player |
| `caster` | Caster / commentator |
| `analyst` | Analyst |
| `coach` | Coach |

### `status` — Player status

| Value | Description |
|-------|-------------|
| `active` | Currently active and competing |
| `inactive` | Not currently competing |
| `retired` | Has retired from competitive play |

## Conditions Syntax (for filtering)

```
[[field::value]]                          - Exact match
[[field::!value]]                         - Not equal
[[field::>value]]                         - Greater than
[[field::<value]]                         - Less than
[[condition1]] AND [[condition2]]         - AND logic
[[condition1]] OR [[condition2]]          - OR logic
```

### Useful conditions for our use cases:

**Get a specific player by page name:**
```
conditions=[[pagename::Alfajer]]
```

**Get a specific player by IGN:**
```
conditions=[[id::Alfajer]]
```

**Get all active players on a team:**
```
conditions=[[teampagename::Fnatic]] AND [[status::active]] AND [[type::player]]
```

**Get player by pageid:**
```
conditions=[[pageid::12345]]
```

## HTTP Response Codes

| Code | Description |
|------|-------------|
| `200` | Successful call. Returns `{ "result": [ {} ] }` |
| `403` | Invalid API key. Returns `{ "error": [ "string" ] }` |
| `404` | Asking for data that does not exist. Returns `{ "error": [ "string" ] }` |
| `429` | Over API limit. Returns `{ "error": [ "string" ] }` |

## Example API Calls

**Get a player profile:**
```
GET https://api.liquipedia.net/api/v3/player?wiki=valorant&conditions=[[pagename::Alfajer]]&limit=1
Authorization: Apikey <token>
User-Agent: EsportNews/1.0 (contact@esportnews.fr)
Accept: application/json
```

**Get all active players for a team:**
```
GET https://api.liquipedia.net/api/v3/player?wiki=valorant&conditions=[[teampagename::Fnatic]] AND [[status::active]]&limit=20
Authorization: Apikey <token>
User-Agent: EsportNews/1.0 (contact@esportnews.fr)
Accept: application/json
```

## Notes for EsportNews Integration

- **Relation to squadplayer** : `/v3/squadplayer` tells you WHO is on a team (roster). `/v3/player` gives you the FULL PROFILE of a player (birthdate, earnings, region, links). The `link` field from squadplayer corresponds to `pagename` in player.
- **Player image** : NOT available via this endpoint. Liquipedia player images are on wiki pages but not exposed in the API. Use frontend initials fallback.
- **Age calculation** : Use `birthdate` (YYYY-MM-DD) to compute age on the frontend. Some players have no birthdate.
- **Nationality** : Up to 3 nationalities supported (`nationality`, `nationality2`, `nationality3`). Use primary for flag display.
- **Earnings** : Available per-player and broken down by year. Can be used for player stats display.
- **Current team** : `teampagename` and `teamtemplate` link to the team. Can be empty if the player is teamless/free agent.
- **Cost** : 1 extra API request per player detail. For team roster enrichment (photos, birthdate), this means N additional requests per N players. Consider skipping this for V1 and only using squadplayer data.
- **Deduplication** : Use `pageid` or `objectname` as dedup key.
- **Recommended strategy for Phase 4** : Use `/v3/squadplayer` for roster data (cheap: 1 request per team). Only call `/v3/player` if a detailed player profile page is needed (future feature). This saves API budget.
