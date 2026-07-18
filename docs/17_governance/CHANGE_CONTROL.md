# Change Control

```yaml
id: GOV-CHANGE-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - docs/00_constitution/CONSTITUTION.md
downstream:
  - docs/17_governance/AI_AGENT_RULES.md
related_adrs: []
```

## Purpose
Define how intent, architecture, and runtime changes are approved and validated.

## Rules
Vision and constitution changes require human review and vision evolution; architecture changes require ADRs; runtime changes require task, plan, tests, and validation; deployment changes require deployment-readiness evidence.

## Validation
Change control is validated by IPS audit and deployment-readiness gate reports.
