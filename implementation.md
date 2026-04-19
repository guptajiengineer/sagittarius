# Implementation Plan — Vigil
**Version:** 1.0 (Stage 1)
**Architecture Version referenced:** 1.0 (Stage 1)
**Status:** Active
**Last Updated:** 2026-04-10

---

## FOR AI CODING AGENTS — READ THIS FIRST

You are building **Vigil** — an automated website security audit platform for Indian SMBs.

The full context lives in:
- `docs/PRD.md` — What we're building and why (requirements, user stories)
- `docs/SYSTEM_DESIGN.md` — Engineering decisions, data model, API design, sequence flows
- `docs/SYSTEM_ARCHITECTURE.md` — Repository structure, service breakdown, infrastructure
- `docs/SYSTEM_SECURITY.md` — Security patterns, threat model, consent architecture
- `docs/implementation.md` (this file) — Your task queue

**Rules you must follow without exception:**

1. Never introduce a library not listed in the Architecture or this document without stating it and explaining why.
2. Always match the file structure defined in `SYSTEM_ARCHITECTURE.md` Section 2 exactly. No new top-level directories without explicit instruction.
3. Always use the error handling pattern from `SYSTEM_DESIGN.md` Section 10: `{ error, message, request_id, fields }`.
4. Always use Zod for input validation on every API route before any business logic.
5. Never write SQL directly. Use Prisma ORM with parameterized queries only.
6. Never log passwords, API keys (plaintext), full tokens, or email addresses. Log user_id instead of email.
7. After completing each task, summarize what was built and flag any deviation from the plan with `[DEVIATION]`.
8. If you encounter ambiguity, stop and state the ambiguity. Do not assume.
9. TypeScript strict mode is **ON**. No `any`. No `as Type` casts without a comment.
10. The consent_log table is **append-only**. Never write UPDATE or DELETE for this table.
11. Never scan private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x). Reject at validation layer.
12. Every async function must have try/catch or use a Result type. Never let promises float unhandled.

**Current phase:** Phase 0 — Scaffolding
**Current task:** Task 0.1 — Monorepo initialization

*Update these two lines as you progress.*

---

## Prerequisites & Setup

### Required Tools (install before starting)
```bash
node --version    # Must be 20.x LTS
pnpm --version    # Must be 8.x (install: npm install -g pnpm@8)
docker --version  # Must be 24.x+
```

### Bootstrap from scratch
```bash
# 1. Create monorepo
mkdir vigil && cd vigil
git init
pnpm init

# 2. Clone or follow Phase 0 tasks below
# Every command and file needed is in Phase 0

# 3. After scaffolding, start local dev
docker-compose up -d          # Postgres + Redis
pnpm db:migrate               # Apply DB migrations
pnpm db:seed                  # Seed test data
pnpm dev                      # Start web:3000 + worker
```

### Environment Variables Reference

**`apps/web/.env.local`**
| Variable | Required | Description | Where to get it |
|---|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (pooled) | Supabase dashboard → Settings → Database → Connection String (Transaction mode) |
| `DIRECT_DATABASE_URL` | Yes | Postgres direct connection (for migrations) | Supabase dashboard → Settings → Database → Connection String (Session mode) |
| `REDIS_URL` | Yes | Upstash Redis REST URL | Upstash dashboard → Redis → REST API → UPSTASH_REDIS_REST_URL |
| `REDIS_TOKEN` | Yes | Upstash Redis REST token | Upstash dashboard → Redis → REST API → UPSTASH_REDIS_REST_TOKEN |
| `JWT_SECRET` | Yes | 32+ char random string | `openssl rand -base64 32` |
| `RESEND_API_KEY` | Yes | Resend API key | resend.com → API Keys |
| `NEXTAUTH_URL` | Yes | Full URL of web app | `http://localhost:3000` (dev) / `https://vigil.so` (prod) |
| `NEXT_PUBLIC_APP_URL` | Yes | Same as above (public) | Same as NEXTAUTH_URL |

**`apps/worker/.env.local`**
| Variable | Required | Description | Where to get it |
|---|---|---|---|
| `DATABASE_URL` | Yes | Same as web (pooled) | Same as web |
| `DIRECT_DATABASE_URL` | Yes | Same as web (direct) | Same as web |
| `REDIS_URL` | Yes | Same as web | Same as web |
| `REDIS_TOKEN` | Yes | Same as web | Same as web |
| `ANTHROPIC_API_KEY` | Yes | Claude API key | console.anthropic.com → API Keys |
| `SSL_LABS_EMAIL` | Yes | Your email (SSL Labs API requires this) | Your email address |
| `VIRUSTOTAL_API_KEY` | Yes | VirusTotal API key | virustotal.com → Profile → API Key |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Yes | Google API key with Safe Browsing enabled | console.cloud.google.com → APIs → Safe Browsing |
| `URLSCAN_API_KEY` | Yes | URLScan.io API key | urlscan.io → User Settings → API Key |
| `HIBP_API_KEY` | Yes | HaveIBeenPwned API key | haveibeenpwned.com/API/Key |
| `MXTOOLBOX_API_KEY` | Yes | MXToolbox API key | mxtoolbox.com/api |
| `SHODAN_API_KEY` | Yes | Shodan API key | account.shodan.io |
| `WHOIS_API_KEY` | Yes | WhoisXML API key | whoisxmlapi.com |
| `SECURITY_TRAILS_API_KEY` | Yes | SecurityTrails API key | securitytrails.com → Account → API |
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token with Radar read | dash.cloudflare.com → Profile → API Tokens |

---

## Coding Conventions

**File naming:** `kebab-case.ts` for all files. Example: `scan-submission.ts`, `dpdp-mapper.ts`

**Component naming:** `PascalCase.tsx` for React components. Example: `ScanHistoryTable.tsx`

**Function naming:** `camelCase`. Example: `submitScan()`, `mapToDpdp()`

**Constants:** `SCREAMING_SNAKE_CASE`. Example: `MAX_SCANS_PER_DAY`, `JWT_EXPIRY_SECONDS`

**DB tables:** `snake_case` (enforced by Prisma schema). Example: `scan_reports`, `consent_log`

**Imports:** Always use absolute paths via `@/` alias (configured in tsconfig). Never `../../utils`.

**Comments:** JSDoc on all exported functions. Inline comments for non-obvious logic only.

**Error handling:** All async route handlers wrapped in try/catch. Errors logged before returning 500.

**Commits:** Conventional commit format:
- `feat: add scan submission endpoint`
- `fix: prevent double-processing of retried scan jobs`
- `chore: update dependencies`
- `docs: update API contract table`
- `test: add unit tests for DPDP mapper`

---

## Testing Strategy

