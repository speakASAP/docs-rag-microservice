# Marketing Orchestrator Execution Pack

## Scope

This file executes the first mandatory action from `docs/agents/master-prompt.md`:

1. Read required ecosystem docs.
2. Produce Phase 0 plan.
3. Define Sync A freeze criteria.
4. Provide implementation and validator prompts.

Global alignment source: `shared/docs/ECOSYSTEM_REFACTOR_MASTER_PROMPT.md` (Sync A-F).

## Dependency Graph

```text
Global Sync A contracts (ecosystem) -> Marketing local Sync A (this pack)
Marketing local Sync A -> Phase 1A notifications channel registry work
Marketing local Sync A -> Phase 1B auth/leads preference contracts implementation
Phase 1A + Phase 1B -> Phase 1C marketing-microservice scaffold and core flows
Phase 1C -> Sync D minimal end-to-end campaign
Sync D -> Sync E observability and spam-risk hardening
```

## Phase 0 Plan (Contracts and Data Models)

- TG-0.1 Contract Catalog (parallel: YES)
  - Dependencies: global Sync A vocabulary.
  - Outputs:
    - Canonical DTO set for `channel registry`, `campaign`, `segment`, `delivery`, `consent`, `unsubscribe`.
    - Endpoint matrix for `marketing`, `notifications`, `auth`, `leads`, `orders`.
  - Planned agents: 1 implementation + 1 validator.

- TG-0.2 Data Model Boundaries (parallel: YES)
  - Dependencies: TG-0.1 DTO draft.
  - Outputs:
    - Ownership matrix (single source of truth per field).
    - Allowed write paths and forbidden write paths.
  - Planned agents: 1 implementation + 1 validator.

- TG-0.3 Runtime Policy Contracts (parallel: YES)
  - Dependencies: TG-0.1 DTO draft.
  - Outputs:
    - Channel selection policy contract (`preferred_channel` vs `effective_channel` reason).
    - Consent enforcement contract (registered users from auth, leads from leads service).
    - Batch and timeout policy contract (`<=30` recipients per send call).
  - Planned agents: 1 implementation + 1 validator.

- TG-0.4 Integration Contracts Freeze (parallel: NO)
  - Dependencies: TG-0.1, TG-0.2, TG-0.3 approved.
  - Outputs:
    - Frozen OpenAPI-like contract document for inter-service calls.
    - Sync A signoff checklist with pass/fail gates.
  - Planned agents: 1 implementation + 1 validator.

## External APIs Required by Marketing Microservice

- `notifications-microservice`
  - `POST /notifications/send` (must support `channelKey`, `purpose`, optional sender overrides, backward compatible default path).
- `auth-microservice`
  - Read user channel preferences and marketing consents.
  - Update consent/unsubscribe states from marketing flows.
- `leads-microservice`
  - Read lead contacts, channel preferences, and consent fields for non-registered contacts.
- `orders-microservice` (or channel app API where needed)
  - Read order events/attributes for segmentation predicates.

## Sync A Freeze Criteria (Pass/Fail)

Sync A is approved only if all criteria pass:

1. Contract completeness
   - Channel registry schema defined with key/type/provider/purposes/app permissions/active metadata.
   - Campaign and segment schemas defined with scheduling, throttling, channel strategy, and purpose.
   - Preference and consent schemas defined for both auth users and leads.

2. Ownership clarity
   - Auth remains source of truth for registered identity preferences.
   - Leads remains source of truth for non-registered contact preferences.
   - Marketing stores campaign/segment/execution data, not duplicate identity master data.
   - Notifications remains sole outbound sending layer.

3. Backward compatibility
   - `POST /notifications/send` default behavior is documented when `channelKey` is absent.
   - Auth and leads existing consumers are not broken by new optional fields.

4. Operational rules encoded
   - Batch size contract hard-coded in spec as `max 30`.
   - Timeout handling strategy defined as chunking/background execution, no timeout increases.
   - Logging contract includes ISO timestamp + `duration_ms` + decision reason fields.

5. Validation readiness
   - Validator checklist exists and is executable without assumptions.
   - Rejection loop process defined (issue list -> fix -> re-validate).

## Phase 1 Task Groups (Unlocked only after Sync A PASS)

- TG-1.1 Notifications Channel Registry Implementation (parallel: YES after Sync A)
  - Outputs: DB model, service, admin UI pages, `send` contract extension, migration plan from env defaults.
- TG-1.2 Auth and Leads Preference APIs (parallel: YES after Sync A)
  - Outputs: nullable preference/consent fields and secure read/update APIs.
- TG-1.3 Marketing Scaffold and Core Engine (parallel: PARTIAL after Sync A)
  - Outputs: service scaffold per `shared/docs/CREATE_SERVICE.md`, campaign/segment CRUD, batch executor.
- TG-1.4 End-to-End Integration Validation (parallel: NO)
  - Outputs: one live campaign flow in staging with logs and unsubscribe behavior.

## Agent Prompt Files

- Implementation prompt: `docs/agents/prompts/sync-a-contracts-implementation.md`
- Validator prompt: `docs/agents/prompts/sync-a-contracts-validator.md`

