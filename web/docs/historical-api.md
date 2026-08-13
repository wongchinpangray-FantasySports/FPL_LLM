# Historical data API (v1)

**Public docs (share this):** https://www.faleague-ai.com/docs/historical-api

Public / partner read API for FPL historical GW aggregates (≈2016/17–present).

Data sources: Fantasy Premier League + [vaastav/Fantasy-Premier-League](https://github.com/vaastav/Fantasy-Premier-League) backfill. Credit both when redistributing.

## Auth model (hybrid)

| Endpoint | Auth |
|----------|------|
| `GET /api/historical/v1` | Public |
| `GET /api/historical/v1/meta` | Public |
| `GET /api/historical/v1/suggest` | Public |
| `GET /api/historical/v1/stats` | Bearer |
| `GET /api/historical/v1/player` | Bearer |

```
Authorization: Bearer <HISTORICAL_API_KEY>
```

## Env

```
HISTORICAL_API_KEY=long-random-secret
# optional extras:
HISTORICAL_API_KEYS=key2,key3
```

Rate limits use Upstash when configured (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). Without Upstash, limits are skipped.

## Endpoints

### Contract

```
GET /api/historical/v1
```

Returns version, auth map, and ID semantics notes.

### Meta (public)

```
GET /api/historical/v1/meta
```

Response: `{ seasons, activeSeason, teams[], gwBounds }`.

### Suggest (public)

```
GET /api/historical/v1/suggest?q=haaland&season=2024&position=FWD&limit=12
```

Optional: `locale`, `teamId`. `limit` capped at 25.

### Stats (Bearer)

```
GET /api/historical/v1/stats?season=2024&gwFrom=1&gwTo=38&position=MID&sortBy=total_points&sortDir=desc&limit=50&offset=0
Authorization: Bearer <HISTORICAL_API_KEY>
```

Useful query params (same as the in-app historical table):

- `season` — year key (`2024`) or `ALL`
- `gwFrom` / `gwTo`
- `position` — `GKP` \| `DEF` \| `MID` \| `FWD`
- `teamId`
- `name` / `playerKey`
- `minMinutes` / `minAppearances`
- `sortBy` — `total_points`, `goals_scored`, `assists`, `expected_goals`, `expected_assists`, `clean_sheets`, `minutes`, `bonus`, `ict_index`, `bps`, `defensive_contribution`, `points_per90`, `appearances`
- `sortDir` — `asc` \| `desc`
- `limit` — max **100** on this API
- `offset`

### Player detail (Bearer)

```
GET /api/historical/v1/player?playerId=355&season=2024&gwFrom=1&gwTo=10
Authorization: Bearer <HISTORICAL_API_KEY>
```

Optional roster hints when IDs remapped: `webName`, `name`, `team`, `position`.

## ID semantics

`playerId` / `fpl_id` is **season-scoped**. The same numeric id can refer to different players in different seasons. Always pair with `season` (and prefer `web_name` / suggest keys for identity).

## curl examples

```bash
# Public meta
curl -sS "https://www.faleague-ai.com/api/historical/v1/meta" | head

# Suggest
curl -sS "https://www.faleague-ai.com/api/historical/v1/suggest?q=salah&season=2024"

# Partner stats
curl -sS \
  -H "Authorization: Bearer $HISTORICAL_API_KEY" \
  "https://www.faleague-ai.com/api/historical/v1/stats?season=2024&position=FWD&limit=20"

# Partner player detail
curl -sS \
  -H "Authorization: Bearer $HISTORICAL_API_KEY" \
  "https://www.faleague-ai.com/api/historical/v1/player?playerId=355&season=2024"
```

## Notes

- Header `X-Historical-API-Version: historical-v1.0.0` is set on all responses.
- Legacy UI routes under `/api/fpl/historical*` remain for the website; prefer `/api/historical/v1/*` for external integrations.
- No bulk dump endpoint in v1 (abuse risk). Paginate `stats` instead.
