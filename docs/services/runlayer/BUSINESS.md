# Business: runlayer

> ⚠️ THIS FILE IS IMMUTABLE BY AI. Human owner only.

## Goal

Build and operate an autonomous AI orchestration system that manages 20–50+ businesses in the Statex ecosystem 24/7, minimising human intervention to critical decisions only, while keeping LLM costs near zero through model-tier routing, skills and MCP-based tool use.

## Constraints

- AI agents must NEVER modify this file
- AI agents must NEVER commit secrets, credentials, or `.env` files
- AI agents must NEVER spend `premium` model tier without explicit human approval
- AI agents must NEVER create destructive DB migrations without human review
- Monthly LLM budget cap: 1,000,000 units across all businesses
- All external API calls must go through existing microservices (not direct third-party calls from orchestrator)
- Production deployments follow blue/green pattern from nginx-microservice

## Success Metrics

- 20+ businesses running autonomously with < 1h/week total human intervention
- Task success rate > 85% without human involvement
- LLM cost per business per month < $2

## Escalation Contact

- Owner Telegram: @sergej_partizan
