# Vision: docs-rag-microservice

status: approved
completeness_level: complete

## One-sentence vision

Give agents bounded semantic discovery over ecosystem Git documentation so they can avoid unnecessary raw reads without displacing repository authority.

## Problem statement

Broad raw Git reading consumes agent context and tokens. Agents need focused candidate context while critical facts remain verifiable at the authoritative source path.

## Target users

AI agents, ecosystem services, repository owners, and platform operators.

## Core user need

A focused, source-attributed documentation result that can reduce unnecessary raw reading and still directs the user to Git for verification.

## Key outcomes

- Catalog-scoped semantic discovery over Markdown and MDX.
- Token-bounded context with source paths.
- Approximately 2,000-5,000 tokens saved per avoided raw Git read.
- Git authority preserved when retrieval is unavailable or unconfident.

## Non-goals

Replacing Git authority, IPS graph traceability, deployment evidence, or runtime evidence; unauthenticated retrieval; copied snapshot authority.

## Success criteria

Successful avoided raw reads save approximately 2,000-5,000 tokens, retrieval remains source-attributed, and weak or unavailable results require Git fallback.

## Approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: docs-rag-microservice-onboarding-approved
