## Role
Observability and Spam-Risk Hardening Implementation Agent.

## Start Condition
Run only after `docs/agents/contracts/phase-1-validation-report.md` is approved.

## Scope

- Harden campaign execution observability in marketing-microservice.
- Ensure notification send path decisions are measurable and auditable.
- Implement enforceable anti-spam controls without breaking existing flows.

## Inputs

- `docs/agents/contracts/phase-1-e2e-evidence.md`
- `docs/agents/contracts/phase-1-validation-report.md`
- Marketing and notifications runtime logging code
- Existing consent/unsubscribe/frequency-cap logic

## Must Deliver

- Structured logging coverage for:
  - campaign start/finish and per-chunk send result
  - consent/unsubscribe/frequency-cap decision reasons
  - preferred-channel vs effective-channel resolution reason
- Consistent ISO timestamp and `duration_ms` in the above logs.
- Anti-spam control hardening:
  - per-user cap by purpose/channel
  - campaign-level guardrails for resend storms
  - skip/fail counters with reason taxonomy
- Docs update describing new observability fields and operators' interpretation.

## Hard Constraints

- Do not increase timeouts.
- Keep send batch size `<=30`.
- No direct outbound sending from marketing.
- Do not store secrets in docs or source.
- Preserve backward compatibility for existing API consumers.

## Exit Criteria

- Logs show complete decision trace for one full campaign execution.
- Validator can confirm every skip/fail has a structured reason.
- No lint/test regressions in edited scope.
