# Business: docs-rag-microservice

```yaml
id: BUSINESS-docs-rag-microservice
status: approved
owner: project owner
created: 2026-06-13
last_updated: 2026-08-30
completeness_level: complete
upstream:
  - docs/01_vision/VISION.md
  - docs/00_constitution/CONSTITUTION.md
downstream:
  - SYSTEM.md
  - docs/22_goal_impact/GOAL-IMPACT-TASK-001.md
```

## Problem

Reading large sets of ecosystem Git documentation for every agent question consumes unnecessary context and token budget. Agents need bounded discovery while repositories remain authoritative.

## Target users and stakeholders

- AI agents and ecosystem services needing focused documentation discovery.
- Repository owners whose Git documentation remains the source of truth.
- Platform operators responsible for the service, PostgreSQL, Qdrant, and embeddings.

## Value proposition

The service provides cached ecosystem knowledge through RAG instead of raw Git reads. Every agent query that uses this service instead of reading files saves approximately 2,000-5,000 tokens.

## Goals

- Provide bounded semantic discovery over ecosystem Git documentation.
- Return token-bounded candidate context with source paths for direct Git verification.
- Preserve Git repositories as the documentation authority.
- Reduce agent token use by approximately 2,000-5,000 tokens for each avoided raw read.

## Non-goals

- Becoming a competing source of truth for ecosystem documentation.
- Replacing graph-first IPS traceability, Git review, deployment configuration, or runtime evidence.
- Exposing unauthenticated ingestion or retrieval operations.
- Indexing copied ecosystem documentation snapshots as an authority.

## Success metrics

- Each agent query that avoids raw file reads through this service saves approximately 2,000-5,000 tokens.

## Business constraints

- Git remains authoritative; retrieval is advisory candidate context.
- Unconfident or unavailable retrieval requires direct Git fallback.
- Secrets, tokens, raw production documents, customer data, and sensitive embeddings must not appear in logs or documentation.
- Repository participation is controlled by the shared repository catalog.

## Approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: docs-rag-microservice-onboarding-approved
