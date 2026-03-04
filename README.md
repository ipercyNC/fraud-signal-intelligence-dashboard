# Fraud Signal Intelligence Dashboard

A full-stack prototype for life-insurance fraud triage at application intake. It is intentionally optimized for rapid validation and demoability, not full production hardening.

## Why This Exists

Carriers often detect fraud too late. This demo shows an upstream workflow that scores applications at submission time, prioritizes investigator review, and supports explainable disposition decisions before bind.

## What’s Implemented

- React + TypeScript investigator workspace with four views:
  - `Live Queue` (risk-prioritized triage)
  - `Signal Library` (rule metadata + test harness)
  - `Analytics` (trend/outlier reporting + CSV export)
  - `Case History` (closed-case review)
- FastAPI backend with auth and case workflow APIs:
  - login
  - applications/rules/cases reads
  - note/disposition mutations
  - AI brief generation
- Local JSON persistence for low-friction setup and durable demo state.
- AI assist path with demo fixtures, cache behavior, and daily budget guardrails.
- CI pipeline for lint, test, and build.

## Architecture (60 Seconds)

1. Frontend authenticates and loads applications/rules/cases from FastAPI.
2. Scoring logic computes explainable risk contributions by category.
3. Investigators triage, add notes, and set dispositions.
4. Backend persists writes to local JSON and serves updated case state.
5. AI brief endpoint returns deterministic demo/live-backed summaries with caching and budget checks.

## Quick Start

Prereqs:

- Node.js `>=20`
- npm `>=10`
- Python `>=3.11`

Install and configure:

```bash
npm install
npm run py:install
cp .env.example .env
```

Run (two terminals):

```bash
npm run dev
npm run api:dev
```

Or run both:

```bash
npm run demo:dev
```

Open `http://127.0.0.1:5173`.

Demo login defaults:

- Email: `investigator@local.test`
- Password: `change-me-demo-password`

## 5-Minute Demo Flow

1. `Live Queue`: show risk sorting and filters.
2. Open a high-risk case: show signal breakdown + linked entities.
3. Add a note + set a disposition: show durable writes.
4. Generate AI brief twice: show generation then cache hit.
5. `Analytics` + `Case History`: show trends and closed-case audit trail.

Detailed walkthrough: `docs/WALKTHROUGH.md`.

## API Surface

- `GET /health`
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/applications`
- `GET /api/rules`
- `GET /api/cases`
- `POST /api/cases/:id/notes`
- `POST /api/cases/:id/disposition`
- `POST /api/cases/:id/ai-brief`

Auth is required for protected `/api/*` data routes.

## Scripts

- `npm run lint` - eslint + TypeScript checks
- `npm run test` - frontend + backend unit/integration tests
- `npm run build` - production build
- `npm run verify` - lint + test + build
- `npm run qa:e2e` - Playwright smoke workflow (desktop + mobile)
- `npm run screenshots:capture` - regenerate demo screenshots
- `npm run demo:reset` - reset local runtime state

## Prototype Tradeoffs (Intentional)

- Deterministic synthetic data instead of live carrier ingest.
- Local JSON persistence instead of managed database and migrations.
- Single-tenant demo auth model instead of enterprise RBAC.
- Practical hardening baseline only (CORS allowlist, secure headers, validation, write throttling).

Production hardening backlog is tracked in `docs/PRODUCTION_NEXT_STEPS.md`.

## AI Modes

- `AI_MODE=demo` (default): fixture-backed briefs from `backend/fixtures/ai_briefs.json`
- `AI_MODE=live`: uses `OPENAI_API_KEY`
- Budget controls: `AI_DAILY_CALL_CAP`, `AI_DAILY_TOKEN_CAP`

## Repo Status

This repo is designed to demonstrate agentic full-stack prototyping velocity with clear boundaries between prototype scope and production next steps.
