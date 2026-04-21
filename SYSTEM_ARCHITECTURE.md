# System Architecture — Sagittarius
**Version:** 1.0 (Stage 1)
**Status:** Approved
**System Design Version referenced:** 1.0 (Stage 1)
**Last Updated:** 2026-04-10

> This is a reference document. Every structural decision here is settled. A new engineer or AI coding agent reads this to understand the system. Nothing here is aspirational — everything here is the actual system.

---

## 1. Architecture Overview

**Pattern:** Modular Monorepo — Single API Monolith + Separate Worker Process

**Justification:**
Stage 1 is built solo. A microservices architecture would require service discovery, inter-service auth, distributed tracing, and multiple deployment pipelines — all overhead that serves a team, not a solo engineer. A pure monolith (API + worker in same process) creates problems as scan jobs grow: a blocked worker blocks API responses.

The chosen pattern: one Next.js app (frontend + API routes) and one Node.js worker process (BullMQ consumer). These are deployed separately but share one database and one Redis instance. This gives separation of concerns without microservices complexity.

**Migration path to Stage 3:**
When Stage 3 begins (team formation, active scanning tools, 100K+ scans/day), the worker service is extracted into a standalone service with its own Docker container and deployment pipeline. The API service remains unchanged. No code rewrite required — just extraction.

---

## 2. Repository Structure

```
sagittarius/
├── apps/
│   ├── web/                          # Next.js application
│   │   ├── app/                      # Next.js App Router
│   │   │   ├── (marketing)/          # Public pages (no auth required)
│   │   │   │   ├── page.tsx          # Landing page (SSG)
│   │   │   │   ├── layout.tsx
│   │   │   │   └── pricing/page.tsx  # Pricing page (Stage 4)
│   │   │   ├── (dashboard)/          # Authenticated pages
│   │   │   │   ├── layout.tsx        # Dashboard shell, auth guard
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx      # Scan submission + history
│   │   │   │   ├── scans/
│   │   │   │   │   └── [id]/page.tsx # Single scan report view
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx      # API key management
│   │   │   └── api/                  # Next.js API Routes
│   │   │       └── v1/
│   │   │           ├── auth/
│   │   │           │   ├── register/route.ts
│   │   │           │   ├── login/route.ts
│   │   │           │   ├── logout/route.ts
│   │   │           │   ├── refresh/route.ts
│   │   │           │   ├── verify-email/route.ts
│   │   │           │   ├── request-reset/route.ts
│   │   │           │   └── reset-password/route.ts
│   │   │           ├── api-keys/
│   │   │           │   ├── route.ts          # GET list, POST create
│   │   │           │   └── [id]/route.ts     # DELETE revoke
│   │   │           └── scans/
│   │   │               ├── route.ts          # GET list, POST submit
│   │   │               └── [id]/
│   │   │                   ├── route.ts      # GET full result
│   │   │                   └── status/route.ts
│   │   ├── components/               # React components
│   │   │   ├── ui/                   # Primitive UI components
│   │   │   ├── auth/                 # Login, register forms
│   │   │   ├── dashboard/            # Scan submission, history table
│   │   │   ├── scan/                 # Report view, finding cards
│   │   │   └── marketing/            # Landing page sections
│   │   ├── lib/                      # Frontend utilities
│   │   │   ├── api-client.ts         # Typed API client (fetch wrapper)
│   │   │   ├── auth.ts               # JWT decode, session helpers
│   │   │   └── validators.ts         # Zod schemas for forms
│   │   ├── middleware.ts             # Next.js middleware (auth guard)
│   │   └── next.config.ts
│   │
│   └── worker/                       # BullMQ worker process
│       ├── src/
│       │   ├── index.ts              # Worker entry point (starts queue consumer)
│       │   ├── orchestrator.ts       # Main scan orchestration logic
│       │   ├── modules/              # One file per external API
│       │   │   ├── index.ts          # Re-exports all modules
│       │   │   ├── ssl-labs.ts
│       │   │   ├── security-headers.ts
│       │   │   ├── google-safe-browsing.ts
│       │   │   ├── virustotal.ts
│       │   │   ├── urlscan.ts
│       │   │   ├── have-i-been-pwned.ts
│       │   │   ├── mxtoolbox.ts
│       │   │   ├── crt-sh.ts
│       │   │   ├── shodan.ts
│       │   │   ├── whois.ts
│       │   │   ├── security-trails.ts
│       │   │   └── cloudflare-radar.ts
│       │   ├── aggregator.ts         # Merge, normalize, score findings
│       │   ├── dpdp-mapper.ts        # Static DPDP rule lookup table
│       │   ├── llm-reporter.ts       # Claude API call for plain-English summary
│       │   └── queue.ts              # BullMQ queue/worker configuration
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── db/                           # Prisma schema + generated client
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Single source of truth for DB schema
│   │   │   └── migrations/           # Migration files (never manually edited)
│   │   ├── src/
│   │   │   ├── client.ts             # Prisma client singleton
│   │   │   └── middleware.ts         # Consent log immutability enforcement
│   │   └── package.json
│   │
│   ├── shared-types/                 # TypeScript types shared across apps
│   │   ├── src/
│   │   │   ├── scan.ts               # ScanStatus, Finding, ScanReport types
│   │   │   ├── auth.ts               # JWTPayload, ApiKeyPayload types
│   │   │   └── api.ts                # Request/Response types for all endpoints
│   │   └── package.json
│   │
│   ├── queue/                        # BullMQ queue definition (shared between API + worker)
│   │   ├── src/
│   │   │   ├── queues.ts             # Queue names and job type definitions
│   │   │   └── redis.ts              # Redis connection (Upstash)
│   │   └── package.json
│   │
│   └── config/                       # Shared configuration
│       ├── src/
│       │   ├── dpdp-rules.ts         # DPDP mapping rules (static lookup table)
│       │   ├── severity-weights.ts   # Scoring weights per severity level
│       │   └── scan-limits.ts        # Rate limits, timeouts, max retries
│       └── package.json
│
├── infra/                            # Infrastructure configuration
│   ├── railway.toml                  # Railway deployment config for worker
│   └── docker-compose.yml            # Local dev (postgres + redis)
│
├── docs/                             # Engineering documents
│   ├── PRD.md
│   ├── SYSTEM_DESIGN.md
│   ├── SYSTEM_ARCHITECTURE.md        # This file
│   ├── SYSTEM_SECURITY.md
│   └── implementation.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Run on every PR: typecheck, lint, test
│       └── deploy.yml                # Run on merge to main: deploy web + worker
│
├── package.json                      # Root package.json (pnpm workspace)
├── pnpm-workspace.yaml
├── turbo.json                        # Turborepo build pipeline
└── tsconfig.base.json                # Shared TypeScript config
```