- **Unit tests:** Vitest — pure functions: DPDP mapper, severity scorer, URL validator, aggregator
- **Integration tests:** Vitest + `@prisma/client` test helpers — API route handlers with test DB
- **E2E tests:** Not in Stage 1 (added Stage 2)
- **Test file location:** Co-located. `src/dpdp-mapper.ts` → `src/dpdp-mapper.test.ts`
- **Minimum coverage:** 80% on `packages/config/` and `apps/worker/src/` (critical business logic)
- **CI gate:** Tests must pass before merge to main

---

## Phase 0 — Project Scaffolding

**Goal:** A running skeleton. `pnpm dev` starts without errors. No business logic yet. Just correct structure.
**Estimated effort:** 3–4 hours
**Depends on:** Nothing
**Unlocks:** All other phases

---

### Task 0.1 — Monorepo initialization

**Files to create:**
- `package.json` (root)
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`
- `.gitignore`
- `.npmrc`

**What to build:**

Root `package.json`:
```json
{
  "name": "vigil",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "db:migrate": "pnpm --filter @vigil/db migrate:dev",
    "db:migrate:deploy": "pnpm --filter @vigil/db migrate:deploy",
    "db:seed": "pnpm --filter @vigil/db seed",
    "db:generate": "pnpm --filter @vigil/db generate"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "prettier": "^3.2.0",
    "@types/node": "^20.0.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {},
    "test": { "dependsOn": ["^build"] }
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

`.gitignore`:
```
node_modules/
.next/
dist/
.env.local
.env.*.local
*.log
.turbo/
```

**Acceptance criteria:**
- [ ] `pnpm install` completes without errors
- [ ] Directory structure matches `SYSTEM_ARCHITECTURE.md` Section 2 top-level layout
- [ ] `git status` shows only the files created above

---

### Task 0.2 — Create shared packages scaffolding

**Files to create:**
- `packages/shared-types/package.json`
- `packages/shared-types/src/scan.ts`
- `packages/shared-types/src/auth.ts`
- `packages/shared-types/src/api.ts`
- `packages/shared-types/tsconfig.json`
- `packages/config/package.json`
- `packages/config/src/dpdp-rules.ts`
- `packages/config/src/severity-weights.ts`
- `packages/config/src/scan-limits.ts`
- `packages/config/tsconfig.json`

**What to build:**

`packages/shared-types/src/scan.ts`:
```typescript
export type ScanStatus = 'queued' | 'running' | 'complete' | 'failed'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Finding {
  id: string
  scanId: string
  module: string
  title: string
  description: string
  severity: Severity
  dpdpSection: string | null
  dpdpFineRange: string | null
  dpdpImplication: string | null
  recommendation: string
  rawData: Record<string, unknown>
  createdAt: Date
}

export interface ScanJob {
  scanId: string
  targetUrl: string
  userId: string
  enqueuedAt: string
}

export interface ModuleResult {
  module: string
  findings: Omit<Finding, 'id' | 'scanId' | 'createdAt'>[]
  error?: string
}
```

`packages/config/src/dpdp-rules.ts`:
```typescript
// Static lookup table mapping finding types to DPDP Act 2023 sections
// Update this file when DPDP enforcement rules change
// Reference: Digital Personal Data Protection Act, 2023 (India)

export interface DpdpRule {
  section: string
  title: string
  fineRange: string
  implication: string
}

export const DPDP_RULES: Record<string, DpdpRule> = {
  ssl_expired: {
    section: 'Section 8(4)',
    title: 'Inadequate security safeguards',
    fineRange: 'Up to ₹50 crore',
    implication: 'An expired SSL certificate means customer data transmitted to your website is not encrypted. This is an inadequate security safeguard under DPDP Act Section 8(4).',
  },
  ssl_weak: {
    section: 'Section 8(4)',
    title: 'Inadequate security safeguards',
    fineRange: 'Up to ₹50 crore',
    implication: 'Weak SSL/TLS configuration exposes customer data to interception. This fails the reasonable security safeguard requirement under DPDP Act Section 8(4).',
  },
  missing_hsts: {
    section: 'Section 8(4)',
    title: 'Inadequate security safeguards',
    fineRange: 'Up to ₹50 crore',
    implication: 'Without HSTS, users can be forced onto unencrypted connections. DPDP Act requires adequate data protection in transit.',
  },
  no_csp: {
    section: 'Section 8(4)',
    title: 'Inadequate security safeguards',
    fineRange: 'Up to ₹50 crore',
    implication: 'Missing Content Security Policy increases risk of cross-site scripting attacks that could steal customer data.',
  },
  malware_detected: {
    section: 'Section 8(5)',
    title: 'Failure to protect personal data',
    fineRange: 'Up to ₹250 crore',
    implication: 'A malware-infected website can exfiltrate customer personal data. This is a direct violation of DPDP Act Section 8(5) which requires preventing unauthorized access.',
  },
  domain_in_breach: {
    section: 'Section 8(6)',
    title: 'Failure to notify of data breach',
    fineRange: 'Up to ₹200 crore',
    implication: 'Your domain appears in known breach databases. Under DPDP Act Section 8(6), you may be required to notify affected individuals and the Data Protection Board.',
  },
  missing_dmarc: {
    section: 'Section 8(4)',
    title: 'Inadequate security safeguards — email spoofing risk',
    fineRange: 'Up to ₹50 crore',
    implication: 'Without DMARC, attackers can send emails pretending to be from your domain, potentially defrauding your customers.',
  },
  open_admin_panel: {
    section: 'Section 8(5)',
    title: 'Failure to prevent unauthorized access',
    fineRange: 'Up to ₹250 crore',
    implication: 'An exposed admin panel is a direct pathway for unauthorized access to customer data. DPDP Act Section 8(5) requires preventing such access.',
  },
  outdated_software: {
    section: 'Section 8(4)',
    title: 'Inadequate security safeguards',
    fineRange: 'Up to ₹50 crore',
    implication: 'Running outdated software with known vulnerabilities fails the reasonable security standard required by DPDP Act.',
  },
}
```

`packages/config/src/scan-limits.ts`:
```typescript
export const SCAN_LIMITS = {
  MAX_SCANS_PER_DAY_FREE: 10,
  MAX_API_KEYS_PER_USER: 3,
  MAX_SUBDOMAINS_TO_SCAN: 10,       // Series phase subdomain limit
  SCAN_TIMEOUT_MS: 8 * 60 * 1000,   // 8 minutes total scan timeout
  PARALLEL_TIMEOUT_MS: 90 * 1000,   // 90s for parallel phase
  SERIES_TIMEOUT_MS: 60 * 1000,     // 60s for series phase
  LLM_TIMEOUT_MS: 30 * 1000,        // 30s for Claude API call
  JOB_MAX_ATTEMPTS: 3,
  JOB_BACKOFF_DELAY_MS: 30 * 1000,  // Base for exponential backoff
  PRIVATE_IP_RANGES: [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^0\.0\.0\.0/,
    /^localhost$/i,
  ],
} as const
```

**Acceptance criteria:**
- [ ] All packages importable from each other via workspace protocol
- [ ] `pnpm typecheck` passes across all packages
- [ ] `DPDP_RULES` contains at minimum the 9 finding types listed above

---

### Task 0.3 — Database package setup (Prisma)

**Files to create/modify:**
- `packages/db/package.json`
- `packages/db/prisma/schema.prisma`
- `packages/db/src/client.ts`
- `packages/db/src/middleware.ts`
- `packages/db/tsconfig.json`

**What to build:**

`packages/db/prisma/schema.prisma` — full schema matching SYSTEM_DESIGN.md Section 4:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}

