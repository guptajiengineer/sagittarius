# Product Requirements Document — Sagittarius
**Version:** 1.0 (Stage 1)
**Status:** Draft
**Last Updated:** 2026-04-10
**Author:** Founding Team
**Stage:** 1 of 5
**Next Review:** End of Stage 1

> **Document versioning policy:** This document represents Stage 1 requirements only. When Stage 2 begins, this file is archived as `PRD_stage1.md` and a new `PRD.md` is generated for Stage 2. No document is mutated retroactively. This creates a git-traceable history of product intent at each stage.

---

## 1. Executive Summary

Sagittarius is an automated website security audit platform built for Indian small and medium businesses (SMBs). It orchestrates 10+ industry-standard security APIs in parallel, aggregates their results, maps every finding to India's Digital Personal Data Protection (DPDP) Act 2023, and delivers a plain-English security report in under 10 minutes — accessible via a self-serve dashboard and a public REST API.

Where a traditional penetration test costs ₹75,000–₹5,00,000 and takes weeks to schedule, Sagittarius delivers a structured security audit report in minutes. The product targets the 63 million Indian SMBs that currently have zero security coverage, starting with the 10 million+ merchants on Razorpay who handle real customer payment data under no security scrutiny whatsoever.

Stage 1 is free for early access users. The goal of Stage 1 is not revenue — it is a working, stable, API-exportable scan engine with a landing page, dashboard, and DPDP compliance layer, ready to demonstrate to Razorpay for native integration.

---

## 2. Problem Statement

### The Pain

Indian SMBs are digitally exposed and legally liable. The data is stark:

- **74%** of Indian SMEs reported at least one cyberattack in the past year *(India SME Forum 2024 + CERT-In)*
- **Only 13%** have any formal cybersecurity policy *(DSCI Industry Insights 2024)*
- **₹22,845 crore** lost to cybercrime in India in 2024 — a 206% jump over 2023 *(Ministry of Home Affairs)*
- **Average cost** of a data breach in India reached ₹22 crore in 2025 — highest globally *(IBM 2025)*
- **2.04 million** cyber incidents reported to CERT-In in 2024 *(India Foundation / CERT-In)*

The DPDP Act 2023 now mandates "reasonable security safeguards" for any business handling personal data of Indian citizens. Fines range from ₹50 crore to ₹250 crore per violation. Every Razorpay merchant collects personal data. None of them know if they're compliant.

### Current Workarounds and Why They Fail

| Workaround | Cost | Time | Why it fails for SMBs |
|---|---|---|---|
| Hire a pentester | ₹75K–₹5L per audit | 2–6 weeks | Unaffordable, non-repeatable |
| Enterprise tools (Qualys, Nessus) | $10K–$50K/year | Weeks of setup | Requires dedicated security team |
| Do nothing | ₹0 | — | Default for 87% of SMBs. Legally dangerous post-DPDP |
| Free online scanners | ₹0 | Minutes | Generic, no India context, no DPDP mapping, no business-readable output |

### Opportunity

The market just became real for three simultaneous reasons:
1. **Scale** — 63M SMBs now have websites. This didn't exist at scale before 2020.
2. **Legal pressure** — DPDP Act 2023 creates fines. Compliance is no longer optional.
3. **AI** — Plain-English report generation costs ₹1 instead of ₹2,000 in analyst time. This product was not economically viable before 2023.

Razorpay identified this exact problem on their "Fix My Itch" platform with a Whitespace Score of 8/10 — confirming that their 10M+ merchants have this problem and no one is solving it.

---

## 3. Goals & Non-Goals

### Goals — Stage 1 (Month 0–1)

- **By end of Stage 1:** A working scan engine that orchestrates 10+ free security APIs and returns a structured JSON report in under 3 minutes.
- **By end of Stage 1:** A REST API exported with API key authentication, ready for third-party integration.
- **By end of Stage 1:** A landing page and authenticated dashboard live in production.
- **By end of Stage 1:** A DPDP Act compliance mapping layer that annotates every finding with the relevant section and fine range.
- **By end of Stage 1:** Consent logging for every scan — immutable, timestamped, legally defensible.
- **By end of Stage 1:** Capacity to handle 2–10 scans/day without manual intervention.

### Goals — Stage 2 (Month 1–2, separate PRD)

- 10,000 scans/day capacity via paid API integrations and queue scaling
- Security certificate generation
- Razorpay merchant dashboard integration (API deal)
- PDF report generation

