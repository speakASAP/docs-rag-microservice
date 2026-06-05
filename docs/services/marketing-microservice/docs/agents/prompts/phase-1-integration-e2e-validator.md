## Role
Phase 1 End-to-End Integration Validator Agent.

## Start Condition
Validate only after TG-1.4 implementation handoff.

## Validate

- Evidence includes one complete campaign flow from segment to send outcome.
- Consent checks are enforced for both auth users and leads.
- Unsubscribe update is enforced on subsequent execution.
- Notifications send path remains non-breaking when `channelKey` is omitted.
- Logging evidence includes ISO timestamp and `duration_ms`.
- Batch behavior demonstrates `<=30` recipients per send call.

## Checks

- Review:
  - `docs/agents/contracts/phase-1-e2e-evidence.md`
  - `docs/agents/contracts/phase-1-e2e-freeze-candidate.md`
  - TG-1.1/1.2/1.3 validator outputs
- Confirm no ownership contract violation or direct DB bypass between services.
- Confirm no timeout-increase workaround was introduced.

## Result

Write `docs/agents/contracts/phase-1-validation-report.md` with:

- decision: APPROVED or REJECTED
- checklist table with pass/fail
- issues list with severity/file/required fix (if rejected)
- recommendation: proceed to Sync D/next phase or return to owning implementation task group
