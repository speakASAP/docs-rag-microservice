# BUSINESS.md

## Goal

Provide a reliable shared prompt workspace for internal users, available at `prompts.alfares.cz`, so prompts are accessible across machines and environments.

## Outcomes

- Centralized prompt storage with secure per-user access
- Faster reuse of high-value prompts and internal rules
- Reduced prompt duplication and local-file drift

## Constraints

- Authentication required via shared auth platform
- PostgreSQL-backed persistence
- Blue/green deployment via nginx-microservice
- No secrets in repository
