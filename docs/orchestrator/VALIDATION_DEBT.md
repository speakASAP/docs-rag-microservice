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
