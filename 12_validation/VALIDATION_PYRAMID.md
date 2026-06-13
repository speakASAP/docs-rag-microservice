# Validation Pyramid

```yaml
id: VAL-PYRAMID-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - 01_vision/VISION.md
  - 04_systems/SYS-001-docs-rag-service.md
downstream:
  - 12_validation/VAL-TASK-001-ips-adoption.md
related_adrs:
  - 07_decisions/ADR-001-documentation-rag-service.md
```

## Levels
Documentation validation, pre-coding validation, Jest unit validation, TypeScript build validation, and deployment health validation when deployment is requested.

## Evidence Location
Gate reports are written to `reports/validation/`. Task validation reports are written under `12_validation/`.

## Validation
This pyramid is validated when each task report states which levels were executed or why a level was not applicable.
