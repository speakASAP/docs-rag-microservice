# Subsystem: Service Identity and Operations

```yaml
id: SUB-003
status: approved
owner: platform-engineering
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - docs/04_systems/SYS-001-docs-rag-service.md
downstream:
  - docs/10_features/FEAT-003-operational-readiness.md
related_adrs:
  - docs/07_decisions/ADR-002-protect-authenticated-retrieval.md
```

## Purpose
Protect service APIs, configure runtime dependencies, and support Kubernetes deployment and validation.

## Parent system
`docs/04_systems/SYS-001-docs-rag-service.md`

## Responsibilities
- Enforce JWT on non-public endpoints.
- Keep `/health` public.
- Source secrets through Vault and Kubernetes Secret flow.
- Build, deploy, and health-check Kubernetes workloads.
- Provide IPS gates for documentation-first delivery.

## Interfaces
`GET /health`, service identity guard, `@Public()`, `scripts/deploy.sh`, Kubernetes manifests, and IPS gate scripts.

## Inputs
JWT secret, environment variables, Kubernetes manifests, deployment tag, and validation commands.

## Outputs
Authenticated request decisions, deployment rollouts, health status, and validation gate reports.

## Dependencies
Vault, External Secrets Operator, Kubernetes, Docker registry, shared deployment timing library, and Node.js runtime.

## Data ownership
Owns operational metadata and validation reports. It does not own application documentation content or secrets.

## Failure modes
JWT secret missing, deployment image failure, rollout failure, health check failure, or IPS gate failure.

## Validation
Validated by build, tests, deployment health check, and IPS gates.
