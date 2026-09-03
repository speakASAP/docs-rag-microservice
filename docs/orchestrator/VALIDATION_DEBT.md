# Validation Debt Ledger

## Purpose

Record known validation failures outside the active task.

## Rules

Validation debt never excuses a current-task failure. Entries must identify owner, scope, unblock condition, and safe evidence without secrets or raw production data.

## Entries

### VDEBT-2026-08-31-IPS-DOC-AUDIT

- Date: 2026-08-31
- Command: `npm run docs:audit`
- Sanitized failure: 47 pre-existing high-severity findings across seven IPS bootstrap/adoption, semantic-compression, and graph artifacts; none names or touches the mounted-repository ingestion change.
- Scope: `docs/11_tasks/TASK-001-bootstrap-service.md`, `docs/12_validation/VAL-2026-08-30-repository-profile-adoption.md`, `docs/12_validation/VAL-TASK-001-bootstrap-service.md`, `docs/20_semantic_compression/{summaries,ultra}/VISION.*.md`, `docs/21_execution_plans/EP-TASK-001-bootstrap-service.md`, `docs/22_goal_impact/GOAL-IMPACT-TASK-001.md`, and graph edges derived from those artifacts.
- Owner: docs-rag IPS documentation adoption maintainer.
- Current-task impact: none; source tests, full tests, and TypeScript build pass, and the audit reported no finding in changed source/tests/SYSTEM/TASKS/STATE files.
- Unblock condition: bring the listed legacy IPS artifacts and graph links into conformance with their current templates, then rerun `npm run docs:audit` to zero findings.
- Evidence: terminal output from the 2026-08-31 takeover validation; no report file was created.

## Update format

When debt exists, record ID, date, command, sanitized failure, scope, owner, current-task impact, unblock condition, and evidence path.

### VDEBT-2026-09-03-INGESTION-NULL-BYTE

- Date: 2026-09-03
- Command: `POST /ingestion/trigger` (scheduled re-index of `speakasap`)
- Sanitized failure: `invalid byte sequence for encoding "UTF8": 0x00` — 6 occurrences in the last 7 days. A source file in that repository contains a NUL byte, which Postgres rejects on insert.
- Scope: `speakasap` ingestion only; other repositories index normally.
- Owner: docs-rag ingestion maintainer.
- Unblock condition: strip or reject NUL bytes during chunk extraction before insert.
- Current-task impact: none; production metrics verification for the RAG migration plan did not touch chunk extraction.

### VDEBT-2026-09-03-READONLY-FETCH-HEAD

- Date: 2026-09-03
- Command: `POST /ingestion/trigger` (`wisdom-quotes`)
- Sanitized failure: `cannot open '.git/FETCH_HEAD': Read-only file system` — 1 occurrence. The mounted checkout is intentionally read-only, so any code path attempting a fetch fails rather than reading the mounted HEAD.
- Scope: mounted read-only checkouts.
- Owner: docs-rag ingestion maintainer.
- Unblock condition: ensure the mounted-checkout path never attempts a network fetch.
- Current-task impact: none; the 2026-09-03 verification run completed and recorded the correct HEAD SHA, so this is intermittent rather than blocking.

