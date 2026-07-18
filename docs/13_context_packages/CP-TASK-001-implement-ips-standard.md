# Context Package: TASK-001 IPS Adoption

```yaml
id: CP-TASK-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - docs/11_tasks/TASK-001-implement-ips-standard.md
downstream:
  - docs/14_prompts/PROMPT-TASK-001-implement-ips-standard.md
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
```

## Target task
`docs/11_tasks/TASK-001-implement-ips-standard.md`

## Upstream traceability
Vision, business case, system, feature, task, execution plan, and goal-impact documents in this repository.

## Included documents
Existing root docs, `docs/RAG_USAGE.md`, and the company standard.

## Excluded documents
Runtime `.env` values, `node_modules/`, `dist/`, and production secrets.

## Constraints
Do not change runtime behavior, do not commit secrets, and do not invent human approvals.

## Agent prompt
Implement IPS adoption docs and gates using existing service documentation as source material.

## Validation instructions
Run build, tests, strict audit, and pre-coding gate before closure.
