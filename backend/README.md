# Wavelore Audio — Pricing API

Plan catalogue and stub checkout sessions for the Wavelore Audio pricing page, built on Node.js 22 and Hono.
It also serves `../frontend` at `/`, so the page and the API run from one origin. `CONTRACT.md` has the full contract.

- Run: `npm install && npm start` (listens on `PORT`, default 3000)
- Test: `npm test`
- Config: `ALLOWED_ORIGIN` enables CORS for exactly that origin. Set `TRUST_PROXY=false` when no reverse proxy
  sets `X-Forwarded-For`; the rate limiter then keys clients by socket address.

| Endpoint | Purpose |
|---|---|
| `GET /api/plans` | Live prices in cents per interval, plus the yearly savings percentage (cacheable for 5 min) |
| `POST /api/checkout-session` | `{ planId, interval }` → in-memory checkout session, valid for 30 min (10 requests per IP per minute) |
