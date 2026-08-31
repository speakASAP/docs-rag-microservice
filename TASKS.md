# Tasks

## Active
Catalog-authoritative ingestion trigger hardening and Wave 0 v1 registry artifacts are implemented and being validated for commit/deploy completion.

## Ready Next
- After deployment, rerun a wisdom-quotes ingestion trigger and verify the completed job records the mounted checkout HEAD SHA.
- Keep the shared repository catalog current when onboarding wisdom-quotes and future services.

## Blocked
No known blockers are recorded; validation debt is tracked separately when discovered.

## Completed

- Enforced catalog authority for `triggerIngestion`: every trigger now requires a registered repository catalog entry with `docsRag: true`, independent of request `repoUrl`/`localPath` hints.
- Preserved mounted checkout mechanics (including checkout alias resolution) and retained client local-path override rejection against the catalog-approved path.
- Added/updated targeted ingestion tests to reject unregistered remote URLs, retain unregistered local rejection, and confirm registered catalog remote/local requests resolve to catalog-approved sources.
- Normalized `STATE.json` to shared Wave 0 v1 structure while preserving factual ingestion lifecycle context in compatibility text.
- Added `docs/registry/REPOSITORY_PROFILE.json` and `docs/registry/ARTIFACT_INDEX.json` with a narrow documentation allowlist and strict exclusions for secrets/keys/logs/customer data/db dumps/vector index storage/node_modules/coverage/source/runtime/deploy config.
- Validated targeted ingestion suites, TypeScript build, JSON parsing, profile/index validation, and deterministic artifact index ordering.
- Preserved the existing documentation-audit validation debt entry `VDEBT-2026-08-31-IPS-DOC-AUDIT`.

## Handoff

No secrets or raw production data were recorded. Validation evidence is command-line only and references repository-local outputs.