model User {
  id                String   @id @default(uuid())
  email             String   @unique
  passwordHash      String   @map("password_hash")
  emailVerified     Boolean  @default(false) @map("email_verified")
  emailVerifiedAt   DateTime? @map("email_verified_at")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  apiKeys           ApiKey[]
  scans             Scan[]
  consentLogs       ConsentLog[]
  emailTokens       EmailVerificationToken[]
  refreshTokens     RefreshToken[]

  @@map("users")
}

model ApiKey {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  name        String
  keyHash     String   @unique @map("key_hash")
  keyPrefix   String   @map("key_prefix")
  isActive    Boolean  @default(true) @map("is_active")
  lastUsedAt  DateTime? @map("last_used_at")
  createdAt   DateTime @default(now()) @map("created_at")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([keyHash])
  @@map("api_keys")
}

enum ScanStatus {
  queued
  running
  complete
  failed
}

model Scan {
  id              String     @id @default(uuid())
  userId          String     @map("user_id")
  targetUrl       String     @map("target_url")
  targetDomain    String     @map("target_domain")
  status          ScanStatus @default(queued)
  score           Int?
  subdomainsFound Int?       @map("subdomains_found")
  startedAt       DateTime?  @map("started_at")
  completedAt     DateTime?  @map("completed_at")
  durationMs      Int?       @map("duration_ms")
  errorMessage    String?    @map("error_message")
  retryCount      Int        @default(0) @map("retry_count")
  createdAt       DateTime   @default(now()) @map("created_at")

  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  consentLog      ConsentLog?
  findings        Finding[]
  report          ScanReport?

  @@index([userId])
  @@index([userId, createdAt(sort: Desc)])
  @@index([status])
  @@map("scans")
}

model ConsentLog {
  id              String   @id @default(uuid())
  scanId          String   @unique @map("scan_id")
  userId          String   @map("user_id")
  targetUrl       String   @map("target_url")
  clientIp        String   @map("client_ip")
  userAgent       String?  @map("user_agent")
  consentedAt     DateTime @map("consented_at")
  consentVersion  String   @default("v1.0") @map("consent_version")

  scan            Scan     @relation(fields: [scanId], references: [id], onDelete: Cascade)
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("consent_log")
}

enum Severity {
  critical
  high
  medium
  low
  info
}

model Finding {
  id               String   @id @default(uuid())
  scanId           String   @map("scan_id")
  module           String
  title            String
  description      String
  severity         Severity
  dpdpSection      String?  @map("dpdp_section")
  dpdpFineRange    String?  @map("dpdp_fine_range")
  dpdpImplication  String?  @map("dpdp_implication")
  recommendation   String
  rawData          Json     @map("raw_data")
  createdAt        DateTime @default(now()) @map("created_at")

  scan             Scan     @relation(fields: [scanId], references: [id], onDelete: Cascade)

  @@index([scanId])
  @@index([scanId, severity])
  @@map("findings")
}

model ScanReport {
  id               String   @id @default(uuid())
  scanId           String   @unique @map("scan_id")
  summary          String
  llmModel         String   @map("llm_model")
  llmInputTokens   Int      @map("llm_input_tokens")
  llmOutputTokens  Int      @map("llm_output_tokens")
  llmCostUsd       Decimal  @map("llm_cost_usd") @db.Decimal(10, 6)
  createdAt        DateTime @default(now()) @map("created_at")

  scan             Scan     @relation(fields: [scanId], references: [id], onDelete: Cascade)

  @@map("scan_reports")
}

model EmailVerificationToken {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  tokenHash  String   @unique @map("token_hash")
  expiresAt  DateTime @map("expires_at")
  usedAt     DateTime? @map("used_at")

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tokenHash])
  @@index([userId])
  @@map("email_verification_tokens")
}

model RefreshToken {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  tokenHash  String   @unique @map("token_hash")
  expiresAt  DateTime @map("expires_at")
  revokedAt  DateTime? @map("revoked_at")
  createdAt  DateTime @default(now()) @map("created_at")

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tokenHash])
  @@index([userId])
  @@map("refresh_tokens")
}
```

`packages/db/src/middleware.ts` — consent log immutability:
```typescript
import type { PrismaClient } from '@prisma/client'

/**
 * Registers Prisma middleware that prevents any UPDATE or DELETE
 * on the consent_log table. ConsentLog records are legal evidence
 * and must be immutable after creation.
 */
export function applyConsentLogImmutability(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    if (
      params.model === 'ConsentLog' &&
      (params.action === 'update' ||
        params.action === 'updateMany' ||
        params.action === 'delete' ||
        params.action === 'deleteMany')
    ) {
      throw new Error(
        '[SECURITY] ConsentLog records are immutable. Update/delete operations are prohibited.'
      )
    }
    return next(params)
  })
}
```

`packages/db/src/client.ts`:
```typescript
import { PrismaClient } from '@prisma/client'
import { applyConsentLogImmutability } from './middleware'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

applyConsentLogImmutability(db)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

export type { PrismaClient }
```

**Acceptance criteria:**
- [ ] `pnpm db:generate` runs without errors (generates Prisma client)
- [ ] `pnpm db:migrate` creates all 8 tables in local PostgreSQL
- [ ] Attempting to call `db.consentLog.update()` in tests throws the immutability error
- [ ] All table names in DB match `snake_case` convention

---

### Task 0.4 — Queue package setup

**Files to create:**
- `packages/queue/package.json`
- `packages/queue/src/redis.ts`
- `packages/queue/src/queues.ts`

**What to build:**

`packages/queue/src/redis.ts`:
```typescript
import { Redis } from '@upstash/redis'

// Singleton Redis connection using Upstash REST API
// No persistent TCP connection — safe for serverless Next.js API routes
export const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
})
```

`packages/queue/src/queues.ts`:
```typescript
import { Queue, Worker, type Processor } from 'bullmq'
import IORedis from 'ioredis'
import type { ScanJob } from '@vigil/shared-types'

