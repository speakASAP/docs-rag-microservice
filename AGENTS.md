# Repository Agent Instructions

## Read first

1. `../shared/docs/DOCUMENTATION_AUTHORITY.md`
2. `../shared/ECOSYSTEM_MAP.md`
3. `BUSINESS.md`
4. `SYSTEM.md`
5. `docs/SOURCE_OF_TRUTH.md`
6. `AGENT_OPERATIONS.md`
7. `TASKS.md` and `STATE.json`

## Boundaries

- Git is authoritative; docs-RAG is a derived projection.
- Use retrieval for discovery and bounded context, then verify critical claims
  against returned repository paths.
- A retrieval failure or `confident: false` is not evidence that documentation
  does not exist.
- Repository participation comes only from
  `shared/config/ecosystem-repositories.json`.
- Do not recreate or ingest copied ecosystem snapshots.
- Do not print service tokens, embeddings containing sensitive text, raw
  production documents or customer data.

## Commands

```bash
npm test
npm run build
npm run docs:audit
npm run gate:pre-coding
npm run gate:deployment -- --target <TASK-ID>
```

Deployment uses the shared runner. Trigger ingestion only with a token supplied
through a protected file or process input, never a command-line literal.

## Intent Preservation System

Preserve graph-first traceability:

```text
Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation
```

Vector retrieval is optional semantic enrichment after mandatory graph links.
Follow the repository IPS task, plan and validation artifacts before changing
ingestion or retrieval behavior.
