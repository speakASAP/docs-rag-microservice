# Tasks: business-orchestrator

## Completed

- [x] 2026-04-17 BAU snapshot: orchestrator healthy, `flipflop-v1=COMPLETED`, `speakasap=HEALTHY`, final validation PASS 13/13, budget OK.
- [x] 2026-05-13 Goals workflow: Added planning stage (queued→planning→approved→active), AI plan review modal, goal CRUD in portfolio cards, dashboard `/goals` and `/tasks` endpoints, populated `#goals`/`#tasks`/`#agents` nav sections.
- [x] 2026-05-13 Goal edit modal: Goals in `#goals` view are now clickable — opens edit modal with full title/description/priority editing. Description visible inline in the table as a summary.

## Backlog

- [ ] BAU-1: Daily monitoring (`orch-status.sh`, `orch-project-health.sh speakasap`) — escalate any DEGRADED/CRITICAL verdict.
- [ ] BAU-2: Weekly integrity run (`orch-final-validation.sh`, `orch-budget-check.sh`) and archive output.
- [ ] BAU-3: Keep `speakasap` as active reference tenant; only re-open `flipflop-v1` goals when new business scope is approved.
- [ ] NXT-1: Next approved business onboarding — use portfolio common actions, then `orch-project-health.sh <new-slug>` baseline.
