# Project Invariants

```yaml
id: GOV-INVARIANTS-001
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - docs/00_constitution/CONSTITUTION.md
  - docs/01_vision/VISION.md
downstream:
  - docs/21_execution_plans/EP-TASK-001-implement-ips-standard.md
related_adrs:
  - docs/07_decisions/ADR-001-documentation-rag-service.md
  - docs/07_decisions/ADR-002-protect-authenticated-retrieval.md
```

## Purpose
Project invariants define rules that implementation work must preserve.

## Invariants
| ID | Level | Source document | Rule | Forbidden outcome | Validation method | Gate applicability | Owner |
|---|---|---|---|---|---|---|---|
| DRAG-INV-001 | vision | `docs/01_vision/VISION.md` | Retrieval work must preserve source attribution and traceability to repository documentation. | Agent-context output hides source identity. | Retrieval tests and validation review. | Pre-coding, deployment-readiness | platform-engineering |
| DRAG-INV-002 | architecture | `docs/07_decisions/ADR-002-protect-authenticated-retrieval.md` | Ingestion and retrieval endpoints require service JWT; `/health` remains public. | Public unauthenticated retrieval or ingestion. | Auth tests and controller review. | Pre-coding, deployment-readiness | platform-engineering |
| DRAG-INV-003 | operational | `docs/23_documentation_contracts/SENSITIVE_DATA_POLICY.md` | Secrets and raw production data must not appear in artifacts. | Real credentials or customer data committed. | Sensitive-data scan and review. | Pre-coding, deployment-readiness | platform-engineering |
| DRAG-INV-004 | product | `docs/01_vision/VISION.md` | Source repositories remain authoritative over indexed copies and RAG output. | RAG output treated as source-of-truth replacement. | Documentation review and agent rules. | Pre-coding | platform-engineering |
| DRAG-INV-005 | operational | `docs/23_documentation_contracts/OPERATIONAL_GATE_STANDARD.md` | Deployment or closure requires validation evidence. | Changes closed without evidence. | Validation report and gate reports. | Deployment-readiness | platform-engineering |

## Gate Usage
Pre-coding gates verify this document exists and task plans reference applicable invariants. Deployment gates verify validation evidence exists before release or closure.

## Validation
Validated by `scripts/pre_coding_gate.py` and `scripts/deployment_readiness_gate.py`.
