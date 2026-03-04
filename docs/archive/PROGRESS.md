# Fraud Signal Intelligence Dashboard — Build Progress

Use this checklist in order. Do not start a new phase until the current phase is complete.

## Phase 0: Scope Lock
- [x] Define the core product narrative around upstream, cross-carrier fraud detection at application time.
- [x] Select 2-3 anchor demo cases (for example: velocity cluster, identity mismatch, agent abuse).
- [x] Lock MVP scope (required views and workflows) and defer non-critical features.
- [x] Define clear success criteria (dataset size, number of implemented signals, coherent case explainability).

## Phase 1: App Foundation
- [x] Scaffold frontend app (React + TypeScript + Tailwind + charting/state libraries).
- [x] Set up project structure for data, signal logic, scoring, and views.
- [x] Implement global three-panel layout with navigation and persistent KPI header.
- [x] Define shared domain types (`Application`, `SignalResult`, `RuleConfig`, `CaseStatus`, `Note`).

## Phase 2: Synthetic Data Engine
- [x] Build seeded data generation for 200-300 realistic synthetic applications.
- [x] Generate supporting synthetic entities (agents, addresses, products, timestamps, channels).
- [x] Inject intentional fraud patterns (velocity, identity inconsistencies, STOLI indicators, agent anomalies).
- [x] Persist deterministic output files for stable local testing and demos.

## Phase 3: Signal and Scoring Engine
- [x] Implement signal evaluators across Identity, Velocity, Behavioral, Financial, and Agent categories.
- [x] Add weighted scoring logic to produce a capped 0-100 risk score.
- [x] Store per-signal explanations and per-category score contribution.
- [x] Add case status workflow states (`New`, `In Review`, `Escalated`, `Cleared`, `Declined`).

## Phase 4: Live Queue and Investigation Workspace
- [x] Build flagged-application table sorted by descending risk score.
- [x] Add filtering/sorting (risk, signal type, product, date, agent, state, coverage amount).
- [x] Build right-side detail panel with summary, signal breakdown, timeline, and score composition chart.
- [x] Add linked-entities visualization (shared phone/email/address/device/beneficiary).
- [x] Implement notes and disposition actions (`Clear`, `Refer to Underwriter`, `Escalate to SIU`, `Decline`).

## Phase 5: Signal Library
- [x] Create signal rule cards with category, description, severity weight, status, and trigger count.
- [x] Build rule editor fields (name, description, trigger logic, weight, lookback window, suppression logic).
- [x] Implement rule test harness (sample JSON input and fired/not fired explanation).
- [x] Add historical rule performance metric (for example, precision on closed cases).

## Phase 6: Analytics and Case History
- [x] Build fraud rate trend chart over time with segmentation by product and channel.
- [x] Build signal heatmap by signal and time window.
- [x] Build geography, coverage distribution, and agent outlier views.
- [x] Build time-to-disposition trend.
- [x] Build searchable/filterable closed case history with notes and final disposition.
- [x] Add CSV export where needed for reporting workflows.

## Phase 7: Product Hardening
- [x] Improve performance for large tables/graphs (memoization, render optimization, virtualization if needed).
- [x] Add loading, empty, and error states across views.
- [x] Validate responsive behavior on desktop and mobile breakpoints.
- [x] Run end-to-end QA pass on all primary workflows.

## Phase 8: Minimal Backend Slice
- [x] Stand up a lightweight backend service (`FastAPI/Python` preferred) with health endpoint and structured logging.
- [x] Expose API endpoints for core demo data (`GET /applications`, `GET /rules`, `GET /cases`).
- [x] Add investigator action endpoints for notes and disposition updates (`POST /cases/:id/notes`, `POST /cases/:id/disposition`).
- [x] Wire frontend data access through API client with graceful loading/error handling.

## Phase 9: Local JSON Database
- [x] Implement a file-backed JSON repository for applications, rules, cases, and notes.
- [x] Add repository utilities for safe read/write with atomic update semantics.
- [x] Seed local JSON DB from deterministic dataset on first run.
- [x] Ensure notes and disposition changes persist across app restarts.

## Phase 10: Security and Validation
- [x] Add request payload validation for all write endpoints.
- [x] Add API input sanitization and consistent error response contracts.
- [x] Add basic security middleware (CORS allowlist, rate limiting for write routes, secure headers).
- [x] Add audit-oriented request logging for case mutations.

## Phase 11: AI Assist Layer (Low-Cost)
- [x] Add on-demand LLM case summary action in case detail panel (`Generate AI Brief`).
- [x] Return concise structured output (5 bullets + recommended next action) from masked case payload.
- [x] Add request token and daily call caps with automatic fallback response when limits are reached.
- [x] Add response caching by case payload hash to avoid repeat model calls.
- [x] Add demo mode with pre-recorded JSON AI responses for offline/no-cost walkthroughs.

## Phase 12: Delivery Packaging
- [x] Write clear project README (problem, architecture, signal logic, tradeoffs, run instructions).
- [x] Prepare concise product walkthrough notes and click path.
- [x] Document realistic next steps for productionization (streaming ingest, governance, auditing, model feedback).

## Phase 13: Demo Cleanup
- [x] Add JWT login auth with hashed local credentials and protect write routes.
- [x] Remove or implement unused dependencies/config duplicates that make the repo look unfinished.
- [x] Add one integration-style test path for `note -> disposition -> persisted reload` and keep it local-only.
