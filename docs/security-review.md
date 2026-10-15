# Security review and load test

Review of the Nem Mail API (`apps/api`) and its live deployment against the OWASP Top 10 (2021), done on 2026-10-15 for v2.0. Live checks ran against `https://nem-mail-api.onrender.com/api/v1`.

## Finding fixed in this review

**Rate limiting did nothing in production.** Render serves the API through Cloudflare, and every request reached the app from a different edge IP. The limiter keyed its buckets on that address, so each request got a fresh bucket: `RateLimit-Remaining` stayed at 119, and 12 wrong passwords in a row all came back 401 instead of being throttled after 10.

Fix: the limiter now keys on `CF-Connecting-IP` (`nem.rate-limit.client-ip-header`, env `CLIENT_IP_HEADER`). Cloudflare overwrites that header, so a client cannot fake it. Without the header it falls back to the remote address as before. `ApiInfrastructureTest` covers one client arriving from changing edge IPs. If the API moves to a host without Cloudflare, `CLIENT_IP_HEADER` must be set to blank or to that host's header.

## OWASP Top 10 checklist

| Risk                            | Status | How the API handles it                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 Broken access control       | Pass   | Every query is scoped to the signed-in user id. Another user's thread, draft or attachment is a 404, not a 403, so ids leak nothing (`ThreadGetTest`, `DraftTest`, `AttachmentTest`). Everything but sign-in, sign-up, health and the OpenAPI spec needs a bearer token. The demo reset needs a separate key, compared in constant time. |
| A02 Cryptographic failures      | Pass   | Passwords hashed with Argon2id. Session tokens are 32 random bytes; only their SHA-256 is stored. HTTPS only, with HSTS on the live API. Database over TLS (`sslmode=require`).                                                                                                                                                          |
| A03 Injection                   | Pass   | JPA and named parameters throughout, no SQL built from input. The search query parser turns operators into bound clauses. Mail HTML is reduced to text on the server and sanitized again in the app before it renders.                                                                                                                   |
| A04 Insecure design             | Pass   | Rate limits per client IP: 120 requests a minute for the API, 10 for sign-in and sign-up (fixed above). Production has no SMTP host, so the public demo account cannot send mail outside Nem Mail. Demo data resets every night.                                                                                                         |
| A05 Security misconfiguration   | Pass   | Strict CORS allowlist (a foreign origin gets 403 and no `Access-Control-Allow-Origin`). Headers: CSP `default-src 'none'`, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, `Cache-Control: no-store`. Only the health actuator is exposed (`/env` is 401). Errors use one envelope with no stack traces.                              |
| A06 Vulnerable components       | Pass   | `npm audit --omit=dev`: 0 vulnerabilities. Java dependencies are current releases (Spring Boot 4.1, Bouncy Castle 1.86) and Dependabot (`.github/dependabot.yml`) opens monthly update PRs for npm, Gradle and the workflows.                                                                                                            |
| A07 Authentication failures     | Pass   | One message for a wrong password and an unknown email, and an unknown email still runs a hash, so timing does not reveal accounts. Passwords 8 to 128 characters. Sessions expire 30 days after last use; sign-out revokes only that session.                                                                                            |
| A08 Data integrity failures     | Pass   | No deserialization of untyped input: request bodies bind to validated records. Uploads must match their declared type's magic bytes, and downloads are always `Content-Disposition: attachment`.                                                                                                                                         |
| A09 Logging and monitoring      | Pass   | JSON logs (ECS) with a request id on every line and response. Tokens and passwords are never logged. The keep-warm workflow emails the owner when health checks fail.                                                                                                                                                                    |
| A10 Server-side request forgery | Pass   | The API fetches no user-supplied URLs. Ollama and the embedding model URLs come from configuration only.                                                                                                                                                                                                                                 |

## Live probes

| Probe                                    | Result                                 |
| ---------------------------------------- | -------------------------------------- |
| `GET /threads` without a token           | 401 with the security headers and HSTS |
| A forged 32-byte token on `/me`          | 401                                    |
| Preflight from `https://evil.example`    | 403, no `Access-Control-Allow-Origin`  |
| `GET /env` (actuator)                    | 401                                    |
| `POST /admin/demo/reset` without the key | 401                                    |

## Load test

`node apps/api/scripts/load-test.mjs` signs in to the demo account and sends the reads the app makes on open (inbox, counts, labels, a thread, search) at a set concurrency, then checks that repeated wrong passwords are throttled. The default 100 requests stay under the 120 a minute one IP may send.

Against the live API (Render free, 0.1 CPU and 512 MB, Neon free in the same region), 100 requests at concurrency 10:

| Metric     | Result                                         |
| ---------- | ---------------------------------------------- |
| Throughput | 12.6 requests a second                         |
| Latency    | p50 699 ms, p95 1493 ms, p99 2118 ms           |
| Errors     | none (100 × 200)                               |
| Slowest    | inbox list and search, p50 about 850 to 900 ms |

The free instance is the limit: one shared CPU serves every request. That is fine for a portfolio demo. A paid instance or caching the inbox list would be the first steps if traffic grew.