### Directory Ownership Rules
- `apps/web/app/api/` — API route handlers only. No business logic. Calls service functions from `packages/`.
- `apps/worker/src/modules/` — Each file owns exactly one external API. No cross-module imports.
- `apps/worker/src/orchestrator.ts` — The only file that imports from `modules/`. Owns execution order.
- `packages/db/` — The only place Prisma client is instantiated. All DB access goes through this package.
- `packages/shared-types/` — No logic. Types and interfaces only.
- `packages/config/dpdp-rules.ts` — The DPDP mapping table. When DPDP rules change, only this file changes.

---

## 3. Service / Module Breakdown

### Service: Web Application (`apps/web`)
- **Responsibility:** Serves the marketing site, authenticated dashboard, and all public API endpoints
- **Owns:** User session management, API key management, scan submission, scan result retrieval
- **Exposes:** All `/api/v1/*` REST endpoints; Next.js pages
- **Consumes:** `packages/db` (Prisma), `packages/queue` (enqueue jobs), `packages/shared-types`
- **Does NOT:** Execute scan logic, call external security APIs, process queue jobs
- **Technology:** Next.js 14, TypeScript, React, Tailwind CSS
- **Entry point:** `apps/web/app/layout.tsx` (frontend), `apps/web/app/api/v1/` (API)

### Service: Worker (`apps/worker`)
- **Responsibility:** Executes scan jobs from the BullMQ queue; orchestrates all external API calls; writes results to DB
- **Owns:** Scan execution lifecycle, all module integrations, aggregation, DPDP mapping, LLM summarization
- **Exposes:** Nothing (no HTTP server). Only consumes from queue.
- **Consumes:** `packages/db`, `packages/queue`, `packages/config`, `packages/shared-types`, all external security APIs, Claude API
- **Does NOT:** Handle HTTP requests, manage user auth, serve web pages, manage API keys
- **Technology:** Node.js 20, TypeScript, BullMQ
- **Entry point:** `apps/worker/src/index.ts`

