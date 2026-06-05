# Project OS (`business-orchestrator`) — Agent Tasks Index

**Lead prompt:** [master-prompt.md](./master-prompt.md) · **Plan:** [../orchestrator-lead/MASTER_PLAN.md](../orchestrator-lead/MASTER_PLAN.md)

Each task must keep Implementation + Validator pair:

- `AGENT{NN}_*.md` (implementation)
- `AGENT{NN}V_*_VALIDATE.md` (validation)

Advance only when validator is **PASS**.

## Active operating mode

- Program lifecycle is complete (`programme_complete` in `PROGRESS_STATE.json`).
- Runtime currently uses mitigation cadence (root `STATE.json`).
- New `TASK-*` sequences may be created only for explicitly approved new objectives.

## Canonical active tracks

| Task ID | Implementation | Validator | Status |
|---------|----------------|-----------|--------|
| TASK-NOTIF-B | [AGENT90_NOTIFICATION_RETRY.md](./AGENT90_NOTIFICATION_RETRY.md) | [AGENT90V_NOTIFICATION_RETRY_VALIDATE.md](./AGENT90V_NOTIFICATION_RETRY_VALIDATE.md) | done/pass |
| TASK-AGENTMGMT-A | [AGENT91_AGENT_STATUS_ENDPOINT.md](./AGENT91_AGENT_STATUS_ENDPOINT.md) | [AGENT91V_AGENT_STATUS_ENDPOINT_VALIDATE.md](./AGENT91V_AGENT_STATUS_ENDPOINT_VALIDATE.md) | done/pass |
| TASK-AGENTMGMT-B | [AGENT92_AGENT_DISABLE_ENABLE.md](./AGENT92_AGENT_DISABLE_ENABLE.md) | [AGENT92V_AGENT_DISABLE_ENABLE_VALIDATE.md](./AGENT92V_AGENT_DISABLE_ENABLE_VALIDATE.md) | done/pass |
| TASK-RESILIENCE-A | [AGENT93_CIRCUIT_BREAKER.md](./AGENT93_CIRCUIT_BREAKER.md) | [AGENT93V_CIRCUIT_BREAKER_VALIDATE.md](./AGENT93V_CIRCUIT_BREAKER_VALIDATE.md) | done/pass |
| TASK-PF-01 | [AGENT51_PORTFOLIO_CONTRACTS.md](./AGENT51_PORTFOLIO_CONTRACTS.md) | [AGENT51V_PORTFOLIO_CONTRACTS_VALIDATE.md](./AGENT51V_PORTFOLIO_CONTRACTS_VALIDATE.md) | done/pass |
| TASK-PF-02 | [AGENT52_BUSINESS_PROJECT_LIFECYCLE_API.md](./AGENT52_BUSINESS_PROJECT_LIFECYCLE_API.md) | [AGENT52V_BUSINESS_PROJECT_LIFECYCLE_API_VALIDATE.md](./AGENT52V_BUSINESS_PROJECT_LIFECYCLE_API_VALIDATE.md) | done/pass |
| TASK-PF-03 | [AGENT53_PORTFOLIO_CARD_DASHBOARD_UI.md](./AGENT53_PORTFOLIO_CARD_DASHBOARD_UI.md) | [AGENT53V_PORTFOLIO_CARD_DASHBOARD_UI_VALIDATE.md](./AGENT53V_PORTFOLIO_CARD_DASHBOARD_UI_VALIDATE.md) | done/pass |
| TASK-PF-04 | [AGENT54_COMMON_ACTIONS_ONBOARD_OFFBOARD.md](./AGENT54_COMMON_ACTIONS_ONBOARD_OFFBOARD.md) | [AGENT54V_COMMON_ACTIONS_ONBOARD_OFFBOARD_VALIDATE.md](./AGENT54V_COMMON_ACTIONS_ONBOARD_OFFBOARD_VALIDATE.md) | done/pass |

## BAU checks

- Daily: `./scripts/orch-status.sh` and `./scripts/orch-project-health.sh speakasap`
- Weekly: `./scripts/orch-final-validation.sh` and `./scripts/orch-budget-check.sh`

Expected verdicts:

- active projects: `HEALTHY`
- closed projects: `COMPLETED`

Escalate on any `CRITICAL`, budget hard throttle, or repeated timeout pattern.

## Frozen history retention note

Historical phase-by-phase narratives and old task details are frozen and retained in:

- [../orchestrator-lead/PROGRESS_STATE.json](../orchestrator-lead/PROGRESS_STATE.json)
- [../../TASKS.md](../../TASKS.md)
- git history

This index is intentionally kept minimal for active orchestration only.
