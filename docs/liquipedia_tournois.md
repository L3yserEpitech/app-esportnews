# Documentation Tournaments v3 — Liquipedia API

## Endpoint

- **URL** : `https://api.liquipedia.net/api/v3/tournament`
- **Method** : `GET`
- **Description** : Get information from the tournament table.

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
| `pageid` | number | Page ID on Liquipedia |
| `pagename` | string | Full page name (e.g. `VCT_2025/Champions`) |
| `namespace` | number | Namespace (0 = main content) |
| `objectname` | string | Object identifier (unique per tournament) |
| `name` | string | Full tournament name (e.g. "VCT 2025: Champions Los Angeles") |
| `shortname` | string | Short tournament name for display |
| `tickername` | string | Ticker display name |
| `banner` | string | Banner image filename (light) |
| `bannerurl` | string | Full URL for banner image (light) |
| `bannerdark` | string | Banner image filename (dark) |
| `bannerdarkurl` | string | Full URL for banner image (dark) |
| `icon` | string | Icon filename (light) |
| `iconurl` | string | Full URL for icon (light) |
| `icondark` | string | Icon filename (dark) |
| `icondarkurl` | string | Full URL for icon (dark) |
| `seriespage` | string | Parent series page name (e.g. "VCT") |
| `serieslist` | json | List of related series |
| `previous` | string | Previous iteration page name |
| `previous2` | string | Alternative previous iteration |
| `next` | string | Next iteration page name |
| `next2` | string | Alternative next iteration |
| `game` | string | Game identifier (e.g. "valorant") |
| `mode` | string | Game mode |
| `patch` | string | Starting game patch version |
| `endpatch` | string | Ending game patch version |
| `type` | string | Tournament type/format (e.g. "Online", "Offline", "Online/Offline") |
| `organizers` | string | Organizer names |
| `startdate` | date | Start date (YYYY-MM-DD) |
| `enddate` | date | End date (YYYY-MM-DD) |
| `sortdate` | date | Sort date for ordering |
| `locations` | json | Tournament locations (cities, countries, venues) |
| `prizepool` | number | Prize pool amount in USD (numeric, e.g. 1000000) |
| `participantsnumber` | number | Number of participants/teams |
| `liquipediatier` | string | Liquipedia tier level (1, 2, 3, 4, 5, or "-1" for Misc) |
| `liquipediatiertype` | string | Tier type qualifier (e.g. "Qualifier", "Showmatch", "Monthly", "Weekly") |
| `publishertier` | string | Publisher-assigned tier (game-specific) |
| `status` | string | Tournament status |
| `maps` | string | Maps played in the tournament |
| `format` | string | Tournament format description |
| `sponsors` | string | Tournament sponsors |
| `extradata` | json | Additional tournament metadata |

## Status Values

The `status` field can have the following values for tournaments:

| Status | Description | Our mapping |
|--------|-------------|-------------|
| (empty/null) | Tournament has not started yet (startdate in the future) | `upcoming` |
| `finished` | Tournament is completed | `finished` |
| (active) | Tournament is ongoing (startdate <= today <= enddate, not finished) | `running` |

**Note** : Unlike matches, tournaments don't always have a clear `status` field. The effective status is determined by:
- If `status == "finished"` → `finished`
- If `startdate <= today AND enddate >= today AND status != "finished"` → `running`
- If `startdate > today` → `upcoming`

## Liquipedia Tier Mapping

Liquipedia uses numeric tiers (1-5) while our frontend expects letter tiers (s, a, b, c, d):

| Liquipedia `liquipediatier` | Our `tier` | Description |
|-----------------------------|-----------|-------------|
| `1` | `s` | Premier / S-Tier (Majors, World Championships) |
| `2` | `a` | Major / A-Tier (International LANs) |
| `3` | `b` | Notable / B-Tier (Regional LANs, big online) |
| `4` | `c` | Minor / C-Tier (Smaller tournaments) |
| `5` | `d` | Basic / D-Tier (Small/community tournaments) |
| `-1` | `d` | Miscellaneous (Showmatches, etc.) |

The `liquipediatiertype` field provides additional context:
- `"Qualifier"` — Qualifier for a larger tournament
- `"Showmatch"` — Exhibition match/tournament
- `"Monthly"` — Monthly recurring tournament
- `"Weekly"` — Weekly recurring tournament

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

**Tournaments running (currently active):**
```
conditions=[[status::!finished]] AND [[startdate::<TODAY]] AND [[enddate::>TODAY]]
```

**Tournaments upcoming (not started):**
```
conditions=[[status::!finished]] AND [[startdate::>TODAY]]
```

**Tournaments finished (completed):**
```
conditions=[[status::finished]]
order=enddate DESC
```

**Tournaments by date range:**
```
conditions=[[startdate::<2025-03-01]] AND [[enddate::>2025-02-21]]
```

**Filter by tier:**
```
conditions=[[liquipediatier::1]]
```

## HTTP Response Codes

| Code | Description |
|------|-------------|
| `200` | Successful call. Returns `{ "result": [ {} ] }` |
| `403` | Invalid API key. Returns `{ "error": [ "string" ] }` |
| `404` | Asking for data that does not exist. Returns `{ "error": [ "string" ] }` |
| `429` | Over API limit. Returns `{ "error": [ "string" ] }` |

## Example API Calls

```
GET https://api.liquipedia.net/api/v3/tournament?wiki=valorant&limit=50&conditions=[[status::!finished]] AND [[startdate::<2025-02-22]] AND [[enddate::>2025-02-22]]
Authorization: Apikey <token>
User-Agent: EsportNews/1.0 (contact@esportnews.fr)
Accept: application/json
```

```
GET https://api.liquipedia.net/api/v3/tournament?wiki=valorant&limit=50&conditions=[[status::finished]]&order=enddate DESC
Authorization: Apikey <token>
User-Agent: EsportNews/1.0 (contact@esportnews.fr)
Accept: application/json
```

## Notes for EsportNews Integration

- **Unique tournament identifier** : Use `pagename` as the unique key (also serves as the tournament ID for routes).
- **Deduplication** : API may return duplicates — use `objectname` or `pagename` as dedup key.
- **Prize pool** : Returned as a number (USD). Needs to be formatted as a string (e.g. `1000000` → `"$1,000,000"`).
- **Teams/Rosters** : The tournament API does NOT return team or roster data. These must be fetched separately or left empty in the normalized output.
- **Matches** : Tournament matches are NOT embedded. They can be cross-referenced via the match API using `[[tournament::PageName]]` conditions.
- **Images** : Use `iconurl` / `icondarkurl` for tournament logos. Use `bannerurl` / `bannerdarkurl` for tournament banners.
- **Region** : Not directly available. Can be inferred from `locations` JSON or `extradata`.
- **Winner** : Not directly available as a field. Can be inferred from `extradata` or by checking finished matches.
- **Status determination** : Must be computed from `status`, `startdate`, and `enddate` fields (see Status Values section above).
- **Pagination** : Liquipedia supports native `limit` and `offset` parameters — use them directly.
- **Sorting** : Use `order` parameter (e.g. `startdate ASC`, `enddate DESC`, `liquipediatier ASC`).
