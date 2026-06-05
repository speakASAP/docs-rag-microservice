# Command: implement-story

Implement a task from `.claude/tasks/`.

## Usage

```
/implement-story <task-id>
```

## Steps

1. Read `.claude/tasks/<task-id>-*.md` fully.
2. Read all "relevant docs" listed in the task.
3. Run `.claude/checklists/before-coding.md` — stop if any item fails.
4. Check `TASKS.md` — verify no blocking dependencies are unresolved.
5. Implement following `docs/51-coding-standards.md`.
6. Write tests following `docs/52-testing-strategy.md`.
7. Run `npx tsc --noEmit` — fix all type errors before continuing.
8. Run `npm test` — all tests must pass.
9. Run `.claude/checklists/before-pr.md`.
10. Update `STATE.json`: set `active_task` to task ID.
11. Report: "Task <ID> implemented. Tests: N passing. Ready for review."

## Hard stops

Stop immediately and report to human if:
- Auth service API returns unexpected schema
- DB service endpoint is undocumented
- A payment change is needed beyond what docs/17 specifies
- A GDPR-impacting data field is needed that docs/41 does not cover
