# BPCP Holiday Discount Adoption

Status: service-local adoption contract
Date: 2026-07-02
Service: `docs-rag-microservice`
Central contract pack: `statex-ecosystem/docs/business-process-control-plane/`

## Role

Documentation retrieval/indexing consumer for BPCP docs and adoption contracts.

## Responsibilities

- Index central BPCP docs and service-local adoption docs.
- Support retrieval for future agents.
- Avoid becoming canonical source of process truth.

## Required interfaces

- Docs ingestion paths for `docs/business-process-control-plane/`.
- Search/retrieval references to central contract pack.
- Redaction-safe indexing.

## Boundaries

- This service must not become the global owner of BPCP process definitions.
- This service must fail closed on invalid or unknown BPCP process versions.
- This service must keep existing domain ownership and invariants.
- This service must expose or document dry-run behavior before live execution.
- This service must not overwrite existing service contracts without an
  explicit integration owner and validation owner.

## Holiday Discount pilot expectations

- Recognize `holiday-discount-2026` only through versioned BPCP contracts.
- Preserve `processId`, `processVersion`, and `policyId` in every relevant
  decision, event, snapshot, log, or rendered experience.
- Support rollback by respecting BPCP pause and retired states.
- Keep process display and process execution separate where applicable.

## Blockers and unknowns

- [MISSING: current ingestion schedule and target paths]

## Validation evidence required before implementation is accepted

- Retrieval query finds BPCP central docs.
- Retrieval query finds one service-local adoption doc.
- Indexed docs exclude secrets.

## Parallel handoff

This adoption doc is safe for a focused service owner to implement in parallel
after the central BPCP schemas are accepted. The service owner must not edit
shared BPCP schemas directly; schema changes go through the BPCP integration
owner.