### Package: DB (`packages/db`)
- **Responsibility:** Single source of truth for database access
- **Owns:** Prisma schema, migration files, Prisma client singleton, consent log immutability middleware
- **Exposes:** `db` (Prisma client), all Prisma-generated types
- **Consumes:** PostgreSQL (Supabase)
- **Does NOT:** Contain business logic; contain migration decisions
- **Technology:** Prisma ORM, PostgreSQL
- **Entry point:** `packages/db/src/client.ts`

### Package: Queue (`packages/queue`)
- **Responsibility:** Shared queue definition used by both web (enqueue) and worker (dequeue)
- **Owns:** Queue names, job type definitions, Redis connection
- **Exposes:** `scanQueue` (BullMQ Queue instance), job type definitions
- **Consumes:** Redis (Upstash)
- **Technology:** BullMQ, ioredis

### Package: Config (`packages/config`)
- **Responsibility:** Static configuration shared across the system
- **Owns:** DPDP mapping rules, severity scoring weights, scan limits
- **Exposes:** `DPDP_RULES`, `SEVERITY_WEIGHTS`, `SCAN_LIMITS`
- **Does NOT:** Fetch config from external sources; contain logic

---

## 4. Data Architecture

### Database Strategy
Single PostgreSQL database (Supabase free tier). No separate databases per service at Stage 1. All services access the same DB through the `packages/db` Prisma client.

**Schema ownership by service:**

| Table | Owned by | Read by |
|---|---|---|
| users | Web (auth routes) | Web, Worker (user validation) |
| api_keys | Web (api-keys routes) | Web (auth lookup) |
| scans | Web (create), Worker (update) | Web, Worker |
| consent_log | Web (create) | Web (audit), never deleted |
| findings | Worker (create) | Web (display) |
| scan_reports | Worker (create) | Web (display) |
| email_verification_tokens | Web | Web |
| refresh_tokens | Web | Web |

### Migration Strategy
- Tool: Prisma Migrate
- File naming: `prisma migrate dev --name <descriptive_name>` generates timestamped migration files
- Never manually edit migration files after creation
- Migration files are committed to git and run automatically in CI before deploy
- Migration command in CI: `prisma migrate deploy` (applies pending migrations, never generates new ones)

### Seed Data Strategy
- File: `packages/db/prisma/seed.ts`
- Creates one test user, one API key, three sample scans with findings
- Run with: `pnpm db:seed` (dev only, never in production)
- Seed is idempotent: uses `upsert` not `create`

### Backup Strategy (Stage 1)
- Supabase free tier includes daily automated backups with 7-day retention
- Before any migration: manual export via `pg_dump` stored in team drive
- Stage 2: upgrade to Supabase Pro for point-in-time recovery

---

## 5. Infrastructure Architecture

### Production

```
Frontend / API:
  Provider:       Vercel
  Plan:           Hobby (free)
  Region:         Mumbai (ap-south-1) via edge routing
  Framework:      Next.js (auto-detected)
  Environment:    Production branch = main

Worker:
  Provider:       Railway
  Plan:           Free → Starter ($5/month at Stage 2)
  Region:         ap-southeast-1 (Singapore — closest to Mumbai with Railway)
  Runtime:        Node.js 20 Docker container
  Start command:  pnpm --filter worker start

Database:
  Provider:       Supabase
  Plan:           Free (500MB, 2 compute units)
  Engine:         PostgreSQL 15
  Region:         ap-south-1 (Mumbai)
  Connection:     Pooled via Supabase connection pooler (PgBouncer)

Cache / Queue:
  Provider:       Upstash Redis
  Plan:           Free (10K commands/day, 256MB)
  Region:         ap-southeast-1
  Protocol:       REST (Upstash) — no persistent TCP connection needed

Email:
  Provider:       Resend
  Plan:           Free (3K emails/month)

LLM:
  Provider:       Anthropic
  Model:          claude-haiku-4-5-20251001
  Billing:        Pay-per-token

DNS:
  Provider:       Cloudflare (free)
  Domain:         sagittarius.so (example — to be registered)

SSL:
  Strategy:       Automatic via Vercel (Let's Encrypt) for frontend
                  Automatic via Railway for worker internal endpoints
```

