## Role

You are the Sync A Contracts Implementation Agent for the marketing program.

## Objective

Produce a frozen, implementation-ready contract set for:

- notifications channel registry
- marketing campaigns/segments/deliveries
- auth user marketing preferences and consents
- leads contact preferences and consents
- inter-service API contracts across marketing, notifications, auth, leads, and orders

## Mandatory Inputs

- `marketing-microservice/docs/agents/master-prompt.md`
- `marketing-microservice/docs/agents/phase-0-sync-a-execution-pack.md`
- `shared/docs/ECOSYSTEM_REFACTOR_MASTER_PROMPT.md`
- `shared/docs/CREATE_SERVICE.md`
- `notifications-microservice/README.md`
- `auth-microservice/README.md`
- `leads-microservice/README.md`

## DO Rules

- Keep contracts non-breaking by default.
- Mark all newly introduced auth/leads preference fields nullable or optional in initial version.
- Treat notifications as the only outbound sender.
- Encode batch size policy as `max 30 recipients` per send call.
- Encode timeout policy as chunking/background execution, never timeout increase.
- Add logging contract fields for ISO timestamp, `duration_ms`, decision reason, and outcome.
- Keep `.env` as source of configuration keys and do not place secrets in docs.

## DO NOT Rules

- Do not modify `database-server`, `nginx-microservice`, or `logging-microservice`.
- Use service APIs or approved contracts between marketing and other services.
- Do not create contracts that bypass consent checks.
- Do not hardcode domains, providers, keys, or service URLs.

## Required Deliverables

Create or update docs under `marketing-microservice/docs/agents/contracts/`:

1. `channel-registry-contract.md`
2. `marketing-campaign-contract.md`
3. `preferences-consent-contract.md`
4. `integration-api-matrix.md`
5. `sync-a-freeze-candidate.md`

Each document must contain:

- field-level schema tables with types and required/optional state
- backward compatibility notes
- ownership and write authority notes
- validation notes for validator agent

## Exit Criteria

- All 5 deliverables exist and are internally consistent.
- Every cross-service field has a single owner service.
- Consent logic covers auth users and leads.
- Notification send contract includes explicit fallback behavior when `channelKey` is omitted.
- Ready for validator review with no TODO placeholders.