### Goals — Stage 3+ (separate PRDs)

- Active scanning with self-hosted tools (Nmap, Nuclei, Subfinder)
- GRC compliance reports
- Expert marketplace / fix referral upsell
- Global payment gateway expansion (Stripe, PayPal)

### Non-Goals for Stage 1 (explicitly deferred)

- Payment processing or subscription billing — *Stage 4*
- PentAGI / active exploitation / agentic pentesting — *Stage 5*
- Security certificate issuance — *Stage 2*
- PDF report generation — *Stage 2*
- Scheduled recurring scans — *Stage 2*
- Mobile application — *Stage 3+*
- Hindi or regional language support — *Stage 3+*
- White-label or reseller program — *Stage 4+*
- Expert marketplace for vulnerability remediation — *Stage 4*
- Webhook delivery — *Stage 2*
- Scan result comparison between two scans — *Stage 2*
- SSO / OAuth login (Google, GitHub) — *Stage 2*
- Slack, Teams, or email notifications on scan completion — *Stage 2*
- VAPT certification reports recognized by auditors — *Stage 3+*

---

## 4. User Personas

### Persona: Rahul — E-commerce SMB Owner
- **Who:** Runs a D2C fashion brand, 15 employees, accepts payments via Razorpay, built on WooCommerce
- **Goals:** Keep customer data safe, avoid a public breach, understand if they're DPDP-compliant
- **Frustrations:** Doesn't know what to check. Can't afford a security firm. Thinks he's "too small to be targeted."
- **Usage pattern:** Quarterly scan. Triggered by a news story about a breach, or pressure from a CA/lawyer about DPDP compliance.
- **Technical sophistication:** Low — will use the dashboard only, will not read the API docs

### Persona: Priya — SaaS Startup Founder
- **Who:** 3-person SaaS startup building for Indian SMEs. Series A fundraising in progress. Investors are asking for a security posture document.
- **Goals:** Get a credible security report to show investors. Pass enterprise customer vendor security questionnaires faster.
- **Frustrations:** A real pentest costs ₹2L and takes 6 weeks. She has a pitch in 10 days.
- **Usage pattern:** Monthly scans. Before investor meetings or enterprise sales cycles.
- **Technical sophistication:** Medium — comfortable with the dashboard, may try the API

### Persona: Dev — Developer / Technical Co-Founder
- **Who:** CTO at a seed-stage startup. Wants to bake security into their CI/CD pipeline. Tired of security being an afterthought.
- **Goals:** Integrate scan results into their deployment pipeline. Get JSON output. Get alerted when new vulnerabilities appear.
- **Frustrations:** Existing tools require enterprise contracts or complex self-hosted setup.
- **Usage pattern:** Weekly or on every deployment, via API, fully automated.
- **Technical sophistication:** High — will use only the REST API, will never log in to the dashboard

### Persona: Razorpay Merchant (via Razorpay integration, Stage 2)
- **Who:** Any of Razorpay's 10M+ merchants. Does not know Sagittarius exists. Sees a "Security Score" widget in their existing Razorpay merchant dashboard.
- **Goals:** Understand if their payment page is safe, without visiting another product.
- **Frustrations:** Security is intimidating. Doesn't know where to start.
- **Usage pattern:** On-demand, triggered by Razorpay UI prompt or notification. May scan once and never revisit unless reminded.
- **Technical sophistication:** Low — will interact only through Razorpay's native UI

---

## 5. User Stories

### Authentication & Account Management
- [P0] As a new user, I want to sign up with my email and password so that I can access the dashboard and get an API key.
- [P0] As a new user, I want to receive an email verification link so that my account is activated securely.
- [P0] As a returning user, I want to log in and stay logged in across browser sessions so that I don't re-authenticate on every visit.
- [P1] As a user, I want to reset my password via email so that I can recover access to my account if I forget it.
- [P0] As a user, I want to generate an API key from my dashboard so that I can use the REST API in my integrations.
- [P1] As a user, I want to name my API keys so that I know which key belongs to which integration.
- [P1] As a user, I want to revoke an API key so that I can invalidate compromised credentials immediately.

### Consent & Legal
- [P0] As a user initiating a scan, I want to see a consent checkbox confirming I own or am authorized to scan the target domain so that I understand the legal boundary before proceeding.
- [P0] As a user, I want to see what data Sagittarius collects and how long it stores it before I submit a scan so that I can make an informed decision.
- [P0] As Sagittarius, I want to log every consent event with the user ID, timestamp, IP address, and target domain so that we have an immutable legal record.