### Staging
- Vercel Preview Deployments: automatic on every PR (separate URL per PR)
- Railway: staging environment with `staging` branch
- Supabase: separate project for staging (free tier)
- Upstash: separate database for staging
- Staging uses same code but separate data — no shared state with production

### Local Development

```bash
# Prerequisites: Node.js 20, pnpm, Docker

git clone https://github.com/your-org/sagittarius
cd sagittarius
pnpm install

# Start local services
docker-compose up -d   # Starts postgres:5432 and redis:6379

# Environment setup
cp apps/web/.env.example apps/web/.env.local
cp apps/worker/.env.example apps/worker/.env.local
# Fill in: DATABASE_URL, REDIS_URL, API keys (see implementation.md)

# Database
pnpm db:migrate        # Apply migrations
pnpm db:seed           # Seed test data

# Start both services
pnpm dev               # Turborepo: starts web (3000) + worker simultaneously
```

---

## 6. Deployment Architecture

### CI/CD Pipeline

```
Trigger: PR opened or updated
  → GitHub Actions: ci.yml
    1. pnpm install (cached)
    2. pnpm typecheck (tsc --noEmit across all packages)
    3. pnpm lint (ESLint across all packages)
    4. pnpm test (Vitest unit tests)
    5. pnpm db:generate (verify Prisma client generates cleanly)
    → All must pass for PR to be mergeable

Trigger: Merge to main
  → GitHub Actions: deploy.yml
    1. pnpm install
    2. pnpm build (Turborepo: build all apps)
    3. pnpm db:migrate:deploy (apply pending migrations to production DB)
    4. Deploy web → Vercel (automatic via Vercel GitHub integration)
    5. Deploy worker → Railway (via Railway CLI in GitHub Action)
    6. Post-deploy smoke test: GET /api/v1/health → expect 200
```

### Branch Strategy

```
main            → Production. Protected. Merge via PR only.
staging         → Staging environment. Auto-deployed to Railway staging.
feature/*       → Feature branches. Auto-deployed as Vercel preview.
fix/*           → Bug fix branches. Same as feature/*.
```

No `develop` branch in Stage 1 (solo dev). Main is the only long-lived branch.

### Deployment Strategy
**Web (Vercel):** Atomic deployments. Zero-downtime by default. Rollback: instant via Vercel dashboard (promote previous deployment).

**Worker (Railway):** Rolling restart. New container starts before old one stops. Brief period of dual execution is safe because jobs are idempotent (checked at start of each job).

### Zero-Downtime Database Migrations
Rule: All migrations in Stage 1 must be backward-compatible (additive only). No column renames, no column drops, no NOT NULL additions to existing tables without defaults. This ensures the old worker version and new worker version can run simultaneously during rolling deploy.

---

## 7. Observability Architecture

### Logging
```
Tool:         Axiom (free: 50GB/month ingestion)
Format:       JSON (structured)
Transport:    HTTP via axiom-node SDK

Required fields on every log line:
{
  "timestamp": "ISO8601",
  "level": "error|warn|info|debug",
  "service": "web|worker",
  "environment": "production|staging|development",
  "request_id": "uuid|null",
  "user_id": "uuid|null",
  "scan_id": "uuid|null",
  "message": "string",
  "context": {}
}

Retention:
  Hot (queryable): 30 days
  Cold archive:    Not configured in Stage 1 (Axiom free tier)

Sensitive fields NEVER logged:
  - passwords, password_hash
  - API keys (plaintext)
  - full refresh tokens
  - email addresses (use user_id instead)
```

### Log Levels by Event

| Event | Level |
|---|---|
| Request received / response sent | INFO |
| Scan job started / completed | INFO |
| External API call succeeded | DEBUG |
| External API call failed (retried) | WARN |
| Consent log created | INFO |
| Rate limit triggered | INFO |
| Authentication failure | WARN |
| Scan job failed after all retries | ERROR |
| Unhandled exception | ERROR |
| DB connection failure | ERROR |

### Metrics
Stage 1: Derived from logs via Axiom queries. No separate metrics infrastructure.

