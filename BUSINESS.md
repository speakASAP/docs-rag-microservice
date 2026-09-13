# Business: docs-rag-microservice

```yaml
id: BUSINESS-docs-rag-microservice
status: approved
owner: project owner
created: 2026-06-13
last_updated: 2026-09-13
completeness_level: complete
upstream:
  - docs/01_vision/VISION.md
  - docs/00_constitution/CONSTITUTION.md
downstream:
  - SYSTEM.md
  - docs/22_goal_impact/GOAL-IMPACT-TASK-001.md
```

## Problem

Reading large sets of ecosystem Git documentation for every agent question consumes unnecessary context and token budget. Agents and AI-enabled services need a controlled way to discover relevant knowledge, while the original repositories remain authoritative. The system also provides a foundation for turning customer-owned documentation into a governed, searchable knowledge base.

## Target users and stakeholders

- AI agents and ecosystem services needing focused documentation discovery through MCP or authenticated service interfaces.
- Repository owners whose Git documentation remains the source of truth.
- Platform operators responsible for the service, PostgreSQL, Qdrant, embeddings, ingestion, and access control.
- Organizations that need their internal documents, procedures, product knowledge, or operational data made available to AI services through a controlled RAG layer.

## Value proposition

The service provides bounded, searchable and provenance-aware knowledge through RAG instead of requiring every agent to read large document collections directly. It gives Alfares agents a shared knowledge layer through MCP and authenticated APIs while keeping Git repositories as the source of truth.

For customers, the same capability can convert approved document collections into a controlled RAG knowledge base that can be consumed by AI agents, the AI microservice, or other AI applications. The value is the complete knowledge pipeline and integration — ingestion, indexing, retrieval, provenance, access control, freshness, and evaluation — rather than a vector database alone.

## Goals

- Provide bounded semantic discovery over ecosystem Git documentation.
- Return token-bounded candidate context with source paths for direct Git verification.
- Preserve Git repositories as the documentation authority.
- Reduce agent token use by approximately 2,000-5,000 tokens for each avoided raw read.
- Make shared knowledge available through stable MCP and service interfaces to current and future agents.
- Preserve source paths, provenance, repository scope, and retrieval boundaries for every result.
- Support controlled ingestion of customer-owned documents as a separately governed knowledge source when explicitly configured.

## Non-goals

- Becoming a competing source of truth for ecosystem documentation.
- Replacing graph-first IPS traceability, Git review, deployment configuration, or runtime evidence.
- Exposing unauthenticated ingestion or retrieval operations.
- Indexing copied ecosystem documentation snapshots as an authority.
- Providing a generic chatbot or autonomous business workflow without an owning service and explicit contracts.
- Claiming that indexed content is current when freshness, ingestion status, or source version has not been verified.

## Success metrics

- Each agent query that avoids raw file reads through this service saves approximately 2,000-5,000 tokens.
- Retrieval returns relevant, source-linked, token-bounded context that agents can verify against the authoritative source.
- MCP and authenticated HTTP consumers can use the same retrieval and ingestion boundaries.
- Ingestion status, freshness, access control, and evaluation results are visible to platform operators.

## Business constraints

- Git remains authoritative; retrieval is advisory candidate context.
- Unconfident or unavailable retrieval requires direct Git fallback.
- Secrets, tokens, raw production documents, customer data, and sensitive embeddings must not appear in logs or documentation.
- Repository participation is controlled by the shared repository catalog.
- Customer data may be indexed only with explicit authorization, tenant/source boundaries, retention rules, and sensitive-data controls.
- RAG retrieval is advisory context; critical decisions must use source verification and applicable business or security policies.

## Commercial opportunity

The service can be positioned as a **controlled enterprise knowledge-to-RAG platform** or **RAG enablement and integration layer**. It is suitable for organizations that have large internal document collections but need to make them usable by AI agents without giving every application direct access to raw repositories or files.

Potential offers include:

- customer-document ingestion and RAG deployment for policies, manuals, procedures, product documentation, or support knowledge;
- a private knowledge layer for AI agents and enterprise assistants;
- integration of customer knowledge with an existing AI gateway, agent platform, MCP ecosystem, or internal applications;
- managed ingestion, freshness monitoring, retrieval evaluation, provenance, access control, and ongoing knowledge-base maintenance.

The service does not need to be sold as a standalone infrastructure component. It is likely stronger as part of a complete AI solution, where it supplies trusted customer context to agents and applications. It can also remain an internal Alfares service while being reused as the knowledge component of customer-specific implementations.

The main competitive risk is that customers may already use managed RAG, enterprise search, vector databases, or platform-native knowledge features. Differentiation should therefore focus on source authority preservation, MCP-native access, repository and tenant boundaries, provenance, freshness, self-hosted deployment, integration with the Alfares AI gateway, and the ability to replace the underlying embedding or vector components.

## Approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: docs-rag-microservice-onboarding-approved
