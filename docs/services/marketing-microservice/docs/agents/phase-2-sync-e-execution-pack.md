# Marketing Phase 2 Sync E Execution Pack

## Scope

This pack executes the next step after approved Phase 1 E2E validation:

1. Finalize Sync D handoff and activate Sync E work.
2. Implement observability and spam-risk hardening.
3. Produce deployment-readiness validation and cutover checklist.

## Entry Gate

- Required: `docs/agents/contracts/phase-1-validation-report.md`
- Required decision: `APPROVED`

## Dependency and Run Order

```text
TG-2.1 observability and spam-risk hardening implementation -> TG-2.1 validator
TG-2.2 docs and cutover checklist implementation -> TG-2.2 validator
TG-2.3 sync-e final validation and freeze candidate (starts after TG-2.1 + TG-2.2 pass)
```

## Task Groups

- TG-2.1 Observability and Spam-Risk Hardening
  - Execution: `docs/agents/prompts/phase-2-observability-implementation.md`
  - Gate: `docs/agents/prompts/phase-2-observability-validator.md`
  - Exit: campaign and delivery observability fields are complete; spam-risk controls are enforceable and auditable.

- TG-2.2 Documentation and Cutover Readiness
  - Execution: `docs/agents/prompts/phase-2-docs-cutover-implementation.md`
  - Gate: `docs/agents/prompts/phase-2-docs-cutover-validator.md`
  - Exit: required docs updated (including flipflop SES migration references) and operations checklist is executable.

- TG-2.3 Sync E Final Freeze
  - Execution: `docs/agents/prompts/phase-2-sync-e-freeze-implementation.md`
  - Gate: `docs/agents/prompts/phase-2-sync-e-freeze-validator.md`
  - Exit: explicit Sync E decision report with approve/reject outcome and issue loop.

## Required Control Rules

- No timeout increases; verify bottlenecks from logs and fix root cause.
- Keep recipient batch size `<=30` per notifications send call.
- Keep notifications-microservice as the only outbound sender.
- Keep auth/leads ownership boundaries for identity, preferences, and consent.
- No secrets in docs or contracts.
