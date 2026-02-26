# Documentation Squad Players v3 — Liquipedia API

## Endpoint

- **URL** : `https://api.liquipedia.net/api/v3/squadplayer`
- **Method** : `GET`
- **Description** : Get information from the squadplayer table. This links players to their current (or former) teams with role, position, and join/leave dates.

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
| `pagename` | string | Team page name this player belongs to (e.g. `Fnatic`, `Team_Liquid`) |
| `namespace` | number | Namespace (0 = main content) |
| `objectname` | string | Object identifier (unique per squad entry) |
| `id` | string | Player identifier / in-game name (IGN / pseudo, e.g. "Alfajer", "Derke") |
| `link` | string | Player page name on Liquipedia (links to the player's wiki page) |
| `name` | string | Player real name (e.g. "Emir Ali Beder") |
| `nationality` | string | Player nationality (ISO country code or full name, e.g. "tr", "Turkey") |
| `position` | string | Player position (game-specific, e.g. "1", "2" for Dota 2 carry/mid) |
| `role` | string | Player role (e.g. "player", "coach", "analyst", "manager", "substitute") |
| `type` | string | Squad section type (e.g. "player", "staff", "inactive", "former") |
| `newteam` | string | New team page name (if player is leaving/transferring) |
| `teamtemplate` | string | Current team template identifier (lowercase, e.g. "fnatic") |
| `newteamtemplate` | string | New team template identifier (if transferring) |
| `status` | string | Player status in the squad (e.g. "active", "inactive", "former") |
| `joindate` | exactdate | Date the player joined the team (YYYY-MM-DD HH:MM:SS) |
| `joindateref` | json | Reference/source for the join date |
| `leavedate` | exactdate | Date the player left the team (YYYY-MM-DD HH:MM:SS, empty if still on team) |
| `leavedateref` | json | Reference/source for the leave date |
| `inactivedate` | exactdate | Date the player became inactive (YYYY-MM-DD HH:MM:SS) |
| `inactivedateref` | json | Reference/source for the inactive date |
| `extradata` | json | Additional player metadata |

## Key Field Values

### `type` — Squad section

| Value | Description |
|-------|-------------|
| `player` | Active player on the roster |
| `staff` | Coaching/management staff |
| `inactive` | Currently inactive player |
| `former` | Former player (has left the team) |

### `role` — Player role

| Value | Description |
|-------|-------------|
| `player` | In-game player |
| `coach` | Head coach |
| `analyst` | Analyst |
| `manager` | Team manager |
| `substitute` | Substitute player |

### `status` — Player status

| Value | Description |
|-------|-------------|
| `active` | Currently active on the team |
| `inactive` | On the team but inactive |
| `former` | No longer on the team |

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

**Get current active roster for a team:**
```
conditions=[[pagename::Fnatic]] AND [[type::player]] AND [[status::active]]
```

**Get all squad members (players + staff) for a team:**
```
conditions=[[pagename::Fnatic]] AND [[type::player]] OR [[pagename::Fnatic]] AND [[type::staff]]
```

**Get active roster by team template (cross-wiki):**
```
conditions=[[teamtemplate::fnatic]] AND [[type::player]] AND [[status::active]]
```

## HTTP Response Codes

| Code | Description |
|------|-------------|
| `200` | Successful call. Returns `{ "result": [ {} ] }` |
| `403` | Invalid API key. Returns `{ "error": [ "string" ] }` |
| `404` | Asking for data that does not exist. Returns `{ "error": [ "string" ] }` |
| `429` | Over API limit. Returns `{ "error": [ "string" ] }` |

## Example API Calls

**Get active roster for Fnatic (Valorant):**
```
GET https://api.liquipedia.net/api/v3/squadplayer?wiki=valorant&conditions=[[pagename::Fnatic]] AND [[type::player]] AND [[status::active]]&limit=20
Authorization: Apikey <token>
User-Agent: EsportNews/1.0 (contact@esportnews.fr)
Accept: application/json
```

**Get all squad entries for a team (including staff, inactive, former):**
```
GET https://api.liquipedia.net/api/v3/squadplayer?wiki=valorant&conditions=[[pagename::Fnatic]]&limit=50&order=type ASC
Authorization: Apikey <token>
User-Agent: EsportNews/1.0 (contact@esportnews.fr)
Accept: application/json
```

## Notes for EsportNews Integration

- **Team ↔ Players link** : `pagename` in squadplayer matches `pagename` in the team endpoint. This is how we join teams to their players.
- **Player ID** : The `id` field is the player's IGN (in-game name / pseudo), NOT a numeric ID. The `link` field is the player's wiki page name.
- **Active roster only** : Filter with `[[type::player]] AND [[status::active]]` to get the current starting roster. Exclude `type::staff`, `type::inactive`, `type::former`.
- **Role mapping** : The `role` field values may need normalization for the frontend (e.g. Liquipedia "player" → frontend-specific roles like "duelist", "controller" are game-specific and may come from `position` or `extradata`).
- **Player image** : NOT available in squadplayer data. To get player photos, a separate call to `/v3/player` with `[[pagename::PlayerLink]]` would be needed (costs an extra API request per player). Consider leaving `image_url` as null and relying on frontend initials fallback.
- **Nationality** : Directly available. Can be used for flag display in the frontend.
- **2 API calls per team detail** : 1 for `/v3/team` (team info) + 1 for `/v3/squadplayer` (roster). Budget: 2 requests from the on-demand reserve per team lookup.
- **Deduplication** : Use `objectname` as the dedup key for squad entries.
