## Role
Documentation and Cutover Readiness Implementation Agent.

## Start Condition
Run in parallel with TG-2.1 after Phase 1 approval.

## Scope

- Align cross-service docs with implemented marketing/notifications/auth/leads contracts.
- Prepare final cutover checklist for Sync E.
- Ensure flipflop email identity migration docs consistently target AWS SES.

## Inputs

- `docs/agents/contracts/phase-1-validation-report.md`
- `docs/agents/contracts/phase-1-e2e-evidence.md`
- Current docs in:
  - marketing-microservice
  - notifications-microservice
  - auth-microservice
  - flipflop-service (`README.md`, `docs/ENV_VARIABLES.md`, `docs/EXTERNAL_MICROSERVICES_INTEGRATION.md`)

## Must Deliver

- Doc updates for:
  - marketing campaign and consent flow
  - notifications channel registry usage (`channelKey`, purpose, fallback path)
  - auth/leads preference ownership boundaries
  - flipflop SES migration statement (remove SendGrid identity as active target)
- `docs/agents/contracts/phase-2-cutover-checklist.md` with:
  - pre-deploy checks
  - rollout checks
  - rollback triggers
  - post-deploy validation checks

## Hard Constraints

- No secrets or credential values in docs.
- Keep statements consistent with implemented runtime behavior.
- Do not invent unsupported endpoints.

## Exit Criteria

- Required docs updated and internally consistent.
- Cutover checklist is actionable and ordered.
- Validator can trace every checklist item to a contract or implementation artifact.
