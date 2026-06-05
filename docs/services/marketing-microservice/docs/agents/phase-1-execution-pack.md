# Marketing Phase 1 Execution Pack

## Scope

This pack activates Phase 1 task groups after approved Sync A contracts.

## Entry Gate

- Required: `docs/agents/contracts/sync-a-validation-report.md`
- Required decision: `APPROVED`

## Dependency and Run Order

```text
TG-1.1 notifications implementation -> TG-1.1 validator
TG-1.2 auth/leads implementation -> TG-1.2 validator
TG-1.3 marketing core implementation (starts after TG-1.1 + TG-1.2 validator pass) -> TG-1.3 validator
TG-1.4 end-to-end integration validation (starts after TG-1.3 validator pass)
```

## Task Groups

- TG-1.1 Notifications Channel Registry
  - Execution: `docs/agents/prompts/phase-1-notifications-implementation.md`
  - Gate: `docs/agents/prompts/phase-1-notifications-validator.md`
  - Exit: DB-backed channel registry and non-breaking send fallback verified.

- TG-1.2 Auth and Leads Preferences
  - Execution: `docs/agents/prompts/phase-1-auth-leads-implementation.md`
  - Gate: `docs/agents/prompts/phase-1-auth-leads-validator.md`
  - Exit: Additive preference/consent APIs for auth users and leads verified.

- TG-1.3 Marketing Core
  - Execution: `docs/agents/prompts/phase-1-marketing-core-implementation.md`
  - Gate: `docs/agents/prompts/phase-1-marketing-core-validator.md`
  - Exit: campaign/segment core + executor with `<=30` chunking verified.

- TG-1.4 End-to-End Integration
  - Execution: `docs/agents/prompts/phase-1-integration-e2e-implementation.md`
  - Gate: `docs/agents/prompts/phase-1-integration-e2e-validator.md`
  - Exit: one full staging-like campaign flow validated, including consent/unsubscribe and logging.

## Required Control Rules

- No timeout increases; diagnose via logs and fix root cause.
- No direct outbound sending from marketing; notifications only.
- Keep ownership boundaries: auth for registered users, leads for non-registered contacts.
- No secrets in docs or contracts.
