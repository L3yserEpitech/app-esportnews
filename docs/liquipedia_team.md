# Documentation Teams v3 — Liquipedia API

## Endpoint

- **URL** : `https://api.liquipedia.net/api/v3/team`
- **Method** : `GET`
- **Description** : Get information from the team table.

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
| `pagename` | string | Full page name (e.g. `Fnatic`, `Team_Liquid`) |
| `namespace` | number | Namespace (0 = main content) |
| `objectname` | string | Object identifier (unique per team) |
| `name` | string | Display name of the team (e.g. "Fnatic", "Team Liquid") |
| `locations` | json | Team locations (headquarters, country, region) |
| `region` | string | Team region (e.g. "Europe", "North America", "Korea", "China") |
| `logo` | string | Logo filename (light mode) |
| `logourl` | string | Full URL for team logo (light mode) |
| `logodark` | string | Logo filename (dark mode) |
| `logodarkurl` | string | Full URL for team logo (dark mode) |
| `textlesslogourl` | string | Full URL for textless/icon-only logo (light mode) |
| `textlesslogodarkurl` | string | Full URL for textless/icon-only logo (dark mode) |
| `status` | string | Team status (e.g. "active", "disbanded", "inactive") |
| `createdate` | date | Date the team was created (YYYY-MM-DD) |
| `disbanddate` | date | Date the team was disbanded (YYYY-MM-DD, empty if active) |
| `earnings` | number | Total earnings in USD |
| `earningsbyyear` | json | Earnings breakdown by year (e.g. `{"2024": 500000, "2025": 200000}`) |
| `template` | string | Team template identifier (used for matching across wikis) |
| `links` | json | External links (website, twitter, facebook, instagram, youtube, etc.) |
| `extradata` | json | Additional team metadata |

## Team Status Values

| Status | Description |
|--------|-------------|
| `active` | Team is currently active and competing |
| `disbanded` | Team has been disbanded |
| `inactive` | Team exists but is not currently competing |

## Conditions Syntax (for filtering)

The `conditions` parameter uses a wiki-style syntax:

```
[[field::value]]                          - Exact match
[[field::!value]]                         - Not equal
[[field::>value]]                         - Greater than
[[field::<value]]                         - Less than
[[condition1]] AND [[condition2]]         - AND logic
[[condition1]] OR [[condition2]]          - OR logic
```

### Useful conditions for our use cases:

**Search team by name (partial match not supported — use exact match or client-side filter):**
```
conditions=[[name::Fnatic]]
```

**Search by pagename:**
```
conditions=[[pagename::Fnatic]]
```

**Active teams only:**
```
conditions=[[status::active]]
```

**Team by template (cross-wiki identifier):**
```
conditions=[[template::fnatic]]
```

**Note on search** : The Liquipedia API does NOT support partial/fuzzy text search natively. To implement search:
1. Fetch teams with a broad condition (e.g. all active teams)
2. Filter client-side (Go) by `name` containing the search query
3. Or use `[[name::SearchTerm]]` for exact matches only

## HTTP Response Codes

| Code | Description |
|------|-------------|
| `200` | Successful call. Returns `{ "result": [ {} ] }` |
| `403` | Invalid API key. Returns `{ "error": [ "string" ] }` |
| `404` | Asking for data that does not exist. Returns `{ "error": [ "string" ] }` |
| `429` | Over API limit. Returns `{ "error": [ "string" ] }` |

## Example API Calls

**Get a specific team:**
```
GET https://api.liquipedia.net/api/v3/team?wiki=valorant&conditions=[[pagename::Fnatic]]&limit=1
Authorization: Apikey <token>
User-Agent: EsportNews/1.0 (contact@esportnews.fr)
Accept: application/json
```

**Get active teams (for search):**
```
GET https://api.liquipedia.net/api/v3/team?wiki=valorant&conditions=[[status::active]]&limit=50&order=name ASC
Authorization: Apikey <token>
User-Agent: EsportNews/1.0 (contact@esportnews.fr)
Accept: application/json
```

**Get team by pageid:**
```
GET https://api.liquipedia.net/api/v3/team?wiki=valorant&conditions=[[pageid::12345]]&limit=1
Authorization: Apikey <token>
User-Agent: EsportNews/1.0 (contact@esportnews.fr)
Accept: application/json
```

## Notes for EsportNews Integration

- **Unique identifier** : `pageid` (number) is the primary unique key. `pagename` and `template` are also unique per wiki.
- **Favorite teams** : Use `pageid` (int) to store in `favorite_teams BIGINT[]` — no DB migration needed.
- **Logo images** : Use `logourl` for light mode, `logodarkurl` for dark mode. `textlesslogourl` / `textlesslogodarkurl` for icon-only variants.
- **Acronym** : Not directly available as a field. Can be derived from `template` (often lowercase acronym) or `extradata`.
- **Players/Roster** : NOT included in the team endpoint. Must be fetched separately via `/v3/squadplayer` with `[[pagename::TeamPageName]]`.
- **Search limitation** : No native partial text search. Implementation strategy: fetch + filter in Go, or pre-cache popular teams.
- **Region mapping** : `region` field is directly available (unlike tournaments). Values: "Europe", "North America", "South America", "Korea", "China", "Southeast Asia", "Oceania", etc.
- **Deduplication** : API may return duplicates — use `pageid` or `objectname` as dedup key.
- **Cross-wiki** : The `template` field links the same org across different game wikis (e.g. "fnatic" in valorant wiki = "fnatic" in lol wiki).
