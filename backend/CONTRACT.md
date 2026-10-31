# Wavelore Audio — Pricing API contract

Backend: Node.js 22 + Hono. All endpoints are JSON, served under `/api`. The frontend calls them with relative URLs
(`fetch('/api/...')`) and expects `Content-Type: application/json; charset=utf-8` on every response, including errors.
The example responses below are exactly what `demo.json` mocks; tests assert the same status and body shape.

## Plan catalogue (single source of truth)

| id | recommended | monthly (cents) | yearly (cents) |
|---|---|---|---|
| `solo` | false | 1900 | 18000 |
| `network` | true | 4900 | 46800 |
| `studio` | false | 12900 | 123600 |

Currency is always `USD`. `yearlySavingsPercent` is 20: the marketing figure, computed as
`floor((1 - yearly / (monthly * 12)) * 100)` for the recommended plan.

Keep the catalogue in one module (e.g. `src/plans.js`) that both endpoints import, so prices cannot drift.

---

## GET /api/plans

Purpose: the page renders list prices from the HTML, then replaces them with live prices from this endpoint.
Prices are integers in cents per billing interval.

Request: no body. Header `Accept: application/json` (optional).

### 200 OK

```json
{
  "currency": "USD",
  "yearlySavingsPercent": 20,
  "plans": [
    { "id": "solo", "recommended": false, "prices": { "monthly": 1900, "yearly": 18000 } },
    { "id": "network", "recommended": true, "prices": { "monthly": 4900, "yearly": 46800 } },
    { "id": "studio", "recommended": false, "prices": { "monthly": 12900, "yearly": 123600 } }
  ]
}
```

Field types: `currency` string (ISO 4217), `yearlySavingsPercent` integer 0–100, `plans[]` array of exactly these three
objects in this order; `id` string, `recommended` boolean, `prices.monthly` and `prices.yearly` positive integers.

Add `Cache-Control: public, max-age=300`. No other status is expected; the UI treats any non-2xx or a network
failure as "live prices unavailable" and keeps the list prices.

---

## POST /api/checkout-session

Purpose: validate a plan + interval and return a stub checkout session (no real payment provider). The UI shows
`message`, the formatted `amountCents` and the `expiresAt` time, and turns the plan's button into a link to
`checkoutUrl`. `sessionId` is not displayed; it is there for the payment page and for support.

Request headers: `Content-Type: application/json` (required; otherwise 415 with the error body below).

Request body:

| field | type | constraints |
|---|---|---|
| `planId` | string | required; one of `solo`, `network`, `studio` |
| `interval` | string | required; `monthly` or `yearly` |

Unknown fields are ignored. Body size limit 2 KB (413 with the error body below when exceeded; also reject
non-object JSON with 400).

### 201 Created

```json
{
  "ok": true,
  "sessionId": "cs_wl_9k2fd7qa",
  "planId": "network",
  "interval": "yearly",
  "amountCents": 46800,
  "currency": "USD",
  "expiresAt": "2026-10-02T10:30:00.000Z",
  "checkoutUrl": "/checkout/cs_wl_9k2fd7qa",
  "message": "Nothing is charged until your 14 free days end."
}
```

- `sessionId`: `cs_wl_` followed by 8 lowercase base-36 characters, generated per request (`crypto.randomBytes`
  or `randomUUID` based). Tests assert the pattern `^cs_wl_[a-z0-9]{8}$`, not the exact value.
- `amountCents`: the catalogue price for `planId` × `interval` (46800 for network/yearly).
- `expiresAt`: ISO 8601 UTC timestamp, 30 minutes after creation. Tests assert it parses and lies in the future.
- `checkoutUrl`: same-origin path `/checkout/{sessionId}` (a relative path starting with a single `/`; the UI
  rejects anything else). Tests assert it equals `"/checkout/" + sessionId`. The route itself is out of scope for
  this API; it may 404 in development.
- `message`: the exact string above for every successful request.

### 400 Bad Request (validation)

```json
{
  "ok": false,
  "error": "validation",
  "message": "Choose a plan and a billing interval to continue.",
  "details": [
    { "field": "planId", "message": "planId must be one of solo, network, studio" },
    { "field": "interval", "message": "interval must be monthly or yearly" }
  ]
}
```

`details` lists only the failing fields. The same shape (with a single detail) is used for malformed JSON
(`field: "body"`).

### 415 / 413

Same shape as 400 with `"error": "unsupported_media_type"` or `"error": "payload_too_large"` and a human message.

### 429 Too Many Requests (rate limit)

```json
{
  "ok": false,
  "error": "rate_limited",
  "message": "Too many checkout attempts. Please wait a minute and try again.",
  "retryAfterSeconds": 60
}
```

Also send a `Retry-After: 60` header. Limit: 10 checkout sessions per IP per minute (in-memory sliding window keyed
by `x-forwarded-for` first hop, falling back to the socket address).

### 404 Not Found

Any other `/api/*` path → `{ "ok": false, "error": "not_found", "message": "No such endpoint." }`.

The UI renders `message` from any non-2xx JSON body in its live status region; if the body is not JSON, it shows
its own generic error copy, so every error response must still be JSON.

---

## Protections

- Validation as above; `planId`/`interval` are trimmed strings, compared exactly (case-sensitive), max 32 chars.
- Rate limit per IP on `POST /api/checkout-session` (10/min). `GET /api/plans` is unlimited but cacheable.
- Body size limit 2 KB; reject before parsing.
- Responses never echo raw request input: `planId` and `interval` in the 201 body are the validated catalogue
  values, never the client's string.
- Security headers on every response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Cache-Control: no-store` on POST responses.
- CORS: same-origin only by default. If `ALLOWED_ORIGIN` is set, allow exactly that origin for `GET, POST` with
  `Content-Type` and handle `OPTIONS` preflight; otherwise send no CORS headers.
- Static files: serve `../frontend` at `/` so the page and the API share an origin in local development.
- No honeypot (there is no free-text form).

## Example (matches demo.json)

```http
POST /api/checkout-session HTTP/1.1
Content-Type: application/json

{ "planId": "network", "interval": "yearly" }
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Cache-Control: no-store

{
  "ok": true,
  "sessionId": "cs_wl_9k2fd7qa",
  "planId": "network",
  "interval": "yearly",
  "amountCents": 46800,
  "currency": "USD",
  "expiresAt": "2026-10-02T10:30:00.000Z",
  "checkoutUrl": "/checkout/cs_wl_9k2fd7qa",
  "message": "Nothing is charged until your 14 free days end."
}
```
