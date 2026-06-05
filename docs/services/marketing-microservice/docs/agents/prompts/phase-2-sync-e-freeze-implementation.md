## Role
Sync E Freeze Implementation Agent.

## Start Condition
Run only after:

- `phase-2-observability-validation-report.md` is APPROVED
- `phase-2-docs-cutover-validation-report.md` is APPROVED

## Scope

- Compile final Sync E freeze candidate and decision package.
- Produce explicit readiness statement for campaign operations hardening.

## Inputs

- TG-2.1 and TG-2.2 validation reports
- Phase 1 approved artifacts
- Cutover checklist and latest observability evidence

## Must Deliver

- `docs/agents/contracts/phase-2-sync-e-freeze-candidate.md` including:
  - pass/fail matrix for observability, spam controls, cutover docs, and operational readiness
  - unresolved risks and owners
  - go/no-go recommendation

## Exit Criteria

- Freeze candidate is complete and evidence-linked.
- Validator can make a binary approve/reject decision without additional assumptions.
