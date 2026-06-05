## Role
Phase 1 End-to-End Integration Implementation Agent.

## Start Condition
Run only after TG-1.1, TG-1.2, and TG-1.3 validator approvals.

## Scope

- Execute one staging-like campaign flow end-to-end.
- Verify inter-service behavior for:
  - segment resolution,
  - consent evaluation (auth and leads paths),
  - notifications send with and without `channelKey`,
  - unsubscribe update and re-run behavior,
  - required logging fields.

## Inputs

- `docs/agents/phase-1-execution-pack.md`
- `docs/agents/contracts/sync-a-validation-report.md`
- TG-1.1/1.2/1.3 validator reports and implementation outputs

## Must Deliver

- `docs/agents/contracts/phase-1-e2e-evidence.md` containing:
  - campaign test scenario,
  - request/response evidence for integration calls,
  - evidence of `<=30` batch behavior,
  - evidence of consent and unsubscribe enforcement,
  - evidence of ISO timestamp and `duration_ms` logging fields.
- `docs/agents/contracts/phase-1-e2e-freeze-candidate.md` with pass/fail matrix for TG-1.4.

## Constraints

- Solve causes, not consequences.
- Do not increase timeouts.
- Use existing scripts and endpoints where available.
- No secrets in evidence artifacts.
