# Product Walkthrough

Use this click path for demoing the MVP in under 10 minutes. Steps 6-9 validate the implemented backend, persistence, security/validation, and AI assist layers.

## 1. Open Live Queue

- Navigate to `Live Queue`.
- Confirm rows are sorted by descending risk.
- Apply quick filters (risk, signal category, product, date, agent/state, coverage).
- Select a high-risk row.

## 2. Investigate in Right Panel

- Review application summary and current status.
- Inspect signal breakdown and per-category composition.
- Review timeline and linked entities.
- Add an investigation note.
- Trigger a disposition action (`Clear`, `Refer to Underwriter`, `Escalate to SIU`, `Decline`).

## 3. Review Signal Library

- Navigate to `Signal Library`.
- Open a rule card and inspect 30-day trigger count and precision.
- Edit rule fields (name, description, weight, status, trigger logic, lookback, suppression).
- Use the JSON test harness and run a fired/not fired explanation check.

## 4. Review Analytics

- Navigate to `Analytics`.
- Set global filters (date range and product).
- Show:
  - Fraud rate trend
  - Signal heatmap
  - Geography distribution
  - Coverage histogram
  - Agent outlier table
  - Time-to-disposition trend
- Export CSV (`fraud-analytics-export.csv`).

## 5. Review Case History

- Navigate to `Case History`.
- Filter by outcome/date/agent/state/signal.
- Open a closed case row.
- Confirm final disposition, top signals, and notes in drill-in panel.

## Demo Highlights to Call Out

- Explainable scoring (signals + category contributions).
- Cross-entity linkage surfaced to investigators.
- Rule tuning and test harness in one workspace.
- End-to-end path from queue triage to historical reporting.
- API-backed case workflow with durable local persistence.
- AI assist layer that is on-demand, cached, and budget-controlled.

## 6. Backend Slice Check (Phase 8)

- Confirm backend health endpoint responds (`/health`).
- Demonstrate queue/rules/case-history data loading via API (not static imports).

## 7. Local JSON Database Check (Phase 9)

- Add one note and one disposition update.
- Refresh the app and verify changes persist.
- Restart backend, reload UI, and verify persisted state remains.

## 8. Security and Validation Check (Phase 10)

- Send one invalid mutation payload and confirm schema validation error response.
- Verify allowed frontend origin behavior and blocked disallowed origin behavior if configured.
- Confirm mutation requests are logged with case/action metadata.

## 9. AI Assist Check (Phase 11)

- Trigger `Generate AI Brief` on one high-risk case and verify concise structured summary output.
- Re-run on the same case and confirm cache hit behavior (no duplicate model call).
- Force budget/cap condition and confirm deterministic fallback response is shown.
- Toggle demo mode and verify recorded fixture response path works without live API access.
