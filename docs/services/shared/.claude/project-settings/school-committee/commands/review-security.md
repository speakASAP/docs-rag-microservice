# Command: review-security

Run a security review on changed files.

## Steps

1. Read `docs/40-security-model.md`.
2. Read `.claude/checklists/security-review.md`.
3. Check all changed files against every item in the checklist.
4. For each failed item: describe what is wrong and where.
5. Produce a report with: PASS / FAIL per checklist item.

## Focus areas

- Token handling (httpOnly cookies, no localStorage)
- Role enforcement (BFF checks, not frontend-only)
- Payment security (server-generated QR, no card data)
- Secrets exposure (no secrets in code, logs, or ConfigMap)
- Input validation (Zod schemas on all API inputs)
- Audit events (every mutation audited)
- Public endpoint rate limits
- File upload validation (MIME type, size, no executables)
- Child data minimization
- Request tracing (request_id present everywhere)

## Output format

```
SECURITY REVIEW — <date>
Files reviewed: <list>

PASS: <item>
FAIL: <item> — <file>:<line> — <description>
WARN: <item> — <description>

Summary: <N> pass, <N> fail, <N> warn
Action required: yes/no
```
