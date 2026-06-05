# AGENTS.md — school-committee


## Knowledge Retrieval (query before reading files)
Query the RAG service first to reuse indexed ecosystem context before reading raw files:

```bash
curl -s -X POST http://docs-rag-microservice.statex-apps.svc.cluster.local:3397/retrieval/agent-context \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR QUESTION HERE", "maxTokens": 3000}'
```

- Internal URL: `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
- Public URL: `https://docs-rag.alfares.cz`
- Full guide: `docs-rag-microservice/docs/RAG_USAGE.md`

## Agent boundaries

| Agent role | Can do | Cannot do |
|-----------|--------|-----------|
| Coding agent | Implement features per task files | Change docs without instruction |
| Coding agent | Write tests | Modify BUSINESS.md or GOALS.md |
| Coding agent | Create K8s manifests | Write production secrets anywhere |
| Coding agent | Scaffold components | Implement own auth logic |
| Coding agent | Call DB service API | Write directly to PostgreSQL |
| Security reviewer | Read all files | Modify implementation |

## Agent commands

```bash
# Check current task status
cat .claude/tasks/*.md | grep "status:"

# Run tests
npm test

# Type check
npx tsc --noEmit

# Health check (local)
curl http://localhost:4800/api/health/live

# Lint
npm run lint
```

## Coordination

- Tasks live in `.claude/tasks/`
- Each task is self-contained with context, constraints, and acceptance criteria
- Complete one task fully (tests pass) before starting next
- If a task touches auth or payment, consult security checklist first
- Never skip `.claude/checklists/before-coding.md`

## Escalation

Stop and report to human if:
- Auth service contract is unclear or unavailable
- DB service endpoint is missing or returns unexpected schema
- A payment-related change is needed that is not in docs
- A GDPR-impacting data model change is needed
- Two tasks conflict
