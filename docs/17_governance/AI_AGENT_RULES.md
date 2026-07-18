# AI Agent Rules

```yaml
id: GOV-AGENT-RULES-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - docs/00_constitution/CONSTITUTION.md
  - docs/23_documentation_contracts/AGENT_GAP_FILLING_RULES.md
downstream:
  - AGENTS.md
related_adrs: []
```

## Required Chain
Preserve `Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation`.

## Before Coding
Verify task traceability, execution plan, validation criteria, project invariants, sensitive-data classification, contract/schema impact, replay/determinism impact, and required gates.

## Immutable Documents
After IPS adoption, agents must not edit `docs/00_constitution/CONSTITUTION.md` or `docs/01_vision/VISION.md`. Human intent changes go through `docs/01_vision/VISION_EVOLUTION.md`.

## Data Safety
Do not place secrets, raw production data, confidential identifiers, real JWTs, or customer data into prompts, tests, examples, logs, plans, screenshots, or reports.

## Retrieval Boundary
Use docs-rag retrieval before broad file reads when the service is available, but treat source repository documentation as authoritative.

## Validation
Run focused tests and required IPS gates, then record validation evidence before closure.
