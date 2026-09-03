

# Tasks: docs-rag-microservice

## Active

No active task. Catalog-authoritative ingestion trigger hardening and Wave 0 v1 registry artifacts are implemented, deployed and verified in production (2026-09-03).


## Ready next

- Keep the shared repository catalog current when onboarding wisdom-quotes and future services.


## Blocked

No known blockers are recorded; validation debt is tracked separately when discovered.


## Completed


- Verified in production on 2026-09-03 that a rerun wisdom-quotes ingestion trigger records the mounted checkout HEAD SHA: job `2ec2daf4-26f6-432a-a21f-4c7d6d2263e8` completed 49/49 chunks with `lastCommitHash` `8b2a30122199506e37855e4c5ead17725632bff7`, matching both the mounted checkout and the host repository HEAD. Earlier jobs recorded the previous HEAD `32e21a34`, confirming the value tracks the checkout rather than a constant. Across the whole database, 0 of 6,090 completed jobs are missing a commit hash.
- Closed the RAG production migration plan by measuring the four metrics it was missing: 56,348 chunks across 51 repositories, median search latency 59 ms, chunk count identical across a pod replacement, and end-to-end retrieval plus ingestion working with unauthenticated requests still refused with 401.


- Enforced catalog authority for `triggerIngestion`: every trigger now requires a registered repository catalog entry with `docsRag: true`, independent of request `repoUrl`/`localPath` hints.
- Preserved mounted checkout mechanics (including checkout alias resolution) and retained client local-path override rejection against the catalog-approved path.
- Added/updated targeted ingestion tests to reject unregistered remote URLs, retain unregistered local rejection, and confirm registered catalog remote/local requests resolve to catalog-approved sources.
- Normalized `STATE.json` to shared Wave 0 v1 structure while preserving factual ingestion lifecycle context in compatibility text.
- Added `docs/registry/REPOSITORY_PROFILE.json` and `docs/registry/ARTIFACT_INDEX.json` with a narrow documentation allowlist and strict exclusions for secrets/keys/logs/customer data/db dumps/vector index storage/node_modules/coverage/source/runtime/deploy config.
- Validated targeted ingestion suites, TypeScript build, JSON parsing, profile/index validation, and deterministic artifact index ordering.
- Preserved the existing documentation-audit validation debt entry `VDEBT-2026-08-31-IPS-DOC-AUDIT`.


## Handoff


No secrets or raw production data were recorded. Validation evidence is command-line only and references repository-local outputs.