// NOTE: BullMQ requires ioredis (TCP), not Upstash REST.
// Use separate ioredis connection for BullMQ.
// Use Upstash REST (redis.ts) for caching only.

function createBullRedisConnection() {
  return new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
  })
}

export const QUEUE_NAMES = {
  SCAN_JOBS: 'scan-jobs',
} as const

export function createScanQueue() {
  return new Queue<ScanJob>(QUEUE_NAMES.SCAN_JOBS, {
    connection: createBullRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 30_000, // 30s base
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  })
}

export function createScanWorker(processor: Processor<ScanJob>) {
  return new Worker<ScanJob>(QUEUE_NAMES.SCAN_JOBS, processor, {
    connection: createBullRedisConnection(),
    concurrency: 5,
    lockDuration: 30_000,
  })
}
```

**Acceptance criteria:**
- [ ] `createScanQueue()` and `createScanWorker()` are callable without errors
- [ ] BullMQ can connect to local Redis (`docker-compose up -d` running)

---

### Task 0.5 — Next.js web app scaffolding

**Files to create:**
- `apps/web/package.json`
- `apps/web/next.config.ts`
- `apps/web/tsconfig.json`
- `apps/web/tailwind.config.ts`
- `apps/web/app/layout.tsx` (root layout)
- `apps/web/app/(marketing)/page.tsx` (landing page stub)
- `apps/web/app/(dashboard)/layout.tsx` (dashboard layout stub)
- `apps/web/app/(dashboard)/dashboard/page.tsx` (stub)
- `apps/web/app/api/v1/health/route.ts`
- `apps/web/middleware.ts`
- `apps/web/.env.example`

**What to build:**

`apps/web/app/api/v1/health/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { db } from '@vigil/db'

export async function GET() {
  let dbStatus: 'ok' | 'degraded' = 'ok'

  try {
    await db.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'degraded'
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
    services: {
      database: dbStatus,
    },
  })
}
```

**Acceptance criteria:**
- [ ] `pnpm dev` in `apps/web` starts on port 3000 without TypeScript errors
- [ ] `GET http://localhost:3000/api/v1/health` returns `{ "status": "ok", ... }`
- [ ] Landing page stub renders at `/`
- [ ] Dashboard layout renders at `/dashboard` (no auth yet — just renders)

---

### Task 0.6 — Worker app scaffolding

**Files to create:**
- `apps/worker/package.json`
- `apps/worker/tsconfig.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/orchestrator.ts` (stub)
- `apps/worker/src/queue.ts`
- `apps/worker/.env.example`

**What to build:**

`apps/worker/src/index.ts`:
```typescript
import { createScanWorker } from '@vigil/queue'
import { orchestrateScan } from './orchestrator'

const worker = createScanWorker(orchestrateScan)

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed (scan: ${job.data.scanId})`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed (scan: ${job?.data.scanId}):`, err.message)
})

worker.on('error', (err) => {
  console.error('[worker] Worker error:', err)
})

console.log('[worker] Vigil worker started. Waiting for scan jobs...')
```

`apps/worker/src/orchestrator.ts` (stub only — Phase 3 fills this in):
```typescript
import type { Job } from 'bullmq'
import type { ScanJob } from '@vigil/shared-types'

/**
 * Main scan orchestration function.
 * Called by BullMQ worker for each scan job.
 * Stubs return immediately — Phase 3 implements the actual scan logic.
 */
export async function orchestrateScan(job: Job<ScanJob>): Promise<void> {
  const { scanId, targetUrl } = job.data
  console.log(`[orchestrator] Processing scan ${scanId} for ${targetUrl}`)
  // TODO: Phase 3 — implement full orchestration
}
```

**Acceptance criteria:**
- [ ] `pnpm dev` in `apps/worker` starts without TypeScript errors
- [ ] Worker logs "Vigil worker started. Waiting for scan jobs..."
- [ ] Worker connects to Redis without errors (requires `docker-compose up -d`)

---

### Task 0.7 — CI pipeline

**Files to create:**
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

`ci.yml` — runs on every PR:
```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 8 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:generate
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm audit --audit-level=high
```

**Acceptance criteria:**
- [ ] CI passes on a clean branch with the scaffold
- [ ] `pnpm audit` does not report HIGH or CRITICAL vulnerabilities

### Phase 0 Complete When:
- All 7 tasks checked off
- `pnpm dev` starts web on :3000 and worker without errors
- `GET /api/v1/health` returns 200
- CI passes on main branch

---

## Phase 1 — Data Layer

**Goal:** Complete database schema, seed data, and all DB utility helpers. No API routes yet.
**Estimated effort:** 2–3 hours
**Depends on:** Phase 0

---

### Task 1.1 — Run and verify migrations

**What to do:**
```bash
pnpm db:migrate    # Creates all 8 tables
pnpm db:generate   # Regenerates Prisma client with all types
```

Verify in local Postgres (via Supabase Studio or psql) that all 8 tables exist with the correct columns.

**Acceptance criteria:**
- [ ] All 8 tables present: `users`, `api_keys`, `scans`, `consent_log`, `findings`, `scan_reports`, `email_verification_tokens`, `refresh_tokens`
- [ ] All indexes present (verify with `\d table_name` in psql)
- [ ] `ScanStatus` and `Severity` enums created in Postgres

---

### Task 1.2 — Seed data

**File:** `packages/db/prisma/seed.ts`

Create:
1. One verified user: `{ email: "dev@vigil.so", password: bcrypt("test1234", 12) }`
2. One API key for that user: `{ name: "Dev Key", key: "vgl_testkey123456789012345678901" }`
3. Three scans with findings — one `complete`, one `running`, one `failed`
4. DPDP-mapped findings for the complete scan

All using `upsert` (idempotent — safe to run multiple times).

**Acceptance criteria:**
- [ ] `pnpm db:seed` completes without errors
- [ ] Re-running `pnpm db:seed` does not create duplicate records
- [ ] Seeded user can log in via test API calls
- [ ] Complete scan has at least 3 findings, each with `dpdp_section` populated

---

### Task 1.3 — DB helper utilities

**File:** `packages/db/src/helpers.ts`

Build typed helper functions:
```typescript
// All DB access in the app goes through these helpers, never raw Prisma calls scattered in routes

export async function getUserByEmail(email: string): Promise<User | null>
export async function getUserById(id: string): Promise<User | null>
export async function createUser(email: string, passwordHash: string): Promise<User>
export async function getApiKeyByHash(keyHash: string): Promise<(ApiKey & { user: User }) | null>
export async function createScan(userId: string, targetUrl: string, targetDomain: string): Promise<Scan>
export async function updateScanStatus(scanId: string, status: ScanStatus, extra?: Partial<Scan>): Promise<void>
export async function createConsentLog(scanId: string, userId: string, targetUrl: string, clientIp: string, userAgent: string | null): Promise<ConsentLog>
export async function createFindings(scanId: string, findings: CreateFindingInput[]): Promise<void>
export async function createScanReport(scanId: string, summary: string, model: string, inputTokens: number, outputTokens: number, costUsd: number): Promise<void>
export async function getScansByUserId(userId: string, page: number, limit: number): Promise<{ scans: Scan[], total: number }>
export async function getScanWithReport(scanId: string, userId: string): Promise<ScanWithReport | null>
export async function countScansInLast24Hours(userId: string): Promise<number>
```

