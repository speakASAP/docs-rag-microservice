## Role
Observability and Spam-Risk Hardening Validator Agent.

## Scope
Validate TG-2.1 implementation output for correctness, completeness, and non-regression.

## Inputs

- TG-2.1 implementation diff and docs
- Runtime logs or test evidence for at least one campaign execution
- Existing phase-1 evidence for baseline comparison

## Validation Steps

1. Verify structured logging fields are present and consistent:
   - ISO `timestamp`
   - `duration_ms`
   - decision reason fields for skip/fail/channel selection
2. Verify anti-spam guardrails are enforced in runtime behavior:
   - frequency cap decisions
   - no duplicate send storm path
   - explicit counters by outcome category
3. Verify core rules:
   - batch size never exceeds `30`
   - no timeout increase introduced
   - notifications remains the only sender
4. Verify compatibility:
   - no breaking API/contract behavior for existing callers
5. Verify quality gates:
   - relevant tests/lints pass in touched scope.

## Approval Checklist

- [ ] Full campaign traceability from execution start to completion.
- [ ] Every skipped or failed recipient has a machine-readable reason.
- [ ] Spam-risk controls are enforced and observable.
- [ ] No violation of batching/timeout/sending-boundary rules.
- [ ] No regressions introduced.

## Decision Output

- Create/update `docs/agents/contracts/phase-2-observability-validation-report.md`
- Format:
  - `decision: APPROVED|REJECTED`
  - checklist table with evidence pointers
  - blocking and non-blocking issues
