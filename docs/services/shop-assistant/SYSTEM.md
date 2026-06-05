# System: shop-assistant

## Architecture

NestJS backend + Next.js frontend + PostgreSQL + Prisma. Kubernetes (`statex-apps`). Port 4500.

- ASR (voice → text) via ai-microservice
- LLM query refinement via ai-microservice
- External search: Serper API
- User search profiles stored in DB

## Integrations

| Service | Usage |
|---------|-------|
| auth-microservice:3370 | User auth |
| database-server:5432 | PostgreSQL |
| logging-microservice:3367 | Logs |
| ai-microservice:3380 | ASR + LLM |

## Current State
<!-- AI-maintained -->
Stage: active

## Known Issues
<!-- AI-maintained -->
- None
