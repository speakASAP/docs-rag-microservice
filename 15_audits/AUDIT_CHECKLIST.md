# Audit Checklist

```yaml
id: AUDIT-CHECKLIST-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - 23_documentation_contracts/DOCUMENTATION_COMPLETENESS_STANDARD.md
downstream:
  - 12_validation/VAL-TASK-001-ips-adoption.md
related_adrs: []
```

## Documentation Checks
Required IPS folders and documents exist; major documents contain metadata; tasks, plans, and validation reports include required fields.

## Safety Checks
No secrets or raw production data in docs, prompts, examples, tests, logs, reports, or screenshots. JWT examples use placeholders only.

## Operational Checks
Build, tests, documentation audit, pre-coding gate, and deployment readiness gate where applicable.

## Validation
Checklist use is validated by task validation reports and generated gate evidence.
