# Agent Operations

## Roles

Readiness scanners classify work; workers implement bounded goals; monitors identify shared-file conflicts; integration validators separate current-task failures from validation debt.

## Before work

Read required repository and IPS documents, verify traceability, classify sensitive data, name validation commands, and identify contract, schema, replay, and deployment impact.

## Parallel work

Do not concurrently edit a public contract, schema, deployment file, generated index, or status artifact without an integration owner and merge order. Each lane declares scope, dependencies, validation, and handoff output.

## Validation debt

Use docs/orchestrator/VALIDATION_DEBT.md only for known out-of-scope failures. Debt never excuses a failure affecting changed files, acceptance criteria, or required integrations.

## Handoff

Record task status in TASKS.md and STATE.json, including validation evidence, blockers, deviations, and next action.

## Project-specific operations

Sources are catalog-driven, ingestion is sequential, and failed sources are degraded rather than proof of absence. Do not expose secrets or operate ingestion, deploy queue, or Ollama infrastructure without a scoped operational task.
