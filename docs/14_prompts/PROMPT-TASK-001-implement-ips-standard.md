# Coding Prompt: TASK-001 IPS Adoption

```yaml
id: PROMPT-TASK-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - docs/13_context_packages/CP-TASK-001-implement-ips-standard.md
downstream: []
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
```

## Task summary
Adopt the company Intent Preservation System standard for docs-rag-microservice.

## Role
You are an implementation agent working under IPS governance.

## Task
Create project-specific IPS documents, add audit/gate scripts, wire package scripts, and produce validation evidence.

## Context
Use the context package and existing service documentation.

## Required context
Read root service docs, `docs/RAG_USAGE.md`, and the company standard before editing.

## Allowed changes
Documentation, IPS scripts, package scripts, and validation reports related to standard adoption.

## Forbidden changes
Runtime source behavior, Kubernetes deployment behavior, secrets, real tokens, raw production data, or unreviewed changes to immutable docs after adoption.

## Implementation instructions
Follow `docs/21_execution_plans/EP-TASK-001-implement-ips-standard.md`.

## Constraints
Do not change runtime behavior, do not commit secrets, and do not treat indexed RAG output as authoritative over source repository docs.

## Acceptance criteria
IPS docs and gates exist; build, tests, strict audit, and pre-coding gate pass.

## Validation commands
`npm run build`, `npm test`, `npm run docs:audit`, and `npm run gate:pre-coding`.

## Expected output
Updated repository files and validation evidence under `docs/12_validation/` and the validation reports directory.

## Validation
Use the commands above and record the results in `docs/12_validation/VAL-TASK-001-ips-adoption.md`.
