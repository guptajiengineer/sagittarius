# System Design — Sagittarius
**Version:** 1.0 (Stage 1)
**Status:** Draft
**PRD Version referenced:** 1.0 (Stage 1)
**Last Updated:** 2026-04-10
**Author:** Engineering Team

> Every design decision in this document maps to a PRD requirement ID. This is intentional. If a decision has no PRD anchor, it should not be in this document.

---

## 1. Design Goals (derived from PRD NFRs)

| Goal | PRD Source | Engineering Target |
|---|---|---|
| Scan queued < 2s | NFR Performance | API endpoint returns scan_id in < 2s; job enqueued synchronously before response |
| Scan completes < 3 min (simple) | NFR Performance | Parallel API phase < 90s; series phase < 60s; LLM summary < 30s |
| API p95 < 300ms | NFR Performance | Applies to all endpoints except scan submission (which is async by design) |
| Support 5 concurrent scans | NFR Scalability Stage 1 | 5 worker processes; queue depth handles burst |
| Scale to 10K/day without code changes | NFR Scalability Stage 2 | Horizontal worker scaling + managed queue |
| 99% uptime | NFR Reliability | Single region acceptable at Stage 1 scale |
| At-least-once scan delivery | NFR Reliability | Queue-backed jobs with retry; no fire-and-forget HTTP calls |
| Zero data loss on complete scans | NFR Reliability | DB write before job ACK |
| Consent immutability | FR-008 | Append-only consent_log table; no UPDATE/DELETE allowed via ORM |

### Capacity Estimation — Stage 1

```
DAU (scans):        10 scans/day
Reads per scan:     ~8 (status polling + result fetch)
Writes per scan:    ~3 (create + module results + final report)

Read QPS:           10 × 8 / 86400 = 0.001 RPS (negligible)
Write QPS:          10 × 3 / 86400 = 0.0003 RPS (negligible)
Peak (3x):          ~0.003 RPS read, ~0.001 RPS write

Storage per scan:   ~80 KB (raw JSON from all APIs + report)
Storage / month:    10/day × 30 × 80KB = ~24 MB/month
Storage / year:     ~288 MB

External API calls: ~12 API calls per scan × 10 scans/day = 120 external calls/day
```

**Stage 1 conclusion:** Infrastructure is trivially small. Design decisions are made for Stage 2 correctness (10K scans/day), not Stage 1 load. Free tiers are sufficient.

### Capacity Estimation — Stage 2 (design for this)

```
DAU (scans):        10,000 scans/day
Read QPS:           ~0.93 RPS average, ~3 RPS peak
Write QPS:          ~0.35 RPS average, ~1 RPS peak
Concurrent scans:   ~7 at any moment (10K / 86400 × 60s scan duration)
External API calls: 120,000/day → hits VirusTotal free rate limit (240/day free)
                    → Paid API tier required at Stage 2
Storage / month:    10K × 80KB × 30 = ~24 GB/month
Storage / year:     ~288 GB (within Postgres range without partitioning)
```

---

