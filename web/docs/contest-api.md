# Contest agent API

Organizer-facing GW decision endpoint for FALEAGUE-managed contest teams.

## Endpoint

```
POST /api/contest/v1/decide
Authorization: Bearer <CONTEST_API_KEY>
Content-Type: application/json
```

Health / contract:

```
GET /api/contest/v1/decide
Authorization: Bearer <CONTEST_API_KEY>
```

## Env

```
CONTEST_API_KEY=long-random-secret
# optional extras:
CONTEST_API_KEYS=key2,key3
```

## Request

```json
{
  "gw": 1,
  "bank": 0.0,
  "freeTransfers": 0,
  "chipsRemaining": ["3xc", "bboost", "wildcard", "freehit"],
  "squad": [
    { "fpl_id": 123, "sell_price": 4.5 }
  ],
  "horizon": 5,
  "allowHits": false,
  "autoPlayChips": false,
  "riskMode": "neutral",
  "minCandidateMinutes": 900
}
```

`squad` must be **exactly 15 unique** FPL element ids (legal 2/5/5/3 + max 3 per club).

## Response (v1)

- `algorithmVersion` — pin this in contests (`contest-v1.0.0`)
- `transfers[]` — 0–2 moves (hits only if `allowHits`)
- `startingXi[]` / `benchOrder[]`
- `captain` / `vice`
- `chip` — `3xc` | `bboost` | `null` (only if `autoPlayChips: true`; WC/FH notes only)
- `chip_notes` — always includes timing advice
- `rationale` / `xpSummary`

## Limits (v1)

- Deterministic (no LLM)
- Max 2 transfers per call
- Chips default to **advice only** (`autoPlayChips: false`)
- Free Hit / Wildcard never auto-activated
- Organizer applies picks; this API does not write to fantasy.premierleague.com

## Local smoke test

```bash
cd web
npx tsx scripts/contest-decide-self-test.ts
```
