# TASKS.md

## Active

- Complete direct-source ingestion from the shared repository catalog.
- Verify every registered source finishes with a non-zero document count.
- Verify `intent-preservation-system` and all operational repositories are
  retrievable from their direct Git paths.
- Verify AppleDouble files no longer fail `speakasap` ingestion.
- Verify no result originates from `docs/services/`.
- Delete the retired tracked snapshot and synchronization script after the
  direct-source validation gate passes.

## Policy

New implementation work requires an IPS task, goal-impact record, execution
plan and validation evidence. Git remains authoritative while ingestion is
degraded.