## 2. High-Level Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              Vercel CDN                  │
                    │         (static assets, edge)           │
                    └──────────────────┬──────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────┐
                    │           Next.js Application            │
                    │   Landing Page + Dashboard + API Routes  │
                    │              (Vercel)                    │
                    └──────────────────┬──────────────────────┘
                                       │ API Routes (/api/v1/*)
                    ┌──────────────────▼──────────────────────┐
                    │            API Service                   │
                    │     Auth • Scan Submit • Results         │
                    │           (Node.js / Fastify)            │
                    └──────┬──────────────────┬───────────────┘
                           │                  │
            ┌──────────────▼───┐    ┌─────────▼──────────────┐
            │   PostgreSQL     │    │     Redis (BullMQ)      │
            │  (Supabase free) │    │   (Upstash free tier)   │
            │  Primary DB      │    │   Job Queue             │
            └──────────────────┘    └─────────┬──────────────┘
                                              │
                    ┌─────────────────────────▼───────────────┐
                    │              Worker Service              │
                    │    Orchestrator • Module Runner          │
                    │           (Node.js / BullMQ)             │
                    └──┬──────┬──────┬──────┬──────┬──────────┘
                       │      │      │      │      │
              Parallel execution (Promise.all):
                       │      │      │      │      │
              ┌────────▼─┐ ┌──▼───┐ ┌▼──┐ ┌▼──┐ ┌▼──────────┐
              │SSL Labs  │ │VT API│ │GSB│ │MX │ │URLScan    │
              │API       │ │      │ │   │ │TB │ │           │
              └──────────┘ └──────┘ └───┘ └───┘ └───────────┘
              ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
              │SecHdrs │ │HIBP    │ │crt.sh  │ │Shodan      │
              └────────┘ └────────┘ └────────┘ └────────────┘
                                       │
                              (Series: after crt.sh)
                                       │
                              ┌────────▼────────┐
                              │ Subdomain scans │
                              │ (for each found)│
                              └────────┬────────┘
                                       │
                    ┌──────────────────▼──────────────────────┐
                    │              Aggregator                  │
                    │   Normalize → Score → DPDP Map           │
                    └──────────────────┬──────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────┐
                    │           Claude API                     │
                    │     Plain-English Summary (LLM)          │
                    └──────────────────┬──────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────┐
                    │     Write complete report to DB          │
                    │     Update scan status → complete        │
                    └─────────────────────────────────────────┘
```

### Component Descriptions

| Component | Responsibility |
|---|---|
| **Next.js Application** | Serves landing page (SSG), dashboard (SSR/CSR), and all `/api/v1/*` API routes. Single deployment on Vercel. |
| **Vercel CDN** | Caches static assets globally; edge delivers landing page; not involved in API routes |
| **PostgreSQL (Supabase)** | Primary data store for users, API keys, scans, findings, consent logs. Single source of truth. |
| **Redis / BullMQ (Upstash)** | Job queue for scan orchestration. Decouples API request from scan execution. Enables retry and concurrency control. |
| **Worker Service** | Long-running Node.js process consuming from BullMQ queue. Spawns scan orchestration for each job. Runs separately from API. |
| **Scan Modules** | Individual async functions, one per external API. Stateless. Return normalized Finding objects. |
| **Aggregator** | Merges all module outputs. Calculates severity score. Maps to DPDP sections. |
| **Claude API** | Single call per scan. Receives aggregated findings as JSON. Returns plain-English summary. |

---

## 3. Technology Stack

| Layer | Choice | Why | Tradeoff |
|---|---|---|---|
| **Frontend framework** | Next.js 14 (App Router) | Landing page (SSG for SEO) + dashboard (SSR) + API routes — all in one deployment; strong TypeScript support | More complex than Vite SPA; App Router learning curve |
| **Backend runtime** | Node.js 20 LTS + TypeScript | Native async/await is ideal for orchestrating 12+ concurrent API calls; same language as frontend; huge ecosystem | Not optimal for CPU-heavy workloads (not relevant for Stage 1) |
| **API framework** | Fastify (for Worker) + Next.js API Routes (for web-facing API) | Fastify is 3× faster than Express for worker-internal APIs; Next.js API routes collocate with frontend for simplicity | Two different API patterns — documented clearly to avoid confusion |
| **ORM** | Prisma | Type-safe DB queries; excellent migration tooling; generates TypeScript types from schema | Slightly slower than raw queries; acceptable at Stage 1 scale |
| **Primary database** | PostgreSQL 15 (Supabase free) | ACID guarantees for consent records; relational model fits data perfectly; excellent Prisma support | Not ideal for massive time-series data (not relevant until Stage 4) |
| **Job queue** | BullMQ + Redis | Battle-tested queue for Node.js; retry logic built in; concurrency control; UI dashboard available | Requires Redis; Upstash free tier has 10K commands/day limit (sufficient for Stage 1) |
| **Redis hosting** | Upstash (free tier) | Serverless Redis; 10K commands/day free; no persistent connection management needed | 10K/day limit hit at ~800 scans/day → upgrade to paid at Stage 2 |
| **Auth** | Custom JWT (jsonwebtoken) + httpOnly cookies | Full control; no third-party dependency for auth at this stage; simpler to debug | More code to write than Auth0/Clerk; acceptable for a security product (dogfooding your own principles) |
| **Email** | Resend (free tier: 3K emails/month) | Simple API; React Email for templates; generous free tier | 3K/month limit; upgrade at Stage 2 |
| **LLM (summarization)** | Anthropic Claude claude-haiku-4-5 | Cheapest Claude model; ~$0.01 per scan summary; fastest response time | Not the most capable model; sufficient for summarization, not reasoning |
| **Frontend styling** | Tailwind CSS | Fastest iteration for a solo developer; no design system maintenance burden | Utility class verbosity; acceptable |
| **CI/CD** | GitHub Actions | Free for public repos; free 2000 min/month for private; integrates with Vercel | Limited parallelism on free tier |
| **Hosting (API/Worker)** | Railway (free tier → Starter) | One-click Node.js + worker deployment; managed env vars; easy to upgrade | Free tier sleeps after inactivity — acceptable for Stage 1 |
| **Hosting (Frontend)** | Vercel (Hobby) | Optimal for Next.js; global CDN; automatic preview deployments | Hobby tier limits: 100GB bandwidth/month; fine for Stage 1 |
| **Observability** | Axiom (free tier: 50GB/month) | Structured log ingestion; excellent DX; free tier sufficient | Less mature than Datadog; acceptable for Stage 1 |

---

## 4. Data Model

### Entity: User
- **Purpose:** Represents a registered Sagittarius account
- **Key fields:**
  - `id: UUID` — primary key
  - `email: String` — unique, indexed
  - `password_hash: String` — bcrypt, 12 rounds
  - `email_verified: Boolean` — default false
  - `email_verified_at: Timestamp?`
  - `created_at: Timestamp`
  - `updated_at: Timestamp`
- **Relationships:** has many ApiKeys, has many Scans
- **Indexing:** PK on id; UNIQUE on email
- **Estimated row size:** ~200 bytes
- **Growth rate:** ~5 rows/day Stage 1; ~100 rows/day Stage 2

### Entity: ApiKey
- **Purpose:** API key credential for programmatic access (FR-005)
- **Key fields:**
  - `id: UUID` — primary key
  - `user_id: UUID` — FK → User, indexed
  - `name: String` — user-defined label
  - `key_hash: String` — SHA-256 of the actual key; actual key shown once at creation, never stored
  - `key_prefix: String` — first 8 chars of actual key (e.g. `vgl_abc1`) for display in dashboard
  - `is_active: Boolean` — default true; set to false on revocation
  - `last_used_at: Timestamp?`
  - `created_at: Timestamp`
- **Relationships:** belongs to User; has many Scans (via user_id)
- **Indexing:** PK on id; INDEX on user_id; INDEX on key_hash (for auth lookup)
- **Estimated row size:** ~150 bytes
- **Growth rate:** ~2 rows/day Stage 1; ~50 rows/day Stage 2
- **Note:** Max 3 active keys per user enforced at application layer, not DB constraint

### Entity: Scan
- **Purpose:** Represents one scan job from submission to completion (FR-010, FR-029)
- **Key fields:**
  - `id: UUID` — primary key
  - `user_id: UUID` — FK → User, indexed
  - `target_url: String` — normalized URL (lowercase scheme + hostname + path)
  - `target_domain: String` — extracted hostname only (for subdomain grouping)
  - `status: Enum` — `queued | running | complete | failed`
  - `score: Integer?` — 0–100; null until complete
  - `subdomains_found: Integer?` — count from crt.sh
  - `started_at: Timestamp?`
  - `completed_at: Timestamp?`
  - `duration_ms: Integer?`
  - `error_message: String?` — populated on failure
  - `retry_count: Integer` — default 0; max 3
  - `created_at: Timestamp`
- **Relationships:** belongs to User; has one ConsentLog; has many Findings; has one ScanReport
- **Indexing:** PK on id; INDEX on user_id; INDEX on (user_id, created_at DESC) for history list; INDEX on status for worker queries
- **Estimated row size:** ~400 bytes
- **Growth rate:** ~10 rows/day Stage 1; ~10K rows/day Stage 2

### Entity: ConsentLog
- **Purpose:** Immutable legal record of user consent before each scan (FR-007, FR-008)
- **Key fields:**
  - `id: UUID` — primary key
  - `scan_id: UUID` — FK → Scan; UNIQUE (one consent per scan)
  - `user_id: UUID` — FK → User
  - `target_url: String` — the URL user consented to scan
  - `client_ip: String` — masked to /24 subnet for privacy (`192.168.1.x`)
  - `user_agent: String?`
  - `consented_at: Timestamp` — UTC
  - `consent_version: String` — version of the consent text shown (e.g. `v1.0`)
- **Relationships:** belongs to Scan; belongs to User
- **Indexing:** PK on id; UNIQUE on scan_id
- **Estimated row size:** ~300 bytes
- **Critical:** No UPDATE or DELETE operations ever executed on this table. Enforced via Prisma middleware that throws on any mutation after insert.

### Entity: Finding
- **Purpose:** One discrete security finding from any scan module (FR-025, FR-026, FR-027)
- **Key fields:**
  - `id: UUID` — primary key
  - `scan_id: UUID` — FK → Scan, indexed
  - `module: String` — source module name (e.g. `ssl_labs`, `security_headers`, `virustotal`)
  - `title: String` — short human-readable title (e.g. "SSL certificate expires in 12 days")
  - `description: String` — plain-English explanation of the finding
  - `severity: Enum` — `critical | high | medium | low | info`
  - `dpdp_section: String?` — e.g. `Section 8(4)` or null if no DPDP relevance
  - `dpdp_fine_range: String?` — e.g. `Up to ₹50 crore` or null
  - `dpdp_implication: String?` — plain-English legal implication or null
  - `recommendation: String` — specific remediation step
  - `raw_data: JSONB` — original API response that generated this finding; for auditability
  - `created_at: Timestamp`
- **Relationships:** belongs to Scan
- **Indexing:** PK on id; INDEX on scan_id; INDEX on (scan_id, severity) for filtering
- **Estimated row size:** ~1.5 KB (mostly raw_data JSONB)
- **Growth rate:** ~50–100 findings/scan → ~500 rows/day Stage 1; ~500K rows/day Stage 2

### Entity: ScanReport
- **Purpose:** The LLM-generated plain-English executive summary for a scan (FR-028)
- **Key fields:**
  - `id: UUID` — primary key
  - `scan_id: UUID` — FK → Scan; UNIQUE
  - `summary: Text` — 300–500 word plain-English summary from Claude
  - `llm_model: String` — model used (e.g. `claude-haiku-4-5-20251001`)
  - `llm_input_tokens: Integer` — for cost tracking
  - `llm_output_tokens: Integer` — for cost tracking
  - `llm_cost_usd: Decimal(10,6)` — computed from tokens
  - `created_at: Timestamp`
- **Relationships:** belongs to Scan (one-to-one)
- **Indexing:** PK on id; UNIQUE on scan_id
- **Estimated row size:** ~3 KB

### Entity: EmailVerificationToken
- **Purpose:** One-time token for email verification (FR-002)
- **Key fields:**
  - `id: UUID` — primary key
  - `user_id: UUID` — FK → User
  - `token_hash: String` — SHA-256 of the actual token
  - `expires_at: Timestamp` — 24 hours from creation
  - `used_at: Timestamp?` — set when consumed
- **Relationships:** belongs to User
- **Indexing:** PK on id; INDEX on token_hash; INDEX on user_id

### Entity: RefreshToken
- **Purpose:** Persistent session management (FR-003)
- **Key fields:**
  - `id: UUID` — primary key
  - `user_id: UUID` — FK → User
  - `token_hash: String` — SHA-256 of the actual refresh token
  - `expires_at: Timestamp` — 30 days from creation
  - `revoked_at: Timestamp?` — set on logout or rotation
  - `created_at: Timestamp`
- **Relationships:** belongs to User
- **Indexing:** PK on id; INDEX on token_hash; INDEX on user_id

### Entity Relationships Summary

User has many ApiKeys. User has many Scans. Scan has one ConsentLog. Scan has many Findings. Scan has one ScanReport. Scan belongs to one User. ConsentLog belongs to one Scan. Finding belongs to one Scan. ScanReport belongs to one Scan.

---

## 5. API Design

### Authentication Convention
- Dashboard routes: Bearer JWT in Authorization header OR JWT in httpOnly cookie
- API key routes: `Authorization: Bearer vgl_<key>` header
- All authenticated endpoints return 401 if credentials missing/invalid

### Versioning Strategy
- URL versioning: `/api/v1/` prefix on all endpoints
- Major breaking changes → new version prefix (`/api/v2/`)
- Old versions maintained for minimum 3 months after deprecation notice

### Rate Limiting
- Applied per API key: 10 scans / 24-hour rolling window (FR-033)
- Applied per IP for auth endpoints: 10 requests/minute
- Response on limit exceeded: `429 Too Many Requests` with `Retry-After: <seconds>` header

### Error Response Schema (consistent across all endpoints)
```json
{
  "error": "error_code_snake_case",
  "message": "Human-readable description",
  "fields": { "field_name": "specific issue" },
  "request_id": "uuid"
}
```

---

### Auth Resource

```
POST   /api/v1/auth/register        — Create account
POST   /api/v1/auth/login           — Authenticate, get tokens
POST   /api/v1/auth/logout          — Revoke refresh token
POST   /api/v1/auth/refresh         — Get new access token
POST   /api/v1/auth/verify-email    — Verify email with token
POST   /api/v1/auth/request-reset   — Request password reset email
POST   /api/v1/auth/reset-password  — Reset password with token
```

**POST /api/v1/auth/register**
```
Request:  { email: string, password: string }
201:      { user: { id, email, created_at } }
400:      { error: "validation_error", fields: { email: "invalid", password: "min 8 chars" } }
409:      { error: "email_already_registered" }
```

**POST /api/v1/auth/login**
```
Request:  { email: string, password: string }
200:      { access_token: string, expires_in: 900 }
          Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000
401:      { error: "invalid_credentials" }
403:      { error: "email_not_verified" }
```

---

### API Key Resource

```
GET    /api/v1/api-keys             — List user's API keys
POST   /api/v1/api-keys             — Create new API key
DELETE /api/v1/api-keys/:id         — Revoke API key
```

**POST /api/v1/api-keys**
```
Request:  { name: string }
201:      { id, name, key: "vgl_<full_key>", prefix: "vgl_abc1", created_at }
          NOTE: `key` is shown ONCE here and never again
400:      { error: "max_keys_reached", message: "Maximum 3 active API keys allowed" }
```

---

### Scan Resource

```
POST   /api/v1/scans                — Submit scan
GET    /api/v1/scans                — List user's scans (paginated)
GET    /api/v1/scans/:id            — Get scan result
GET    /api/v1/scans/:id/status     — Get scan status
```

**POST /api/v1/scans**
```
Request:  { url: string, consent: true }
202:      { scan_id: uuid, status: "queued", created_at: ISO8601 }
400:      { error: "invalid_url", message: "URL must be a valid http/https URL pointing to a public domain" }
400:      { error: "consent_required", message: "You must confirm you own or are authorized to scan this domain" }
400:      { error: "private_target", message: "Scanning private IP ranges is not permitted" }
429:      { error: "rate_limit_exceeded", message: "Daily scan limit reached", retry_after: seconds }
```

**GET /api/v1/scans** (paginated)
```
Query params: ?page=1&limit=20&status=complete
200: {
  scans: [{ id, target_url, target_domain, status, score, created_at, completed_at }],
  pagination: { page, limit, total, total_pages }
}
```

**GET /api/v1/scans/:id**
```
200 (complete): {
  scan: {
    id, target_url, target_domain, status, score, created_at, completed_at, duration_ms,
    findings: [{ id, module, title, description, severity, dpdp_section, dpdp_fine_range, recommendation }],
    report: { summary: string },
    subdomains_found: integer
  }
}
202 (running):  { scan_id, status: "running", progress_pct: integer }
202 (queued):   { scan_id, status: "queued" }
404:            { error: "scan_not_found" }
403:            { error: "forbidden" }
```

**GET /api/v1/scans/:id/status**
```
200: { scan_id, status, progress_pct, started_at, estimated_completion_at }
```

---

## 6. Authentication & Authorization Design

### Mechanism
- **Access tokens:** JWT (HS256), signed with `JWT_SECRET` env var. Payload: `{ sub: user_id, email, iat, exp }`. TTL: 15 minutes.
- **Refresh tokens:** Opaque random 32-byte token. Stored as SHA-256 hash in DB. TTL: 30 days. Delivered via httpOnly Secure cookie.
- **API keys:** Random 32-byte token with prefix `vgl_`. Delivered once at creation. Stored as SHA-256 hash. Auth lookup: hash incoming key → query DB.

### Token Storage
- **Access token:** Stored in memory (JavaScript variable) on the client. Never in localStorage (XSS risk). Never in a non-httpOnly cookie.
- **Refresh token:** httpOnly Secure SameSite=Strict cookie. Not accessible to JavaScript. XSS-safe.
- **API key:** User's responsibility. Shown once in dashboard. Treated like a password.

### Session Management
- Access token expires: client uses refresh token cookie to get new access token silently
- Refresh token expires: user must log in again
- Logout: refresh token revoked in DB; access token expires naturally (15 min max exposure)
- On password change: all refresh tokens for the user revoked

### Authorization Model
Stage 1 is simple: **resource ownership**. A user can only access their own scans, API keys, and reports. No roles, no teams, no RBAC — that's Stage 3+.

Rule: Every query for a protected resource includes `WHERE user_id = <authenticated_user_id>`. Never trust a resource ID from the URL alone.

### API Key Authorization
1. Extract Bearer token from Authorization header
2. Hash with SHA-256
3. Query: `SELECT user_id FROM api_keys WHERE key_hash = $1 AND is_active = true`
4. If found: attach user_id to request context; proceed
5. If not found: return 401 immediately

---

## 7. Critical User Flows

### Flow 1: User Registration (FR-001, FR-002)
```
1. User submits POST /api/v1/auth/register { email, password }
2. API validates: email format valid; password >= 8 chars
3. API checks: email not already registered (SELECT from users WHERE email = ?)
4. API hashes password: bcrypt(password, 12 rounds)
5. API inserts user: { email, password_hash, email_verified: false }
6. API generates email verification token: crypto.randomBytes(32).toString('hex')
7. API inserts EmailVerificationToken: { user_id, token_hash: sha256(token), expires_at: now+24h }
8. API queues email job: { to: email, template: 'verify-email', data: { token, user_id } }
9. API returns 201: { user: { id, email, created_at } }
10. Worker sends verification email via Resend
11. User clicks link → GET /verify-email?token=<token>
12. Frontend calls POST /api/v1/auth/verify-email { token }
13. API hashes token, queries DB, checks not expired and not used
14. API updates user: email_verified=true, email_verified_at=now
15. API updates token: used_at=now
16. API returns 200; frontend redirects to dashboard
```

### Flow 2: Scan Submission via API (FR-006 through FR-029)
```
1. Developer calls POST /api/v1/scans
   Headers: Authorization: Bearer vgl_<api_key>
   Body: { url: "https://merchant.com", consent: true }

2. API authenticates: hash key → lookup in api_keys table

3. API validates url:
   - Is valid URL format?
   - Is https:// or http://?
   - Is not a private IP, localhost, or RFC-1918 range?
   - Is not an IP address directly (require hostname)?

4. API validates consent: must be exactly boolean true

5. API checks rate limit:
   - COUNT scans for user_id in last 24 hours
   - If >= 10: return 429

6. API creates Scan record: { user_id, target_url, target_domain, status: 'queued' }

7. API creates ConsentLog record: { scan_id, user_id, target_url, client_ip, consented_at }
   (DB transaction: Scan + ConsentLog created atomically)

8. API enqueues BullMQ job: { scan_id, target_url, user_id }

9. API returns 202: { scan_id, status: "queued", created_at }

--- Worker picks up job ---

10. Worker updates scan: status='running', started_at=now

11. Worker runs PARALLEL phase (Promise.all):
    a. ssl_module(target_url)         → SSL Labs API
    b. headers_module(target_url)     → SecurityHeaders
    c. safe_browsing_module(url)      → Google Safe Browsing
    d. virustotal_module(domain)      → VirusTotal
    e. urlscan_module(url)            → URLScan.io
    f. hibp_module(domain)            → HaveIBeenPwned
    g. mxtoolbox_module(domain)       → MXToolbox API
    h. whois_module(domain)           → Whois XML
    i. shodan_module(domain)          → Shodan free
    j. securitytrails_module(domain)  → SecurityTrails
    k. cloudflare_radar_module(url)   → Cloudflare Radar

12. Worker runs SERIES phase:
    a. crt_module(domain)             → crt.sh (subdomain list)
    b. For each subdomain (max 10):
       → headers_module(subdomain)
       → shodan_module(subdomain)

13. Worker normalizes all outputs to Finding[] schema

14. Worker calculates score:
    score = 100
    - 25 per critical finding (min score: 0)
    - 15 per high finding
    - 8 per medium finding
    - 3 per low finding

15. Worker maps each finding to DPDP (static lookup table)

16. Worker inserts all Finding records in bulk

17. Worker calls Claude API:
    Input: { findings: Finding[], domain, score }
    System prompt: "You are a cybersecurity advisor writing for a non-technical Indian business owner..."
    Output: plain-English 300-500 word summary

18. Worker inserts ScanReport: { scan_id, summary, model, tokens, cost }

19. Worker updates Scan: { status: 'complete', score, completed_at, duration_ms }

20. Worker acknowledges job (BullMQ removes from queue)

--- Developer polls ---

21. GET /api/v1/scans/:id/status → { status: "complete", score: 67 }
22. GET /api/v1/scans/:id → full report JSON
```

### Flow 3: API Key Revocation (FR-006)
```
1. User calls DELETE /api/v1/api-keys/:id
2. API authenticates user (JWT)
3. API queries: SELECT * FROM api_keys WHERE id=? AND user_id=?
4. If not found or user_id mismatch: 404
5. API updates: SET is_active=false WHERE id=?
6. API clears key_hash lookup from Redis cache (if cached)
7. Returns 200 { message: "API key revoked" }
8. Any subsequent request with that key: auth fails at step 3 of API key auth flow
```

---

## 8. Caching Strategy

Stage 1 has negligible load. Caching is implemented for correctness patterns, not performance.

| What | Cache Key | TTL | Invalidation |
|---|---|---|---|
| API key → user_id lookup | `apikey:<key_hash>` | 5 minutes | Delete on revocation (FR-006) |
| Scan status | `scan:status:<scan_id>` | 30 seconds | Delete on status change |
| User profile | `user:<user_id>` | 10 minutes | Delete on profile update |

**Strategy:** Cache-aside (read-through). On cache miss: query DB, write to cache. On mutation: delete cache entry (not update). Simple, safe, no cache inconsistency risk.

**Note:** Scan results (findings, report) are NOT cached. They are immutable once written and read infrequently. Direct DB reads are acceptable at Stage 1 scale.

---

## 9. Async Processing & Queue Design

### Queue: `scan-jobs`

| Property | Value |
|---|---|
| Queue name | `scan-jobs` |
| Concurrency | 5 workers (Stage 1) |
| Max attempts | 3 |
| Backoff | Exponential: attempt 1 = 30s, attempt 2 = 120s, attempt 3 = 300s |
| Job TTL | 1 hour (if not processed, considered stale) |
| Stale job handling | Mark scan as `failed` with `error_message: "job_timeout"` |

### Job Payload
```json
{
  "scan_id": "uuid",
  "target_url": "https://merchant.com",
  "user_id": "uuid",
  "enqueued_at": "ISO8601"
}
```

### Idempotency
Each scan job is identified by `scan_id`. Before processing, worker checks:
```
SELECT status FROM scans WHERE id = scan_id
```
If status is already `complete` or `failed` (from a previous successful/failed attempt): skip, ACK job. This prevents double-processing on retry.

### Dead Letter Queue
After 3 failed attempts, BullMQ moves job to `scan-jobs:failed`. Worker process emits an error log. Scan record updated to `status=failed`. User sees "Scan failed — please try again" in dashboard. Manual review of DLQ happens daily in Stage 1.

### External API Failure Handling
Each module is wrapped in try/catch. If a module throws:
- Log the error with module name and scan_id
- Return an `info`-severity finding: `{ module, title: "<ModuleName> check unavailable", severity: "info" }`
- Do NOT fail the entire scan because one module is down
- This ensures partial results are always returned

---

## 10. Error Handling Strategy

### Error Taxonomy

| Class | HTTP Code | Log Level | Example |
|---|---|---|---|
| Input validation | 400 | WARN | Invalid URL format |
| Authentication | 401 | WARN | Invalid/expired token |
| Authorization | 403 | WARN | Accessing another user's scan |
| Not found | 404 | INFO | Scan ID doesn't exist |
| Rate limit | 429 | INFO | Daily scan limit hit |
| External API unavailable | (internal) | ERROR | VirusTotal timeout |
| Unexpected server error | 500 | ERROR | Unhandled exception |

### Error Response Format (all endpoints)
```json
{
  "error": "snake_case_error_code",
  "message": "Human-readable, non-technical description",
  "request_id": "uuid-for-tracing",
  "fields": {}
}
```

`fields` is present only for validation errors. It maps field names to error messages.

### Logging Convention
Every error log includes:
```json
{
  "level": "error",
  "timestamp": "ISO8601",
  "service": "api|worker",
  "request_id": "uuid",
  "user_id": "uuid|null",
  "scan_id": "uuid|null",
  "error_code": "string",
  "message": "string",
  "stack": "string (production: omitted from user response, logged)"
}
```

Stack traces are logged server-side but never returned to clients.

---

## 11. Security Design

### Input Validation
- All request bodies validated with `zod` schemas before any business logic executes
- URL validation: parse with `new URL()`, check protocol, check hostname not in private ranges
- Private range check: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, ::1, 0.0.0.0
- Max request body size: 10KB (prevents large payload attacks)

### SQL Injection Prevention
Prisma ORM with parameterized queries only. No raw SQL in Stage 1. If raw SQL is ever needed (Stage 2+), use `prisma.$queryRaw` with tagged template literals (automatically parameterized).

### XSS Prevention
- All user input HTML-escaped before rendering in Next.js components (React does this by default)
- Content-Security-Policy header set on all pages
- `dangerouslySetInnerHTML` is banned — enforced by ESLint rule

### CSRF Protection
- JWT auth for API: immune to CSRF (no automatic cookie sending for cross-origin)
- Session cookie: SameSite=Strict prevents cross-origin cookie sending
- State-changing actions require Authorization header (API) or SameSite cookie (dashboard)

### Secrets Management
- All secrets in environment variables
- `.env.example` committed; `.env.local` gitignored
- Secrets never logged; never returned in API responses
- Production secrets stored in Railway environment variables UI

### CORS Policy
```
Allowed origins: https://sagittarius.so (production), http://localhost:3000 (dev)
Allowed methods: GET, POST, DELETE, PATCH, OPTIONS
Allowed headers: Authorization, Content-Type
Credentials: true (for cookie-based auth)
```

### HTTPS
- Vercel enforces HTTPS automatically for frontend
- Railway enforces HTTPS for API
- HTTP → HTTPS redirect at platform level
- HSTS header: `max-age=31536000; includeSubDomains`

### PII Handling
- Email addresses found in HIBP breach results: masked to `f***@domain.com` before storage
- Client IPs in consent logs: masked to /24 subnet (`192.168.1.x`)
- No PII logged in application logs

---

## 12. Scalability & Bottlenecks

### What breaks first (Stage 1 → Stage 2 transition)

| Bottleneck | Breaks at | Mitigation |
|---|---|---|
| VirusTotal free tier (4 req/min) | ~240 scans/day | Upgrade to paid API at Stage 2 |
| Upstash Redis (10K commands/day) | ~800 scans/day | Upgrade to Upstash Pay-as-you-go |
| SSL Labs free API (25 concurrent) | ~500 concurrent scans | Move to async submission model |
| BullMQ workers (5 concurrent) | ~50 scans/hour | Add more worker processes (horizontal) |
| Supabase free DB (500 MB) | ~6K scans (with findings) | Upgrade to Supabase Pro |
| Vercel Hobby (100 GB bandwidth) | ~50K page loads/month | Upgrade to Vercel Pro |

### What is explicitly NOT optimized in Stage 1
- Query caching for scan history (DB query on every request — fine at Stage 1 scale)
- CDN for API responses (not needed until Stage 2)
- Read replicas (not needed until Stage 2)
- Database connection pooling beyond Supabase defaults

---

## 13. Design Decisions Log

| Decision | Options Considered | Chosen | Reason |
|---|---|---|---|
| Frontend + API colocation | Separate Next.js + Express | Next.js with API Routes | Reduces deployment complexity for solo dev; one Vercel deployment; API routes are sufficient for this request volume |
| ORM | Prisma vs Drizzle vs raw SQL | Prisma | Type safety; excellent migration tooling; generates TypeScript types; team familiarity assumption |
| Queue | BullMQ vs Inngest vs pg-boss | BullMQ | Battle-tested; rich feature set (retry, concurrency, DLQ); Redis is already in stack |
| Auth | Clerk vs Auth0 vs custom JWT | Custom JWT | Security product should not depend on a third-party for authentication; demonstrates dogfooding; full control |
| LLM model | GPT-4 vs Claude Opus vs Claude Haiku | Claude Haiku (claude-haiku-4-5-20251001) | Lowest cost per token; sufficient for summarization; fastest response; Anthropic API already used in this project context |
| DPDP mapping | AI-generated vs static lookup table | Static lookup table | Deterministic; auditable; not dependent on LLM accuracy for legal claims; easy to update when DPDP rules change |
| Consent storage | Soft-delete allowed vs append-only | Append-only (no delete/update) | Legal record must be immutable; any mutation capability creates compliance risk |
| Domain ownership verification | DNS TXT record vs consent checkbox | Consent checkbox (Option A) | Lower friction; sufficient for Stage 1; DNS verification deferred to Stage 3 for high-volume enterprise tier |