**Acceptance criteria:**
- [ ] All helpers have JSDoc comments
- [ ] All helpers handle DB errors with try/catch and rethrow typed errors
- [ ] `countScansInLast24Hours` uses a rolling 24-hour window, not calendar day
- [ ] Unit tests pass for `countScansInLast24Hours` with mock data

### Phase 1 Complete When:
- All tables migrated and verified
- Seed runs idempotently
- All DB helpers implemented with unit tests

---

## Phase 2 — Authentication

**Goal:** Working auth system. Users can register, verify email, log in, manage API keys, and all auth middleware is in place.
**Estimated effort:** 4–5 hours
**Depends on:** Phase 1

---

### Task 2.1 — Auth utilities

**File:** `apps/web/lib/auth.ts`

```typescript
// JWT utilities
export function generateAccessToken(userId: string, email: string): string
export function verifyAccessToken(token: string): { userId: string, email: string } | null
export function generateRefreshToken(): string  // crypto.randomBytes(32).toString('hex')
export function hashToken(token: string): string  // SHA-256

// Password utilities
export async function hashPassword(password: string): Promise<string>  // bcrypt 12 rounds
export async function verifyPassword(password: string, hash: string): Promise<boolean>

// API key utilities
export function generateApiKey(): string  // "vgl_" + crypto.randomBytes(28).toString('hex')
export function getApiKeyPrefix(key: string): string  // first 12 chars

// Request helpers
export function getClientIp(request: Request): string  // from X-Forwarded-For or connection
export function getRequestId(): string  // UUID v4
```

**Acceptance criteria:**
- [ ] Unit tests for all pure functions (hash, verify, generate)
- [ ] `hashPassword` uses bcrypt with exactly 12 rounds
- [ ] `generateApiKey` always starts with `vgl_`
- [ ] `verifyAccessToken` returns null (not throws) on invalid token

---

### Task 2.2 — Auth middleware

**File:** `apps/web/lib/middleware/authenticate.ts`

```typescript
import type { NextRequest } from 'next/server'

interface AuthContext {
  userId: string
  email: string
  authMethod: 'jwt' | 'api_key'
}

/**
 * Extracts and validates auth from a request.
 * Supports both JWT (cookie) and API key (Authorization header).
 * Returns null if authentication fails — never throws.
 */
export async function authenticate(request: NextRequest): Promise<AuthContext | null>

/**
 * Helper for API route handlers: returns 401 if not authenticated
 */
export function requireAuth(
  handler: (request: NextRequest, context: AuthContext) => Promise<Response>
): (request: NextRequest) => Promise<Response>
```

**Acceptance criteria:**
- [ ] JWT auth: reads from `Authorization: Bearer <jwt>` header
- [ ] JWT auth: also reads from `access_token` httpOnly cookie (for dashboard)
- [ ] API key auth: reads from `Authorization: Bearer vgl_<key>` header
- [ ] Returns null (not 401) — the route handler decides what to return
- [ ] Caches API key lookup in Redis with 5-minute TTL (see System Design Section 8)
- [ ] Updates `lastUsedAt` on API key when used (async, non-blocking)

---

### Task 2.3 — Register endpoint

**File:** `apps/web/app/api/v1/auth/register/route.ts`

Implements the registration flow from System Design Section 7 Flow 1. Steps 1–9.

Request schema (Zod):
```typescript
const RegisterSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(8).max(128),
})
```

**Acceptance criteria:**
- [ ] Returns 201 with user object on success
- [ ] Returns 400 with `fields` on validation failure
- [ ] Returns 409 if email already registered
- [ ] Sends verification email via Resend
- [ ] Does NOT return `password_hash` in response (Prisma `omit` or `select`)
- [ ] Integration test: register → check DB → check email queued

---

### Task 2.4 — Login endpoint

**File:** `apps/web/app/api/v1/auth/login/route.ts`

Implements login flow. Returns access token + sets refresh token cookie.

**Acceptance criteria:**
- [ ] Returns 401 on wrong password (same error message — no username enumeration)
- [ ] Returns 403 if email not verified
- [ ] Sets `refresh_token` as httpOnly Secure SameSite=Strict cookie
- [ ] Returns access token in response body
- [ ] Stores refresh token hash in DB (`refresh_tokens` table)

---

### Task 2.5 — Remaining auth endpoints

**Files:**
- `apps/web/app/api/v1/auth/logout/route.ts`
- `apps/web/app/api/v1/auth/refresh/route.ts`
- `apps/web/app/api/v1/auth/verify-email/route.ts`
- `apps/web/app/api/v1/auth/request-reset/route.ts`
- `apps/web/app/api/v1/auth/reset-password/route.ts`

Build each per System Design Section 5 auth resource spec.

**Acceptance criteria:**
- [ ] Logout revokes refresh token in DB and clears cookie
- [ ] Refresh: validates refresh token, generates new access token, rotates refresh token
- [ ] Verify-email: token is single-use (sets `used_at`), expires after 24h
- [ ] Request-reset: same 200 response whether email exists or not (prevents enumeration)
- [ ] Reset-password: invalidates all refresh tokens for the user on success

---

### Task 2.6 — API key endpoints

**Files:**
- `apps/web/app/api/v1/api-keys/route.ts` (GET, POST)
- `apps/web/app/api/v1/api-keys/[id]/route.ts` (DELETE)

**Acceptance criteria:**
- [ ] GET returns list of user's keys without `key_hash`
- [ ] POST: max 3 active keys enforced (return 400 if exceeded)
- [ ] POST: returns full key (`vgl_<key>`) only in creation response, never again
- [ ] DELETE: only revokes user's own key (check `user_id` match)
- [ ] Revocation clears Redis cache for that key hash

### Phase 2 Complete When:
- Full auth flow tested end-to-end: register → verify → login → generate API key → revoke → logout
- All auth endpoints return correct status codes and error formats
- Middleware correctly distinguishes JWT vs API key auth

---

## Phase 3 — Scan Engine (Core)

**Goal:** The scan orchestrator is fully functional. Submitting a URL via API returns real security findings.
**Estimated effort:** 8–12 hours (largest phase)
**Depends on:** Phase 2

---

