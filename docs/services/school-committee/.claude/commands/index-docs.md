# Command: index-docs

Read and summarize the full `/docs` directory for the current session.

## Steps

1. Read `docs/00-index.md` to get the document list.
2. Read all files in this order:
   - Product: 01, 02, 03, 04, 05
   - Architecture: 10, 11, 12, 13, 14, 15, 16, 17, 18, 19
   - Data/APIs: 30, 31, 32, 33, 34, 35, 36
   - Security/GDPR: 40, 41, 42, 43, 44
   - Development: 50, 51, 52, 53, 54, 55, 56, 57, 58, 59
3. Extract and summarize:
   - architectural decisions (ADRs from doc 59)
   - API contracts (docs 32, 33)
   - security constraints (docs 40, 41, 42)
   - MVP scope and cuts (doc 02)
   - domain model entities (doc 30)
   - implementation backlog (doc 56)
4. Report: "Docs indexed. Key constraints: [list top 5]. Active backlog items: [count]."

## Output

A concise summary under 400 words covering: architecture decisions, critical constraints, MVP scope, and next recommended task.
