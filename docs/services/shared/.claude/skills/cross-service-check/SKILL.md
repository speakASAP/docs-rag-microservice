---
name: cross-service-check
description: Search all Statex microservices for a pattern (function name, DTO field, env var, endpoint path, import) to find cross-service impact before making changes. Usage: /cross-service-check <pattern>
---

Search all repositories under `/home/ssf/Documents/Github/` for the pattern provided by the user.

## How to search (in this order — cheapest first)

### Step 1: Check .env.example files first (fastest, most signal)

Most cross-service dependencies surface as env vars. Search `.env.example` files across all repos first:

```
grep -r "<pattern>" /home/ssf/Documents/Github/*/\.env.example 2>/dev/null
```

If the pattern is a service URL, env var name, or port — `.env.example` results tell you which services depend on it. Stop here if this fully answers the question.

### Step 2: Check docker-compose files

Service-to-service connections are declared in docker-compose configs:

```
grep -r "<pattern>" /home/ssf/Documents/Github/*/docker-compose*.yml 2>/dev/null
```

### Step 3: Search source code (only if steps 1-2 are inconclusive)

Use the Grep tool across `.ts` files, excluding:

- `node_modules/`
- `dist/`
- `.git/`
- `*.lock` and `*.log` files

## What to report

Group results by repository (service name). For each service that has matches:

1. **Service name** and what kind of match was found (import, usage, config, docs)
2. **File paths and line numbers** of each match
3. **Risk level**:
   - HIGH — if the service imports or calls the thing being changed
   - MEDIUM — if the service references it in config/docs
   - LOW — if only found in tests or examples

## Special flags

Always flag explicitly if any matches are found in:

- `auth-microservice` — auth changes affect every other service
- `logging-microservice` — logging DTO changes affect all services
- `payments-microservice` — financial data, security-sensitive
- `nginx-microservice` — routing changes affect all public endpoints

## Output format

```
## Cross-service impact: `<pattern>`

Found in N services:

### HIGH RISK
- **auth-microservice** — `src/auth/auth.service.ts:42` — imports and calls this
- **payments-microservice** — `src/payments/payment.controller.ts:18` — direct dependency

### MEDIUM RISK
- **notifications-microservice** — `.env.example:12` — references this config key

### LOW RISK
- **flipflop-service** — `docs/AGENTS.md:30` — mentioned in documentation

## Recommendation
[What needs to be updated in each affected service]
```