### Task 3.1 — URL validator

**File:** `apps/worker/src/lib/url-validator.ts`

```typescript
interface UrlValidationResult {
  valid: boolean
  normalizedUrl?: string
  domain?: string
  error?: 'invalid_format' | 'private_target' | 'unsupported_scheme'
}

export function validateAndNormalizeUrl(rawUrl: string): UrlValidationResult
```

Rules:
1. Must be http:// or https://
2. Must have a valid hostname (not IP address)
3. Hostname must not resolve to private ranges (check against `SCAN_LIMITS.PRIVATE_IP_RANGES`)
4. Normalize: lowercase scheme + hostname, preserve path
5. Extract domain: `new URL(url).hostname`

**Acceptance criteria:**
- [ ] Unit tests for 10+ cases: valid https, valid http, localhost, 192.168.x.x, 10.x.x.x, raw IP, no scheme, ftp://, etc.
- [ ] `http://localhost` → `{ valid: false, error: 'private_target' }`
- [ ] `HTTPS://Example.COM/path` → `{ valid: true, normalizedUrl: 'https://example.com/path', domain: 'example.com' }`

---

### Task 3.2 — Scan submission endpoint

**File:** `apps/web/app/api/v1/scans/route.ts` (POST handler)

Implements the scan submission flow (System Design Section 7, Flow 2, steps 1–9).

Request schema (Zod):
```typescript
const SubmitScanSchema = z.object({
  url: z.string().url(),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Consent must be explicitly true' })
  }),
})
```

**Acceptance criteria:**
- [ ] Requires authentication (JWT or API key)
- [ ] Validates URL with `validateAndNormalizeUrl`
- [ ] Validates consent is literal `true` boolean
- [ ] Checks rate limit: max 10 scans per user per 24h
- [ ] Creates Scan and ConsentLog in a single Prisma transaction
- [ ] Enqueues BullMQ job with `scanId`
- [ ] Returns 202 with `{ scan_id, status: "queued", created_at }`
- [ ] Returns correct error codes for each failure mode

---

### Task 3.3 — Scan status and result endpoints

**Files:**
- `apps/web/app/api/v1/scans/route.ts` (GET handler — list)
- `apps/web/app/api/v1/scans/[id]/route.ts` (GET handler — single)
- `apps/web/app/api/v1/scans/[id]/status/route.ts` (GET handler)

**Acceptance criteria:**
- [ ] List endpoint: paginated, user sees only their own scans
- [ ] Single scan: returns full findings + report when `status=complete`; returns 202 when still running
- [ ] All endpoints enforce `user_id` ownership check before returning data
- [ ] Status endpoint returns `progress_pct` (0/25/50/75/100 at each phase)

---

### Task 3.4 — Scan modules (parallel group)

**Files:** One file per module in `apps/worker/src/modules/`

Each module must implement this interface:
```typescript
interface ScanModule {
  name: string
  run(domain: string, url: string): Promise<ModuleResult>
}
```

Each module must:
1. Make the external API call with a 30-second timeout
2. Parse the response
3. Return normalized `Finding[]` with DPDP mapping applied (via `dpdp-mapper.ts`)
4. Catch all errors and return `{ module, findings: [], error: errorMessage }` — never throw

Build these modules in this order (easiest → hardest):

**3.4.1 — `security-headers.ts`**
API: `https://securityheaders.com/?q=<url>&followRedirects=on` (returns JSON with grade + headers)
Findings to generate:
- Missing CSP → `no_csp` (high)
- Missing HSTS → `missing_hsts` (high)
- Missing X-Frame-Options → (medium)
- Missing X-Content-Type-Options → (low)

**3.4.2 — `google-safe-browsing.ts`**
API: `POST https://safebrowsing.googleapis.com/v4/threatMatches:find`
Findings: malware_detected (critical), phishing_detected (critical)

**3.4.3 — `have-i-been-pwned.ts`**
API: `GET https://haveibeenpwned.com/api/v3/breacheddomain/<domain>`
Findings: domain_in_breach (high) — mask emails in rawData before storing

**3.4.4 — `mxtoolbox.ts`**
API: MXToolbox Lookup API
Findings: missing_dmarc (high), missing_spf (high), missing_dkim (medium)

**3.4.5 — `ssl-labs.ts`**
API: SSL Labs — `GET https://api.ssllabs.com/api/v3/analyze?host=<domain>&publish=off&all=done`
Note: SSL Labs API is async — poll until `status: READY` (max 90s, poll every 10s)
Findings: ssl_expired (critical), ssl_weak (high), ssl_expiring_soon (medium — < 30 days)

**3.4.6 — `virustotal.ts`**
API: `GET https://www.virustotal.com/api/v3/domains/<domain>`
Findings: based on `last_analysis_stats.malicious > 0` → malware_detected (critical)

**3.4.7 — `urlscan.ts`**
API: Submit scan, poll for result
Findings: Based on verdict `malicious` → phishing_detected

**3.4.8 — `shodan.ts`**
API: `GET https://api.shodan.io/shodan/host/<ip>?key=<key>`
Findings: Unexpected open ports (non-80/443) → `open_port_<port>` (medium/high depending on port)

**3.4.9 — `whois.ts`**
API: WhoisXML API
Findings: Domain expiring < 30 days (medium), domain_age < 30 days (info — new domain, higher risk)

**3.4.10 — `security-trails.ts`**
API: SecurityTrails DNS lookup
Findings: Info-level DNS record summary (no DPDP mapping needed for pure info findings)

**3.4.11 — `cloudflare-radar.ts`**
API: Cloudflare Radar URL scanner
Findings: High threat score (medium), malicious category (high)

**Acceptance criteria for all modules:**
- [ ] Each module has a unit test with a mocked API response
- [ ] Each module returns findings in < 30 seconds (enforced by module-level timeout)
- [ ] No module can crash the orchestrator — all errors caught and returned as `error` field
- [ ] All findings have `recommendation` field populated with actionable text

---

### Task 3.5 — crt.sh module (series group)

**File:** `apps/worker/src/modules/crt-sh.ts`

API: `GET https://crt.sh/?q=<domain>&output=json`
Returns: List of subdomains from certificate transparency logs
Deduplicates results. Returns max `SCAN_LIMITS.MAX_SUBDOMAINS_TO_SCAN` subdomains.
Filters out wildcard entries (`*.domain.com`).

---

### Task 3.6 — DPDP mapper

**File:** `apps/worker/src/dpdp-mapper.ts`

```typescript
import { DPDP_RULES } from '@vigil/config'
import type { Finding } from '@vigil/shared-types'

/**
 * Maps a finding key to DPDP Act section, fine range, and implication.
 * Returns null fields if no DPDP mapping exists for this finding type.
 * Uses static lookup table — never calls LLM.
 */
export function mapToDpdp(findingKey: string): {
  dpdpSection: string | null
  dpdpFineRange: string | null
  dpdpImplication: string | null
}
```

