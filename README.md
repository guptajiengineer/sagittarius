<div align="center">
  <br />
  <h1>🛡️ Sagittarius Security Platform</h1>
  <p>
    <strong>Automated, DPDP-Compliant Website Security Audits for Indian SMBs</strong>
  </p>
  <br />
</div>

## 📌 Overview

**Sagittarius** is an automated website security audit platform built specifically for Indian small and medium businesses (SMBs). It orchestrates 10+ industry-standard security APIs in parallel, aggregates their results, and translates technical vulnerabilities into a plain-English security report. 

Crucially, Sagittarius maps every finding to **India's Digital Personal Data Protection (DPDP) Act 2023**, helping businesses understand their legal exposure and potential fines in under 10 minutes—accessible via a self-serve dashboard and a public REST API.

## ✨ Key Features

- 🚀 **Parallel Security Orchestration:** Runs 10+ external security checks (SSL Labs, Shodan, VirusTotal, etc.) simultaneously for blazing-fast results.
- 📜 **DPDP Act Mapping:** Automatically maps technical findings to specific sections of the DPDP Act 2023, including potential fine ranges.
- 🧠 **AI-Powered Reports:** Translates complex security jargon into a plain-English executive summary using LLMs (Claude).
- 🔌 **Developer-Ready REST API:** Fully featured API with key authentication for seamless CI/CD or third-party integrations.
- 📊 **Risk Scoring:** Assigns a 0–100 security score based on weighted severity (Critical, High, Medium, Low, Info).
- 🔒 **Privacy-First:** Immutable consent logging and PII masking built-in.

## 🏗️ Architecture

Sagittarius uses a modern, scalable monorepo architecture designed for parallel processing and high throughput:

- **Frontend/API:** Next.js
- **Worker Engine:** Node.js
- **Database:** PostgreSQL (via Prisma)
- **Queueing:** Redis
- **Package Manager:** pnpm + Turborepo

*(For detailed architectural decisions, see [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) and [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md))*

## 🚀 Getting Started

Sagittarius is currently in **Stage 1 (Early Access)**. 

### Prerequisites
- Node.js (v18+)
- pnpm
- Local Redis and PostgreSQL instances

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd sagittarius
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables:**
   You will need to set up environment variables for the database, Redis, and external security APIs across the `apps/web` and `apps/worker` directories.

4. **Run Database Migrations:**
   ```bash
   pnpm --filter db db:push
   ```

5. **Run the Development Servers:**
   ```bash
   pnpm dev
   ```

## 📖 Internal Documentation

Extensive internal documentation is available in the root directory to understand the platform's vision, design, and implementation:

- 🎯 **[Product Requirements (PRD)](./PRD.md)** - Vision, Personas, and User Stories
- 🏛️ **[System Architecture](./SYSTEM_ARCHITECTURE.md)** - High-level tech stack and component interaction
- ⚙️ **[System Design](./SYSTEM_DESIGN.md)** - Low-level design, database schema, and queue configurations
- 🛡️ **[System Security](./SYSTEM_SECURITY.md)** - Threat models and security constraints
- 🛠️ **[Implementation Plan](./implementation.md)** - Step-by-step technical execution phases

## 🤝 Contributing

Contributions are welcome! Please ensure any pull requests align with the goals outlined in the [PRD](./PRD.md).

## 📄 License

Proprietary / Closed Source (Modify as needed)
