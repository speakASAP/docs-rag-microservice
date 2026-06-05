# Context: Agent Tasking

Source of truth: `docs/55-agent-tasking-guide.md`

## Task quality rules

A task is ready when:
- It references specific doc files
- The goal fits in one sentence
- Files to touch are listed
- Acceptance criteria are checkable, not vague
- At least one test is specified
- "Do not" items prevent the most likely mistakes

A task is NOT ready when:
- It requires resolving an open product decision
- It touches > ~8 files
- It has no tests
- It says "build the X system" (too broad)

## Safe implementation order

```
001 scaffold → 002 auth → 003 db-client → 004 vault → 005 k8s
     ↓
006 qr-payment (can be parallel with 004/005)
     ↓
007 onboarding → 008 tasks → 009 feedback → 010 admin
```

Tasks 001-006 are independent of each other except noted in TASKS.md.
Tasks 007-010 depend on auth (002) and db-client (003) being complete.

## Before every coding task

1. Read the task file fully
2. Read all referenced docs
3. Run `.claude/checklists/before-coding.md`
4. Check TASKS.md for blocking dependencies

## After every coding task

1. All tests pass
2. TypeScript zero errors
3. Run `.claude/checklists/before-pr.md`
4. Update STATE.json

## Escalate to human when

- Auth service returns unexpected schema
- DB service endpoint is missing or undocumented
- Payment change needed beyond docs/17
- GDPR-impacting data field change needed
- Two tasks conflict