Key metrics monitored:
- Scan completion rate: `completed / (completed + failed)` — alert if < 90%
- Scan duration p95: alert if > 300 seconds
- API error rate (5xx): alert if > 1% of requests
- Queue depth: alert if > 50 jobs waiting

Stage 2: Add Prometheus + Grafana or Datadog.

### Alerting (Stage 1)
- Axiom monitors → email alert to founder on:
  - Scan failure rate > 10% in any 1-hour window
  - API 5xx rate > 5% in any 15-minute window
  - Queue depth > 50

### Distributed Tracing
Stage 1: `request_id` UUID passed through API → queue job → worker → DB. Logged at each step. Sufficient to trace a scan end-to-end via log query.

Stage 2: OpenTelemetry with Axiom trace backend.

---

## 8. Security Architecture

*(Full details in SYSTEM_SECURITY.md — this section is a summary of structural decisions only)*

### Network Topology
- No VPC or private network in Stage 1 (Supabase and Upstash accessed over TLS from Railway)
- Database connection string contains credentials — stored only in Railway and Vercel environment variables
- No database port exposed publicly (Supabase connection pooler handles this)

### Secret Management

| Secret | Storage | Access |
|---|---|---|
| DATABASE_URL | Railway env vars (worker), Vercel env vars (web) | Deploy pipeline |
| REDIS_URL (Upstash REST token) | Railway env vars, Vercel env vars | Deploy pipeline |
| JWT_SECRET | Vercel env vars | Web only |
| ANTHROPIC_API_KEY | Railway env vars | Worker only |
| All external API keys | Railway env vars | Worker only |
| RESEND_API_KEY | Vercel env vars | Web only |

Rules:
1. No secret in source code. Ever.
2. No secret in `.env` files committed to git.
3. `.env.example` contains key names with placeholder values only.
4. Secrets rotated on any suspected compromise.

### Principle of Least Privilege
- Worker process: has DB credentials with INSERT/SELECT/UPDATE on scan-related tables only. No access to `users` table password_hash column. Enforced at application layer (Prisma select field exclusions) — not yet at DB role level in Stage 1.
- Web process: has DB credentials for all tables. Required for auth routes.
- Stage 2: separate DB roles per service with explicit GRANT statements.

### Vulnerability Scanning in CI
- `pnpm audit` runs on every CI execution. Blocks merge on HIGH or CRITICAL severity vulnerabilities.
- `dependabot.yml` configured to auto-open PRs for dependency updates weekly.

---

## 9. Fault Tolerance & Disaster Recovery

### Single Points of Failure (Stage 1)

| SPOF | Mitigation | Gap |
|---|---|---|
| Supabase DB | Supabase has internal HA; daily backups | No read replica; RPO = 24 hours |
| Upstash Redis | Upstash has internal replication | If Upstash is down, no new scans can queue |
| Vercel | Global CDN; multiple edge nodes | Vercel outage = frontend down |
| Railway worker | Single container | Worker crash = scans stuck in queue until restart |
| External APIs (VirusTotal etc.) | Module-level try/catch; returns info finding | Feature degraded, not system down |

### RPO and RTO (Stage 1)
- **RPO (max data loss):** 24 hours (Supabase daily backup cadence)
- **RTO (max downtime before recovery):** 2 hours (manual intervention, solo engineer)

Stage 2 targets: RPO < 1 hour, RTO < 30 minutes.

### Worker Crash Recovery
BullMQ jobs are persisted in Redis. If the worker process crashes mid-scan:
- Job remains in `active` state in Redis
- BullMQ `lockDuration: 30000` (30 seconds) — if worker doesn't renew lock, job becomes available for retry
- Worker on restart automatically picks up orphaned jobs
- Scan record remains in `running` state until retried; corrected to `failed` if all retries exhausted

### Runbook Location
`docs/runbooks/` directory in repo. Each incident type has its own markdown file. Stage 1 runbooks:
- `scan-failure-spike.md`
- `db-connection-lost.md`
- `worker-not-consuming.md`

---

## 10. API Contract Reference

Complete canonical endpoint list. This table is the source of truth.