### Scan Submission
- [P0] As a user, I want to enter a URL in the dashboard and start a scan with one click so that I don't need technical knowledge.
- [P0] As a developer, I want to submit a URL to the REST API with my API key so that I can trigger scans programmatically without a browser.
- [P0] As a user, I want to see the real-time status of my scan (queued / running / complete / failed) so that I know when to check back.
- [P0] As a user, I want the scan to complete within 3 minutes for a typical website so that I can get results before losing interest.

### Scan Results & Report
- [P0] As a user, I want to see my security findings in plain English, not technical jargon, so that I understand what's wrong without a security background.
- [P0] As a user, I want each finding tagged as Critical / High / Medium / Low / Info so that I know what to fix first.
- [P0] As a user, I want to see each finding mapped to the relevant DPDP Act section and the fine I risk so that I understand my legal exposure.
- [P1] As a user, I want a summary score (0–100) for my website's security so that I can communicate my security posture to others in one number.
- [P1] As a developer, I want the full scan result available as structured JSON via the API so that I can process it in my own systems.

### Dashboard & History
- [P0] As a user, I want to see a list of all my past scans with domain, date, score, and status so that I can track my security over time.
- [P1] As a user, I want to click into any past scan and see the full report so that I can review findings at any time.

### Landing Page
- [P0] As a visitor, I want to understand what Sagittarius does within 10 seconds of landing so that I can decide whether to sign up.
- [P0] As a visitor, I want to see the DPDP Act angle explained so that I understand why this is legally urgent for my business.
- [P0] As a visitor, I want a clear CTA to sign up for free so that there's no friction to getting started.
- [P1] As a developer, I want to see API documentation linked from the landing page so that I can evaluate Sagittarius technically before signing up.

---

