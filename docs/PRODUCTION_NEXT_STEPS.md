# Productionization Next Steps

This document outlines realistic steps to move the MVP toward production.

## 0. Completed Demo Baseline (Phases 8-11)

Implemented in this repo for prototype velocity:

- Lightweight FastAPI backend service for read/write demo workflows.
- First-pass API contracts for applications, rules, authentication, and case actions.
- File-backed JSON repositories for applications, rules, cases, notes, and local auth users.
- Durable writes across refreshes and backend restarts via safe write patterns.
- API-level validation for mutation routes with standardized error responses.
- Baseline security middleware (CORS allowlist, secure headers, write-route throttling).
- On-demand AI summary path with strict response shape, budget guardrails, and fixture/demo mode.
- Cached AI brief behavior to avoid redundant model calls during demos.

## 1. Hardening Follow-Ups for Existing Baseline

- Add explicit schema/version migration for local JSON storage.
- Add stronger audit event model for auth + case mutations (correlation IDs, actor metadata).
- Expand auth hardening (token rotation, revocation list, configurable claims).
- Add richer API contract tests for edge cases and failure modes.
- Add per-route rate-limit policy with configurable burst/sustained limits.
- Add structured logging + metrics export for API and AI usage.

## 2. Streaming Ingest and Data Contracts

- Replace static dataset with streaming application ingest.
- Define versioned event/data contracts for applications, sessions, agent metadata, and dispositions.
- Add schema validation and dead-letter handling for malformed events.

## 3. Rule Governance and Change Management

- Persist rule definitions and revision history.
- Add approval workflow for rule changes (maker-checker).
- Provide rollback support and effective-date scheduling.
- Track rule impact by cohort before broad rollout.

## 4. Identity Resolution and Cross-Carrier Graph

- Build durable entity graph for phones/emails/devices/addresses/beneficiaries.
- Support probabilistic matching with confidence scores.
- Add explainable linked-entity evidence for investigator trust.

## 5. Scoring Lifecycle and Feedback

- Capture investigator dispositions as supervised feedback.
- Add offline evaluation pipelines (precision/recall, drift, stability).
- Support champion/challenger rule sets and controlled experiments.
- Introduce calibration monitoring for score band quality.

## 6. Compliance, Audit, and Data Security

- Add role-based access controls and field-level PII masking policies.
- Encrypt sensitive data in transit and at rest.
- Implement immutable audit logging for rule edits and case actions.
- Define retention, deletion, and legal hold workflows.

## 7. Reliability and Operations

- Add SLOs for ingest latency, scoring latency, and dashboard availability.
- Introduce alerting and runbooks for pipeline and UI failures.
- Add backfill/replay tooling for event correction and incident response.
- Implement observability dashboards and distributed tracing.

## 8. Scale and Performance

- Move large tables to server-driven pagination and query filtering.
- Introduce caching strategy for hot analytics aggregates.
- Optimize heavy visualizations (progressive rendering/virtualization).
- Define performance budgets and CI regression checks.

## 9. Enterprise Integration

- Expose APIs/webhooks for downstream underwriting/SIU systems.
- Integrate case management and ticketing systems.
- Support standardized report exports for compliance stakeholders.