**Acceptance criteria:**
- [ ] Unit tests for all 9 finding keys in `DPDP_RULES`
- [ ] Unknown finding keys return `{ null, null, null }` (not an error)
- [ ] Function is pure (no side effects, no async)

---

### Task 3.7 — Aggregator and scorer

**File:** `apps/worker/src/aggregator.ts`

```typescript
/**
 * Merges all module results into a single findings array.
 * Calculates overall security score (0-100).
 * Applies DPDP mapping to each finding.
 */
export function aggregateResults(moduleResults: ModuleResult[]): {
  findings: NormalizedFinding[]
  score: number
  subdomainsFound: number
}
```

Scoring algorithm:
```
score = 100
For each critical finding: score -= 25
For each high finding:     score -= 15
For each medium finding:   score -= 8
For each low finding:      score -= 3
score = Math.max(0, score)
```

**Acceptance criteria:**
- [ ] Unit tests with known findings → expected score
- [ ] Score never below 0 or above 100
- [ ] Info-severity findings do not affect score
- [ ] Module errors (unavailable APIs) do not affect score

---

### Task 3.8 — LLM reporter

**File:** `apps/worker/src/llm-reporter.ts`

```typescript
interface ReportResult {
  summary: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export async function generatePlainEnglishReport(
  domain: string,
  score: number,
  findings: NormalizedFinding[]
): Promise<ReportResult>
```

System prompt:
```
You are a cybersecurity advisor writing a report for an Indian small business owner who has no technical background. 
Write in plain, simple English. Avoid all technical jargon.
Explain what was found, why it matters to their business and customers, and what they should do first.
If any findings violate India's DPDP Act 2023, explain the legal risk in plain terms.
Your report should be 300-500 words. Start with the most important finding.
Do not mention tool names, API names, or technical terms like SSL, HSTS, CORS, etc.
Translate technical terms into business terms: 
- "SSL expired" → "your website's security certificate has expired, meaning customer data is no longer protected"
- "Missing HSTS" → "customers can be tricked into visiting an insecure version of your website"
```

**Acceptance criteria:**
- [ ] Falls back gracefully if Claude API times out (returns `null` summary — scan still marked complete)
- [ ] Logs input/output tokens and calculated cost for every call
- [ ] Cost calculated as: `(inputTokens / 1M × 0.25) + (outputTokens / 1M × 1.25)` (Haiku pricing)

---

### Task 3.9 — Full orchestrator

**File:** `apps/worker/src/orchestrator.ts` (replaces stub from Phase 0)

Implements the complete scan flow (System Design Section 7, Flow 2, steps 10–20):

```typescript
export async function orchestrateScan(job: Job<ScanJob>): Promise<void> {
  const { scanId, targetUrl, userId } = job.data

  // 1. Idempotency check
  // 2. Update status → running
  // 3. Run parallel phase (Promise.all on all modules)
  // 4. Run series phase (crt.sh → subdomain scans)
  // 5. Aggregate results
  // 6. Bulk insert findings to DB
  // 7. Generate LLM summary
  // 8. Insert ScanReport
  // 9. Update Scan status → complete
  // 10. ACK job
}
```

**Acceptance criteria:**
- [ ] A real scan of `https://example.com` completes in < 3 minutes
- [ ] All 11 modules called in parallel phase
- [ ] crt.sh called in series phase; found subdomains passed to header/shodan checks
- [ ] If a module fails, scan still completes with remaining findings
- [ ] If Claude API fails, scan still marked complete (summary is null)
- [ ] Findings inserted in bulk (one Prisma `createMany` call, not a loop)
- [ ] Scan duration recorded in `duration_ms`

### Phase 3 Complete When:
- End-to-end test: `POST /api/v1/scans` → poll status → `GET /api/v1/scans/:id` returns findings
- At least 5 different modules return findings for `https://example.com`
- DPDP mapping appears on at least 2 findings
- LLM summary generated and stored

---

## Phase 4 — Frontend

**Goal:** Working dashboard. Users can submit scans, see status, read reports, manage API keys.
**Estimated effort:** 6–8 hours
**Depends on:** Phase 3 (for real data to display)

---

### Task 4.1 — API client

**File:** `apps/web/lib/api-client.ts`

Typed fetch wrapper for all API calls from frontend. Auto-refreshes access token on 401.

```typescript
export const api = {
  auth: {
    register(body: RegisterRequest): Promise<RegisterResponse>
    login(body: LoginRequest): Promise<LoginResponse>
    logout(): Promise<void>
  },
  apiKeys: {
    list(): Promise<ApiKeyListResponse>
    create(body: CreateApiKeyRequest): Promise<CreateApiKeyResponse>
    revoke(id: string): Promise<void>
  },
  scans: {
    submit(body: SubmitScanRequest): Promise<SubmitScanResponse>
    list(params?: { page?: number }): Promise<ScanListResponse>
    get(id: string): Promise<ScanDetailResponse>
    getStatus(id: string): Promise<ScanStatusResponse>
  },
}
```

---

### Task 4.2 — Auth context and pages

**Files:**
- `apps/web/lib/auth-context.tsx`
- `apps/web/app/(marketing)/login/page.tsx`
- `apps/web/app/(marketing)/register/page.tsx`
- `apps/web/middleware.ts` (Next.js middleware — redirects unauthenticated users)

**Acceptance criteria:**
- [ ] Register form: email + password + confirm password + submit → redirect to "check your email" page
- [ ] Login form: email + password → redirect to dashboard
- [ ] Middleware: unauthenticated visits to `/dashboard/*` redirect to `/login`
- [ ] Token stored in memory (React context), not localStorage

---

### Task 4.3 — Landing page

**File:** `apps/web/app/(marketing)/page.tsx`

Sections (in order):
1. **Hero:** "Find out if your website is putting your customers at risk. Free security scan in under 3 minutes." + URL input with consent checkbox + CTA button
2. **Stats:** ₹22,845 crore lost / 74% of SMBs attacked / 13% have security
3. **How it works:** 3 steps — Enter URL → We scan → Get plain-English report
4. **DPDP section:** Explain DPDP Act, fines, why this matters now
5. **What we check:** Grid of 11 check types with icons and plain-English descriptions
6. **Sign up CTA:** Simple email signup form

**Consent checkbox text (exact):**
> I confirm that I own this website or have explicit authorization from the owner to perform a security scan. I understand that Vigil will access publicly available information from this URL.

**Acceptance criteria:**
- [ ] Renders as SSG (no `use client` at page level)
- [ ] LCP < 1.5s (verify with Lighthouse)
- [ ] Mobile responsive (test at 375px width)
- [ ] Consent checkbox is required — CTA button disabled until checked