## 6. Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-001 | Email/password user registration | Must | Account created; verification email sent within 60 seconds; unverified accounts cannot initiate scans |
| FR-002 | Email verification | Must | Clicking link in email activates account; link expires after 24 hours |
| FR-003 | User login with persistent session | Must | JWT access token (15 min) + refresh token (30 days) issued; refresh token stored in httpOnly cookie |
| FR-004 | Password reset via email | Should | Reset link emailed within 60s; link expires in 1 hour; one-time use only |
| FR-005 | API key generation | Must | User can create up to 3 API keys per account; each key has a user-defined name and creation timestamp |
| FR-006 | API key revocation | Must | Revoked key rejected with 401 within 60 seconds of revocation; cannot be re-activated |
| FR-007 | Consent checkbox before scan | Must | Scan cannot be initiated (dashboard or API) without `consent: true` in payload; absence returns 400 with error `consent_required` |
| FR-008 | Consent event logging | Must | Every scan initiation logs: user_id, scan_id, target_url, timestamp (UTC), client_ip, consent=true; stored immutably |
| FR-009 | URL validation on submission | Must | Accepts http:// and https:// URLs with valid hostname; rejects IPs, localhost, private ranges (10.x, 192.168.x, 172.16-31.x); returns 400 with `invalid_target` |
| FR-010 | Scan job queuing | Must | Scan queued within 2 seconds of submission; scan_id returned to caller immediately; status set to `queued` |
| FR-011 | SSL/TLS analysis | Must | SSL Labs API: returns grade (A+/A/B/C/D/F/T/M), expiry date, days until expiry, protocol versions supported, weak cipher detection |
| FR-012 | HTTP security headers check | Must | SecurityHeaders.com or custom check: evaluates CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| FR-013 | Google Safe Browsing check | Must | Returns: is_flagged boolean, threat_types array (MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE) |
| FR-014 | VirusTotal reputation check | Must | Returns: malicious_count, suspicious_count, harmless_count, undetected_count from 70+ engines |
| FR-015 | URLScan.io analysis | Must | Returns: technologies detected, linked external domains, screenshot URL, IPs resolved to |
| FR-016 | HaveIBeenPwned breach check | Must | Checks domain against breach databases; returns list of breach names (email addresses masked) |
| FR-017 | Email security check (MX/SPF/DKIM/DMARC) | Must | MXToolbox: returns SPF record present/absent, DKIM configured boolean, DMARC policy (none/quarantine/reject), MX records |
| FR-018 | Certificate transparency / subdomain discovery | Must | crt.sh query: returns all subdomains registered in certificate transparency logs for the target domain |
| FR-019 | Shodan open port check | Must | Shodan free API: returns open ports, running services, detected vulnerabilities on target IP |
| FR-020 | Whois / domain age check | Must | Returns: registrar, creation date, expiry date, days until expiry, registrant country |
| FR-021 | SecurityTrails DNS check | Must | Returns: DNS records (A, MX, NS, TXT), historical DNS changes |
| FR-022 | Cloudflare Radar threat score | Must | Returns: domain category, threat score, is behind Cloudflare boolean |
| FR-023 | Parallel orchestration | Must | All modules in the parallel group (FR-011 through FR-022, excluding FR-018 subdomains) fire simultaneously via Promise.all; total parallel phase completes in max(slowest_module) time |
| FR-024 | Series orchestration | Must | crt.sh runs first; discovered subdomains fed into Shodan and header checks for each subdomain; series phase runs after parallel phase |
| FR-025 | Result aggregation | Must | All module outputs normalized to `Finding` schema: { module, title, description, severity, dpdp_section, fine_range, recommendation }; merged into single findings array |
| FR-026 | Severity scoring | Must | Each finding assigned severity: Critical / High / Medium / Low / Info; overall score 0–100 calculated as weighted average (Critical = -25, High = -15, Medium = -8, Low = -3) |
| FR-027 | DPDP Act mapping | Must | Rule-based mapper: each finding type maps to DPDP section, fine range, and plain-English legal implication; mapper is a static lookup table, not AI-generated |
| FR-028 | LLM executive summary generation | Must | Single Claude API call per scan; input: aggregated findings JSON; output: 300–500 word plain-English summary; cost target: < $0.02 per scan |
| FR-029 | Scan result persistence | Must | Raw module outputs + processed findings + LLM summary stored in DB; associated with user and scan_id; retained for 12 months |
| FR-030 | Scan history list | Must | Authenticated GET /api/v1/scans returns paginated list of user's scans: scan_id, target_url, status, score, created_at, completed_at |
| FR-031 | Scan result retrieval | Must | Authenticated GET /api/v1/scans/:id returns full report when status=complete; returns 202 with status if still running |
| FR-032 | Scan status endpoint | Must | GET /api/v1/scans/:id/status returns { scan_id, status, progress_pct, started_at, estimated_completion } |
| FR-033 | Rate limiting | Must | Free tier: 10 scans per API key per 24-hour rolling window; exceeding limit returns 429 with Retry-After header |
| FR-034 | API documentation | Must | OpenAPI 3.0 spec published at /api/docs; Swagger UI at /api/docs/ui |
| FR-035 | Landing page | Must | Marketing page: hero section, how-it-works, DPDP angle, sample report preview, sign-up CTA |
| FR-036 | Dashboard — scan submission UI | Must | Form: URL input, consent checkbox with linked terms, submit button; shows scan status in real time via polling |
| FR-037 | Dashboard — scan history | Must | Paginated table: domain, date, score, status; click row to view full report |
| FR-038 | Dashboard — API key management | Must | List, create (with name), copy, and revoke API keys |

---

## 7. Non-Functional Requirements

### Performance
- Scan job queued within **2 seconds** of API call
- Scan completes in **< 3 minutes** for simple sites (< 20 subdomains)
- Scan completes in **< 8 minutes** for complex sites (20+ subdomains, multiple services)
- All non-scan API endpoints: p95 latency **< 300ms**
- Dashboard page load: **LCP < 2.5s** on 4G mobile
- Landing page: **LCP < 1.5s** globally via CDN

### Scalability
**Stage 1 targets:**
- DAU: 2–10 scans/day
- Concurrent scans: up to 5 simultaneous without queueing
- Queue capacity: burst to 50 scans without dropping jobs

**Architectural requirement:** The system must scale horizontally at every layer (API, worker, DB) without code changes — only infra changes. This is validated by design, not just stated.

### Reliability
- Uptime target: **99%** (Stage 1) — ~7.2 hours downtime/month acceptable
- Failed scans retried up to **3 times** with exponential backoff
- No scan job lost once acknowledged — at-least-once delivery guarantee
- Scan results immutable once written — no update-in-place on completed scans

