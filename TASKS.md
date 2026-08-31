# Tasks

## Active

Read-only mounted repository ingestion fix is implemented and validated in the uncommitted worktree. It awaits owner review/commit; no production ingestion or deployment was triggered.

## Ready next

- Review and commit the mounted-versus-managed Git synchronization change.
- After an authorized deployment, retry wisdom-quotes ingestion and verify its job records the mounted checkout HEAD SHA.
- Keep the shared repository catalog current when onboarding wisdom-quotes and future services.

## Blocked

Production verification is intentionally deferred because this task forbids commit, push, deploy, and ingestion triggers.

## Completed

- Separated allow-listed mounted checkouts from managed writable clones in GitSyncService and ingestion.
- Added read-only HEAD/no-FETCH_HEAD, writable clone/pull, allow-list, traversal, and commit-reuse regression tests.
- Validated 49/49 tests and the TypeScript build; no source lint script/configuration exists.
- Recorded the pre-existing 47-finding IPS documentation audit failure as validation debt.
- Loaded sources from the shared repository catalog.
- Reindexed registered repositories and agent profiles from direct paths.
- Excluded AppleDouble files and retired the copied docs/services snapshot.
- Completed IPS documentation adoption for this already-running production service.

## Handoff

Changed source and tests are uncommitted by request. Validation used repository-local test scratch paths and left no scratch files. The pre-existing IPS documentation audit failure is recorded in `docs/orchestrator/VALIDATION_DEBT.md` and does not touch this change.
