# System: statex

## Architecture

FastAPI (Python) + Next.js + PostgreSQL + Redis + RabbitMQ + MinIO + Elasticsearch. Multiple internal microservices.

- AI-powered business prototype generation, NLP analysis, document processing
- Multi-tenant SaaS platform

## Integrations

| Service | Usage |
|---------|-------|
| auth-microservice:3370 | User auth |
| database-server:5432 | PostgreSQL + Redis |
| logging-microservice:3367 | Logs |
| notifications-microservice:3368 | User alerts |
| payments-microservice:3468 | Subscription |
| ai-microservice:3380 | All AI features |

## Current State
<!-- AI-maintained -->
Stage: active

## Known Issues
<!-- AI-maintained -->
- None
