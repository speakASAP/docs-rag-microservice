# Local Workflow

```yaml
id: OPS-LOCAL-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - docs/17_governance/AI_AGENT_RULES.md
downstream:
  - docs/12_validation/VAL-TASK-001-ips-adoption.md
related_adrs: []
```

## Standard Change Flow
Read upstream IPS docs, confirm task and plan, classify data/contract/determinism impact, make scoped changes, run focused tests and gates, and record validation evidence.

## Commands
- `npm run build`
- `npm test`
- `npm run docs:audit`
- `npm run gate:pre-coding`
- `npm run gate:deployment -- --target TASK-001`

## Deployment
Use `bash scripts/deploy.sh` only after validation evidence exists and deployment is requested.

## Validation
Workflow compliance is validated by task execution plans and validation reports.
