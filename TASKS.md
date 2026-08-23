# TASKS.md

## Active IPS-governed tasks

- **OPEN — verify recovery.** Confirm the forced re-ingest completes with all 40
  repos, that `shared/CLAUDE.md` is retrievable (it was never indexed — the
  markdown walker skipped symlinks), and that the deleted
  `feedback_no_git_commit.md` chunks are gone. Then set STATE.json health to
  `ok`. Until then the index must be treated as incomplete.

New implementation work must start with an approved IPS task, goal-impact record, execution plan, and validation plan before runtime code changes.

## Backlog

New implementation work must start with an IPS task, goal-impact record, execution plan, and validation plan before runtime code changes.

## Completed

- 2026-06-19 `TASK-001` Intent Preservation System adoption completed and validated. Artifacts: `docs/11_tasks/TASK-001-implement-ips-standard.md`, `docs/21_execution_plans/EP-TASK-001-implement-ips-standard.md`, `docs/22_goal_impact/GOAL-IMPACT-TASK-001.md`, `docs/12_validation/VAL-TASK-001-ips-adoption.md`.

## Project Completion Marker

- 2026-06-21: Project marked completed/frozen after remote inventory.
- **2026-08-23: UNFROZEN.** The "frozen" marker above was misleading: the service
  kept answering queries while its index silently stopped refreshing on
  2026-07-16 (38 days). A frozen *project* is not a frozen *index* — this one
  degraded into confident misinformation, which is worse than an outage because
  nothing surfaces it. Reopened for recovery; see docs/SOURCE_OF_TRUTH.md.
