# Documentation Matches v3 — Liquipedia API

## Endpoint

- **URL** : `https://api.liquipedia.net/api/v3/match`
- **Method** : `GET`
- **Description** : Get information from the match2 table.

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
| `rawstreams` | string | optional | If you want the raw stream data. Read the full documentation on how this correlates with `streamurls`. Available values: `true`, `false`. Default: `false`. | `true`, `false` |
| `streamurls` | string | optional | If you want to get stream urls to link to. Read the full documentation on how this correlates with `rawstreams`. Available values: `true`, `false`. Default: `false`. | `true`, `false` |

## Data Points

This API makes the following data points available:

| Field | Type | Description |
|-------|------|-------------|
| `pageid` | number | Page ID on Liquipedia |
| `pagename` | string | Full page name (e.g. `VCT_2025/Champions/Main_Event`) |
| `namespace` | number | Namespace (0 = main content) |
| `objectname` | string | Object identifier |
| `match2id` | string | Unique match ID within the bracket |
| `match2bracketid` | string | Bracket identifier |
| `status` | string | Match status |
| `winner` | string | Winner identifier |
| `walkover` | string | Walkover status |
| `resulttype` | string | Result type |
| `finished` | boolean | Whether the match is finished |
| `mode` | string | Game mode |
| `type` | string | Match type |
| `section` | string | Section/stage of tournament |
| `game` | string | Game identifier |
| `patch` | string | Game patch version |
| `links` | json | Related links |
| `bestof` | number | Best of N (e.g. 3 = BO3) |
| `date` | exactdate | Match date/time |
| `dateexact` | boolean | Whether the date is exact |
| `stream` | json | Stream information (format depends on `rawstreams`/`streamurls` params) |
| `vod` | string | VOD link |
| `tournament` | string | Tournament page name |
| `parent` | string | Parent tournament/event |
| `tickername` | string | Display name for ticker |
| `shortname` | string | Short tournament name |
| `series` | string | Series name |
| `icon` | string | Tournament icon (light) |
| `iconurl` | string | Full URL for tournament icon (light) |
| `icondark` | string | Tournament icon (dark) |
| `icondarkurl` | string | Full URL for tournament icon (dark) |
| `liquipediatier` | string | Liquipedia tier (1-5) |
| `liquipediatiertype` | string | Tier type (e.g. "Qualifier", "Showmatch") |
| `publishertier` | string | Publisher-assigned tier |
| `extradata` | json | Additional match data |
| `match2bracketdata` | json | Bracket metadata |
| `match2games` | json | Individual games/maps within the match |
| `match2opponents` | json | Opponents (teams/players) with scores and details |

## Stream Parameters

Streams are by default returned as Liquipedia Stream names. This behaviour can be modified with the `rawstreams` and `streamurls` parameters, which can be supplied as GET parameters in the url.

| `streamurls` | `rawstreams` | Result |
|-------------|-------------|--------|
| `false` | `false` | Liquipedia stream names (default) |
| `true` | `false` | Links to Liquipedia stream pages |
| `false` | `true` | Stream provider stream IDs (useful for embedding) |
| `true` | `true` | Links to the streaming provider's page (only available for supported providers) |

**Supported streaming providers** (for `streamurls=true` + `rawstreams=true`):
- Afreeca TV
- Bilibili
- BOOYAH!
- CC
- Douyu TV
- Facebook
- huya.com
- Mildom
- Trovo
- Twitch

## HTTP Response Codes

| Code | Description |
|------|-------------|
| `200` | Successful call. Returns `{ "result": [ {} ] }` |
| `403` | Invalid API key. Returns `{ "error": [ "string" ] }` |
| `404` | Asking for data that does not exist. Returns `{ "error": [ "string" ] }` |
| `429` | Over API limit. Returns `{ "error": [ "string" ] }` |

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

**Matches running (live):**
```
conditions=[[finished::false]] AND [[date::>2025-01-01]]
```

**Matches upcoming:**
```
conditions=[[finished::false]] AND [[dateexact::true]] AND [[date::>NOW]]
```

**Matches past (finished):**
```
conditions=[[finished::true]]
order=date DESC
```

**Matches by date:**
```
conditions=[[date::>2025-02-21 00:00:00]] AND [[date::<2025-02-22 00:00:00]]
```

## Example API Calls

```
GET https://api.liquipedia.net/api/v3/match?wiki=valorant&limit=50&conditions=[[finished::false]]&rawstreams=true&streamurls=true
Authorization: Apikey <token>
User-Agent: EsportNews/1.0 (contact@esportnews.fr)
Accept: application/json
```

## Notes for EsportNews Integration

- **Unique match identifier** : Combine `pagename` + `match2id` for a unique key (or use `objectname`)
- **Opponents** : Found in `match2opponents` (JSON) — contains team names, scores, icons
- **Games/maps** : Found in `match2games` (JSON) — individual maps/rounds within a match
- **Streams** : Use `rawstreams=true&streamurls=true` to get direct provider URLs (Twitch, etc.)
- **Tournament context** : `tournament`, `parent`, `tickername`, `shortname`, `series`, `iconurl`, `icondarkurl`, `liquipediatier`
- **Deduplication** : API may return duplicates — use `groupby` or filter client-side by `objectname`
