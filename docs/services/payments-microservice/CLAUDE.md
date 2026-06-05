# CLAUDE.md (payments-microservice)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## payments-microservice

**Purpose**: Unified payment gateway supporting PayPal, Stripe, PayU, Fio Banka, ComGate; webhook handling and refunds.  
**Port**: 3468  
**Domain**: https://payments.alfares.cz  
**Stack**: NestJS · PostgreSQL

### Key constraints
- Never initiate payments or refunds without explicit human approval
- Payment credentials (API keys, secrets) come from Vault via ESO in K8s — never log them
- PCI DSS: never store full card numbers anywhere
- Webhook endpoints must validate signatures before processing

### Consumers
flipflop-service, allegro-service, aukro-service, bazos-service, beauty, marathon, speakasap, sgiprealestate, statex, crypto-ai-agent.

**Ops**: `curl http://payments-microservice:3468/health` · `kubectl logs -n statex-apps -l app=payments-microservice -f` · `./scripts/deploy.sh`
