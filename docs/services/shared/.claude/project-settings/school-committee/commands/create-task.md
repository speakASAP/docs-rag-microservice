# Command: create-task

Create a new agent-ready task file from a story description.

## Usage

```
/create-task <task-id> <title> <epic>
```

## Steps

1. Read `docs/55-agent-tasking-guide.md` for task format rules.
2. Read `docs/56-implementation-backlog.md` to find the relevant story.
3. Read `TASKS.md` to check for conflicts or dependencies.
4. Create `.claude/tasks/<task-id>-<slug>.md` using the template below.
5. Add the task to `TASKS.md`.

## Task file template

```markdown
# Task <ID>: <Title>

**Status:** ready
**Epic:** <epic-name>
**Depends on:** <task IDs or "none">

## Context
<Why this task exists. Reference docs/*.md files.>

## Objective
<What must be built. Single clear goal.>

## Relevant docs
- `docs/<file>` — <why>

## Files likely touched
- `<path>` — <purpose>

## Implementation constraints
- <constraint from docs>

## Acceptance criteria
- [ ] <criterion>

## Tests required
- <unit/integration/contract test description>

## Do not
- <explicit prohibition>
```

## Rules

- Every task must reference at least one doc file.
- Every task must have at least 3 acceptance criteria.
- Every task must have at least one test requirement.
- Every task must have at least one "do not" item.
- Tasks must be implementable without resolving vague product decisions.