---

### Task 4.4 — Dashboard — scan submission

**File:** `apps/web/app/(dashboard)/dashboard/page.tsx`

Components:
- URL input field with validation (show error if invalid URL format)
- Consent checkbox with linked Terms text
- "Start Scan" button (disabled during submission)
- After submission: inline status tracker (polls `/status` every 5 seconds)
- When complete: "View Report" button

**Acceptance criteria:**
- [ ] Submitting invalid URL shows inline error without page reload
- [ ] Consent checkbox required before submission
- [ ] Status polls every 5s and shows current phase
- [ ] On completion: auto-stops polling, shows "Scan complete" with link to report

---

### Task 4.5 — Dashboard — scan history

Integrated into `dashboard/page.tsx` below the submission form.

Table columns: Domain | Date | Score | Status | Action (View Report)

Score display: Color-coded badge (red 0-40, amber 41-70, green 71-100)

---

### Task 4.6 — Scan report view

**File:** `apps/web/app/(dashboard)/scans/[id]/page.tsx`

Sections:
1. **Header:** Domain, scan date, overall score (big number, color-coded)
2. **Executive summary:** LLM-generated plain-English text in a prominent card
3. **DPDP violations:** Highlighted section if any findings have `dpdp_section`. Shows section, fine range, implication.
4. **Findings list:** Grouped by severity. Each finding: title, description, recommendation.
5. **Module coverage:** Which of the 11 modules ran successfully

---

### Task 4.7 — API key management page

**File:** `apps/web/app/(dashboard)/settings/page.tsx`

- List of API keys (name, prefix, created_at, last_used_at, status)
- Create new key form (name input + generate button)
- On creation: show full key in a copy-to-clipboard modal with warning "This will not be shown again"
- Revoke button with confirmation dialog

### Phase 4 Complete When:
- Full user journey works in browser: register → verify email → login → scan → view report
- Landing page passes Lighthouse score > 85 mobile
- API key creation and revocation works end-to-end

---

## Phase 5 — Hardening

**Goal:** Production-ready. All security controls in place. Rate limiting. Input validation. Audit complete.
**Estimated effort:** 3–4 hours
**Depends on:** Phase 4

---

### Task 5.1 — Rate limiting

Apply rate limiting middleware to all API routes:
- Auth endpoints: 10/min per IP
- Scan submission: 10/day per user (already in Phase 3) + 60/min per IP for API endpoints

Use Redis (`packages/queue/src/redis.ts`) with sliding window algorithm.

**File:** `apps/web/lib/middleware/rate-limit.ts`

---

### Task 5.2 — Security headers on all responses

**File:** `apps/web/next.config.ts`

Add to `headers()`:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

### Task 5.3 — Input validation audit

Review every API route handler. Verify:
- [ ] Every route has a Zod schema validated before any business logic
- [ ] Max lengths enforced on all string inputs
- [ ] No raw `req.body` access without parsing

---

### Task 5.4 — Dependency audit

```bash
pnpm audit --audit-level=high
```

Resolve or document any HIGH/CRITICAL findings.

---

### Task 5.5 — CORS configuration

**File:** `apps/web/next.config.ts` or route-level middleware

Production allowed origins: `https://vigil.so` only.
Development: `http://localhost:3000`.
Credentials: true (for cookie-based auth).

---

### Task 5.6 — PII audit

Verify:
- [ ] No email addresses in application logs (search codebase for `user.email` in log calls)
- [ ] HIBP breach findings mask emails before storing in DB
- [ ] Client IPs in consent_log masked to /24

### Phase 5 Complete When:
- Lighthouse security audit shows no critical issues
- `pnpm audit` reports no HIGH or CRITICAL vulnerabilities
- All API routes have Zod validation verified

---

## Phase 6 — Deployment

**Goal:** Live in production. CI/CD fully automated.
**Estimated effort:** 2–3 hours
**Depends on:** Phase 5

---

### Task 6.1 — Production environment setup

1. Create Supabase project (production) → get connection strings
2. Create Upstash Redis database (production) → get REST URL + token
3. Set up Railway project → deploy worker service
4. Set up Vercel project → connect GitHub repo → set environment variables
5. Configure custom domain on Vercel

**Checklist:**
- [ ] All environment variables set in Railway and Vercel dashboards
- [ ] Production DB migrations run: `pnpm db:migrate:deploy`
- [ ] Worker deployed and consuming from production queue
- [ ] `GET https://vigil.so/api/v1/health` returns `{ "status": "ok", ... }`

---

### Task 6.2 — Smoke test

After deployment, verify end-to-end in production:
1. Register a new account
2. Verify email
3. Submit a scan for `https://example.com`
4. Poll until complete
5. View report and verify findings appear
6. Generate API key
7. Submit scan via API key (curl)

---

### Phase 6 Complete = Stage 1 Complete

---

## Known Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SSL Labs API is slow (async polling) | High | Medium | 90s timeout; return partial scan without SSL grade if timeout hit |
| VirusTotal free rate limit (4 req/min) | High at Stage 2 | Medium | Queue rate-limited modules; upgrade API tier at Stage 2 |
| Claude API outage | Low | Medium | Catch error; mark scan complete without summary; log for retry |
| crt.sh returns 50+ subdomains | Medium | Low | Hard cap at `SCAN_LIMITS.MAX_SUBDOMAINS_TO_SCAN = 10` |
| Upstash Redis free tier (10K commands/day) | Medium at ~800 scans/day | High | Monitor daily; upgrade to pay-as-you-go when approaching limit |
| Worker crash mid-scan | Low | Medium | BullMQ lock expiry ensures job is re-queued; idempotency check prevents double-processing |
| User submits URL they don't own | Medium | High | Consent checkbox with logged audit trail; ToS enforcement in Stage 2 |

---

## Deferred to Stage 2

These are explicitly excluded from Stage 1. AI agents must not implement these:
- PDF report generation
- Webhook delivery
- Scheduled recurring scans
- Security certificate issuance
- Payment integration
- Stripe/PayPal integrations
- Razorpay dashboard native integration
- Email notifications on scan completion
- Scan result comparison
- PentAGI / active exploitation

---

## Progress Tracker

| Phase | Status | Started | Completed | Notes |
|---|---|---|---|---|
| Phase 0 — Scaffolding | Not started | — | — | |
| Phase 1 — Data Layer | Not started | — | — | |
| Phase 2 — Authentication | Not started | — | — | |
| Phase 3 — Scan Engine | Not started | — | — | Largest phase |
| Phase 4 — Frontend | Not started | — | — | |
| Phase 5 — Hardening | Not started | — | — | |
| Phase 6 — Deployment | Not started | — | — | |

**Update this table after completing each phase. Commit the update.**