| Method | Path | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | /api/v1/auth/register | None | 10/min per IP | Create new user account |
| POST | /api/v1/auth/login | None | 10/min per IP | Authenticate, get tokens |
| POST | /api/v1/auth/logout | JWT cookie | 60/min | Revoke refresh token |
| POST | /api/v1/auth/refresh | Refresh cookie | 30/min | Get new access token |
| POST | /api/v1/auth/verify-email | None | 20/min per IP | Verify email with token |
| POST | /api/v1/auth/request-reset | None | 5/min per IP | Request password reset |
| POST | /api/v1/auth/reset-password | None | 5/min per IP | Reset password with token |
| GET | /api/v1/api-keys | JWT | 60/min | List user's API keys |
| POST | /api/v1/api-keys | JWT | 10/min | Create new API key |
| DELETE | /api/v1/api-keys/:id | JWT | 10/min | Revoke API key |
| POST | /api/v1/scans | JWT or API key | 10 scans/day per key | Submit scan |
| GET | /api/v1/scans | JWT or API key | 60/min | List scans (paginated) |
| GET | /api/v1/scans/:id | JWT or API key | 120/min | Get full scan result |
| GET | /api/v1/scans/:id/status | JWT or API key | 120/min | Get scan status |
| GET | /api/v1/health | None | Unlimited | Health check |
| GET | /api/docs | None | Unlimited | OpenAPI spec (JSON) |

### Health Check Response
```json
GET /api/v1/health
200: {
  "status": "ok",
  "timestamp": "ISO8601",
  "version": "1.0.0",
  "services": {
    "database": "ok|degraded",
    "queue": "ok|degraded"
  }
}
```

---

## 11. Inter-Service Communication

### Web → Worker (Async via Queue)

The only inter-service communication in Stage 1 is the web API enqueuing a scan job for the worker.

```
Event: scan.submitted
Producer:  apps/web (POST /api/v1/scans handler)
Consumer:  apps/worker
Queue:     scan-jobs (BullMQ on Redis)

Payload schema:
{
  "scan_id": "uuid",
  "target_url": "string (validated, normalized)",
  "user_id": "uuid",
  "enqueued_at": "ISO8601"
}

Delivery guarantee: at-least-once
Idempotency key:    scan_id (worker checks status before processing)
Max attempts:       3
Backoff:            exponential (30s, 120s, 300s)
```

No synchronous HTTP calls between web and worker. They communicate only through the shared database (web reads completed scan results from DB) and the queue (web enqueues, worker dequeues).

---

## 12. Dependency Map

| Dependency | Purpose | Criticality | Vendor SLA | Fallback |
|---|---|---|---|---|
| Supabase (PostgreSQL) | Primary database | **Blocking** | 99.9% | None — system down if DB down |
| Upstash (Redis) | Job queue + cache | **Blocking** | 99.9% | None — new scans cannot queue |
| Vercel | Frontend + API hosting | **Blocking** | 99.99% | Cloudflare Pages as emergency fallback |
| Railway | Worker hosting | **Blocking** | 99.5% | Render.com as alternative |
| Anthropic API | LLM summarization | Degraded | 99.9% | Return scan without summary; flag in response |
| Resend | Transactional email | Degraded | 99.0% | Queue email and retry; user still gets result |
| SSL Labs API | SSL check module | Degraded | No SLA | Module returns unavailable finding |
| VirusTotal API | Reputation check | Degraded | No SLA | Module returns unavailable finding |
| Google Safe Browsing | Malware check | Degraded | 99.9% | Module returns unavailable finding |
| URLScan.io API | Site analysis | Degraded | No SLA | Module returns unavailable finding |
| HaveIBeenPwned API | Breach check | Degraded | No SLA | Module returns unavailable finding |
| MXToolbox API | Email security | Degraded | No SLA | Module returns unavailable finding |
| crt.sh API | Subdomain discovery | Degraded | No SLA | Skip series phase; fewer findings |
| Shodan API | Port scan | Degraded | No SLA | Module returns unavailable finding |
| SecurityTrails API | DNS intel | Degraded | No SLA | Module returns unavailable finding |
| Cloudflare Radar API | Threat score | Degraded | 99.9% | Module returns unavailable finding |

