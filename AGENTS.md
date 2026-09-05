# Repository Agent Instructions

## Required reading

Read shared documentation authority, the ecosystem map, BUSINESS.md, SYSTEM.md, docs/SOURCE_OF_TRUTH.md, AGENT_OPERATIONS.md, TASKS.md, STATE.json, and the IPS adoption standard.

## Authority

Git is authoritative and docs-RAG is a derived projection. Use retrieval for discovery, then verify critical claims at returned paths. Retrieval failure or low confidence is not evidence of absence.

For every service-to-service call, use the sole [Service Identity Consumer Standard](../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md); this repository defines no separate service credential or authorization model.

## Intent preservation system

Preserve Vision to Goal Impact to System to Feature to Task to Execution Plan to Coding Prompt to Code to Validation. Follow task, plan, and validation artifacts before changing behavior.

## Safety and operations

Do not print credentials, sensitive embeddings, raw production documents, or customer data. Do not recreate snapshots, trigger ingestion, operate the deploy queue, or modify Ollama during documentation-only work.

## Project-specific rules

Participation comes only from the shared repository catalog; only docsRag true entries are indexed. Preserve AppleDouble and retired snapshot exclusions. Unconfident responses require Git fallback.

## Required final report

Report changed files, validation evidence, validation debt, blockers, deviations, and the next action.