### Security (NFR — detailed security doc covers implementation)
- All traffic HTTPS only; HTTP redirected to HTTPS
- API keys hashed with SHA-256 before storage; never stored in plaintext
- Consent records are append-only — no delete, no update
- PII in breach findings (emails) masked to `f***@domain.com` format before storage
- No scan of RFC-1918 private IP ranges or localhost under any condition
- JWT secrets rotated on deploy; refresh tokens invalidated on rotation

### Accessibility
- Landing page: **WCAG 2.1 AA**
- Dashboard: **WCAG 2.1 A** (minimum for Stage 1)

### Internationalisation
- English only at Stage 1
- All user-facing strings externalized into i18n-ready key files from day one (no hardcoded strings in components)

---

## 8. Constraints & Assumptions

### Constraints (hard limits)
- **Team:** Solo engineer for Stage 1 and Stage 2; team formation begins Stage 3
- **Budget:** Zero infra spend in Stage 1 — free tiers only (Railway free, Supabase free, Upstash free, Vercel Hobby)
- **External API rate limits:** SSL Labs (25 concurrent max); VirusTotal (4 requests/min free tier); these constrain Stage 1 scan concurrency
- **No payments:** Payment infrastructure is explicitly excluded from Stage 1 scope
- **No PentAGI:** Active exploitation tools excluded from Stage 1 entirely

### Assumptions (if wrong, these requirements break)
| Assumption | Breaks if wrong |
|---|---|
| SSL Labs free API remains available | FR-011 breaks; need paid Qualys alternative |
| VirusTotal free tier allows 4 req/min | FR-014 breaks; need to implement request queuing |
| crt.sh public API remains available | FR-018 breaks; subdomain discovery fails |
| Claude API costs remain ~$0.01–0.02 per summary | FR-028 becomes unprofitable in Stage 4 if costs rise |
| DPDP Act enforcement actively begins in 2026 | Value proposition weakens if enforcement is delayed |
| Indian SMBs are willing to use a free product | Stage 1 adoption fails; pivot needed |
| Razorpay will consider API integration after seeing working product | Distribution strategy fails; need direct-to-SMB go-to-market |

---

## 9. Success Metrics & KPIs

| Metric | Baseline | Target (End Stage 1) | Target (End Stage 2) | Measurement |
|---|---|---|---|---|
| Scans completed | 0 | 50 | 5,000 | DB count |
| API keys generated | 0 | 20 | 500 | DB count |
| Scan success rate | — | > 90% | > 95% | completed / (completed + failed) |
| Avg scan duration | — | < 180s | < 120s | completed_at - started_at |
| DPDP findings per scan (avg) | — | ≥ 2 | ≥ 3 | findings where dpdp_section IS NOT NULL |
| API response time p95 | — | < 300ms | < 200ms | Application monitoring |
| Zero data loss incidents | — | 0 | 0 | Incident log |
| Consent compliance | — | 100% | 100% | scans with consent_log record / total scans |

---

## 10. Open Questions

| # | Question | Owner | Deadline |
|---|---|---|---|
| 1 | Finalize product name — "Sagittarius" is working name | Founder | Before Stage 1 launch |
| 2 | Free tier scan limit: 10/day per API key — should Stage 1 be unlimited to maximize early feedback? | Founder | Before Stage 1 launch |
| 3 | At what Stage 1 milestone do we initiate Razorpay integration conversation? | Founder | End of Stage 1 |
| 4 | 12-month scan result retention — is this the right window under DPDP data minimisation principles? Consult legal. | Founder | Before Stage 1 launch |
| 5 | Should subdomain scans require separate consent per subdomain, or is top-level domain consent sufficient? | Founder + Legal | Before Stage 1 launch |

---

## 11. Out of Scope — Stage 1

The following features are intentionally deferred. AI coding agents must not implement these in Stage 1 under any circumstances.

- Payment processing, subscriptions, or billing of any kind
- Security certificate generation or issuance
- PDF report generation
- Webhook delivery on scan completion
- Scheduled / recurring automated scans
- PentAGI or any active exploitation tooling
- Nmap, Nuclei, sqlmap or any self-hosted scanning tools
- GRC module or formal compliance report generation
- Expert marketplace or vulnerability fix referral
- Stripe, PayPal, or any non-Razorpay payment gateway integration
- White-label or reseller functionality
- Mobile application (iOS or Android)
- Hindi or any regional language support
- Google, GitHub, or any OAuth/SSO login
- Slack, Teams, email, or any notification channel
- Scan result comparison between two scans of the same domain
- VAPT certificates recognized by formal auditors
- Dark web monitoring beyond HaveIBeenPwned
