# AI Agent Tasking Guide

## Purpose

This document is for breaking implementation into coding-agent tasks.

## Rules for agent tasks

Each task must be:

- small
- isolated
- testable
- based on documented contract
- not dependent on vague product decisions
- limited to a small file set where possible

## Task prompt template

```text
You are implementing [feature].

Context:
- Read docs/[relevant docs].
- Follow API contracts in docs/32-api-rest-contracts.md.
- Follow security model in docs/40-security-model.md.

Goal:
[clear goal]

Scope:
- Include:
- Exclude:

Files to create/change:
- ...

Acceptance criteria:
- ...

Tests:
- ...
```

## Good task example

```text
Implement QR payment payload generator.

Context:
- docs/17-payment-architecture-cz.md
- docs/44-payment-accounting-and-reconciliation.md

Goal:
Create a TypeScript utility that generates QR Platba payload from payment intent.

Acceptance criteria:
- supports account, amount, currency, variable symbol, message
- validates CZK amount > 0
- unit tests for normal and invalid inputs
- no secrets in frontend
```

## Bad task example

```text
Build the payment system.
```

Too broad.

## Recommended implementation order

1. repository scaffold
2. shared types
3. API client shell
4. auth integration
5. onboarding
6. layout/navigation
7. tasks
8. QR payments
9. feedback
10. reports
11. admin panel
12. audit logging
13. deployment manifests