**Design principle:** Any single external security API failing causes a degraded scan (missing that module's findings), never a failed scan. Only DB and queue failures cause system-level outages.

---

## 13. Architecture Decision Records

### ADR-001: Monorepo with Turborepo
**Date:** 2026-04-10
**Status:** Accepted
**Context:** Two deployable apps (web, worker) share types, DB access, and queue definitions. Need to avoid code duplication and type drift between services.
**Decision:** Turborepo monorepo with pnpm workspaces. Shared packages in `/packages`. Independent deployments per app.
**Consequences:** +Single `pnpm install` for all deps; +shared types enforced at compile time; +one git repo = one PR for cross-cutting changes. -Slightly more complex initial setup than two separate repos.
**Alternatives Rejected:** Two separate repos — would require publishing shared packages to npm or using git submodules, both are significant overhead for a solo dev.

### ADR-002: Next.js API Routes instead of standalone Express/Fastify API
**Date:** 2026-04-10
**Status:** Accepted
**Context:** Need to serve a marketing site, an authenticated dashboard, and a REST API. Could deploy as three separate services (marketing static site, Next.js dashboard, Express API) or consolidate.
**Decision:** Next.js API Routes for all web-facing API endpoints. Collocated with frontend in one Vercel deployment.
**Consequences:** +One deployment; +shared middleware for auth; +simpler CI/CD. -API routes are slightly less performant than standalone Fastify (acceptable at Stage 1 scale); -Next.js API routes have limited request body size configuration.
**Alternatives Rejected:** Standalone Fastify API — adds a second Railway deployment, CORS configuration, and separate deploy pipeline for negligible performance benefit at Stage 1 scale.

### ADR-003: Consent as Checkbox (not DNS verification)
**Date:** 2026-04-10
**Status:** Accepted
**Context:** Legal requirement to verify user is authorized to scan target domain (FR-007).
**Decision:** Consent checkbox on scan submission UI. Consent logged immutably with timestamp, IP, user agent. No DNS TXT record verification.
**Consequences:** +Minimal friction; +works for users who don't control DNS (agencies scanning clients); +sufficient for Stage 1 legal protection. -Less rigorous than cryptographic domain ownership proof.
**Alternatives Rejected:** DNS TXT record verification — adds 5-15 minutes to scan setup; breaks use case of agencies/consultants scanning client sites; deferred to Stage 3 enterprise tier.

### ADR-004: Static DPDP Mapping Table (not AI-generated)
**Date:** 2026-04-10
**Status:** Accepted
**Context:** Each finding must be mapped to a DPDP Act section with fine ranges (FR-027). Could use LLM to generate mapping per finding, or use a pre-built lookup table.
**Decision:** Static lookup table in `packages/config/dpdp-rules.ts`. Each finding type has a hardcoded DPDP section, fine range, and implication.
**Consequences:** +Deterministic; +auditable; +zero LLM cost for mapping; +easy to update by legal team. -Requires manual update when DPDP rules change; -cannot handle novel finding types automatically.
**Alternatives Rejected:** LLM-generated DPDP mapping — risk of hallucinated legal citations; unacceptable for a product making legal claims; adds latency and cost per scan.

### ADR-005: Consent Records are Append-Only
**Date:** 2026-04-10
**Status:** Accepted
**Context:** ConsentLog records are legal evidence. They must not be modifiable after creation.
**Decision:** Prisma middleware intercepts any UPDATE or DELETE operation on the `consent_log` table and throws an error. No application code should ever call these operations, but the middleware is a safety net.
**Consequences:** +Immutable legal record; +tamper-evident. -Slightly unusual pattern for developers unfamiliar with the codebase; mitigated by comment in middleware.
**Alternatives Rejected:** DB-level triggers — more complex to test and version; Prisma middleware achieves the same result with less infrastructure.

### ADR-006: Claude Haiku for LLM Summarization
**Date:** 2026-04-10
**Status:** Accepted
**Context:** Need to generate plain-English summaries from scan findings JSON. Multiple LLM options available.
**Decision:** Anthropic claude-haiku-4-5-20251001. Input: findings JSON + system prompt. Output: 300-500 word summary.
**Consequences:** +Lowest cost (~$0.01-0.02/scan); +fastest response (<5s); +sufficient capability for summarization. -Not suitable for complex reasoning tasks (PentAGI stage).
**Alternatives Rejected:** GPT-4o — 10-15× higher cost per scan, unacceptable for free tier Stage 1; Claude Sonnet — 3-5× higher cost, not justified for summarization.
