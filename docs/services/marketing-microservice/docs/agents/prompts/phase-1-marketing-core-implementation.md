## Role
Marketing Microservice Core Implementation Agent.

## Start Condition
Run only after Sync A approval.

## Scope

- Ensure scaffold matches `shared/docs/CREATE_SERVICE.md`.
- Implement segment and campaign core models and APIs.
- Implement batch execution pipeline to notifications service with max 30 recipients per call.
- Enforce consent/unsubscribe and frequency cap checks before send.

## Inputs

- Sync A contracts
- `shared/docs/CREATE_SERVICE.md`
- `marketing-microservice/docs/agents/master-prompt.md`

## Must Deliver

- Scaffold parity artifacts (README/docs/env example/k8s/deploy/nginx routes)
- Campaign and segment CRUD
- Execution job with idempotency and chunking
- Logging for decision path and send outcomes

## Constraints

- No direct sending from marketing; use notifications API only.
- No timeout increases.
- No hardcoded URLs or credentials.

