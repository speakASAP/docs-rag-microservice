# Source of Truth - Git, not RAG

## Invariant

Git in each owning repository is the durable source of truth. PostgreSQL,
Qdrant and generated agent context are disposable derived projections.

Deleting the entire index must cost only re-ingestion time. If it would lose
unique information, the architecture has drifted.

## Canonical source selection

Approved repositories and checkout aliases come from:

[`shared/config/ecosystem-repositories.json`](https://github.com/speakASAP/shared/blob/main/config/ecosystem-repositories.json)

Documentation ownership and precedence come from:

[`shared/docs/DOCUMENTATION_AUTHORITY.md`](https://github.com/speakASAP/shared/blob/main/docs/DOCUMENTATION_AUTHORITY.md)

The service indexes each approved repository directly. It does not copy or
index `docs/services/` snapshots because duplicate stale chunks cannot be
reliably ranked below their live sources.

## Failure semantics

- `confident: false`: no sufficiently strong indexed candidate; read Git.
- HTTP 503: retrieval failed; do not interpret it as not found.
- Failed ingestion: that source is degraded until a complete reindex succeeds.
- Missing/renamed checkout: update the shared catalog in the same change.
- Uncommitted documentation: Git remains authoritative, but scheduled
  ingestion may continue to represent the last commit.

## Ingestion safety

Reindex currently replaces each source by deleting prior rows/vectors before
writing new chunks. Therefore:

- process sources sequentially;
- exclude invalid AppleDouble `._*` files;
- validate every catalog checkout;
- never disable scheduling merely to silence failures;
- do not remove a fallback snapshot until direct-source ingestion is complete;
- surface partial or failed sources clearly.

## Retrieval and IPS

Semantic similarity cannot determine mandatory project context. IPS follows
explicit traceability first, then optionally uses vector results for enrichment:

```text
Task -> Feature -> System -> Vision/Goal -> ADRs -> Contracts -> Validation
     -> optional semantic candidates
```

## Drift prevention

- Change documentation only in the repository that owns the subject.
- Keep generated Copilot files as small compatibility pointers.
- Do not duplicate central procedures in agent skills or memories.
- Validate the repository catalog against server checkouts.
- Verify distinctive canonical phrases after reindex.
- Confirm no retrieval result originates from `docs/services/`.
- Keep source commit hashes with chunk metadata for audit.
