# Telegram Resolve → AI Investigation for Escalations Without a Task

**Date:** 2026-06-04  
**Status:** Approved

---

## Problem

When a user clicks **Resolve** on a Telegram escalation notification and the escalation has no associated `taskId` (e.g. health alerts, stall detector alerts, plan-step failure notices), the system:

1. Asks for a user note (existing UX — unchanged).
2. Marks the escalation as resolved.
3. **Does nothing else** — no AI action is triggered.

Escalations with a `taskId` already spawn an investigate→fix chain. The gap is the no-`taskId` case.

---

## Solution

Add a second AI-trigger branch in `EscalationsService.resolve()` for escalations that have a `projectId` but no `taskId`. That branch spawns a standalone `investigate:escalation` task via a new `WorkerAgentService` method.

---

## Architecture

Two files change, no new files:

| File | Change |
|------|--------|
| `src/escalations/escalations.service.ts` | Add `else if (e.projectId)` branch calling `triggerStandaloneInvestigateForEscalation` |
| `src/worker/worker-agent.service.ts` | Add `spawnStandaloneInvestigateForEscalation(escalation, note?)` |

The Telegram bot (notifications-microservice) is **unchanged** — it already collects the optional note and calls `POST /api/escalations/:id/resolve`.

---

## Data Flow

### Before

```
EscalationsService.resolve(id, note)
  ├── if e.taskId  → triggerInvestigateChainForResolve(e, note)   ← existing
  └── else         → (nothing)
```

### After

```
EscalationsService.resolve(id, note)
  ├── if e.taskId      → triggerInvestigateChainForResolve(e, note)              ← existing, unchanged
  ├── else if e.projectId → triggerStandaloneInvestigateForEscalation(e, note)   ← new
  └── else             → log warn, close only
```

### New investigate task shape

```typescript
{
  type:              'investigate:escalation',
  projectId:         escalation.projectId,
  priority:          2,
  maxAttempts:       1,
  idempotencyKey:    `investigate-esc:${escalation.id}`,
  payloadRef: {
    escalation_id:   escalation.id,
    subject:         escalation.subject,
    body:            escalation.body,
    level:           escalation.level,
    human_note:      note ?? null,       // optional — user can /skip
  },
  acceptanceCriteria: [
    'Identify the root cause of the escalation',
    'Propose concrete remediation steps',
  ],
}
```

No fix chain, no `parentTaskId`. The worker picks it up like any other `investigate:*` task.

---

## Error Handling

- `triggerStandaloneInvestigateForEscalation` is called fire-and-forget (`.catch()`). A spawn failure never surfaces to the Telegram webhook or the caller.
- Missing `projectId` on the escalation: log `warn`, close only — no AI action.
- Idempotency key `investigate-esc:<escalationId>` prevents duplicate tasks on double-click.
- Already-resolved escalations short-circuit at the top of `resolve()` before any spawn logic.

---

## Testing

Add to `escalations.service.spec.ts`:

1. `resolve() with taskId=null, projectId set` → calls `spawnStandaloneInvestigateForEscalation`
2. `resolve() with taskId=null, projectId=null` → does NOT call spawn, logs warn
3. `resolve() called twice` → second call returns early (status already resolved), no double-spawn
4. `spawnStandaloneInvestigateForEscalation` → creates task with correct `type`, `idempotencyKey`, and `payloadRef`

No integration tests needed — the existing worker already handles `investigate:*` task types.

---

## Out of Scope

- Changes to the Telegram bot (notifications-microservice)
- Creating a Goal or full Plan→Task cycle for escalation resolution
- Fix chain spawned after investigation (worker can do this if it deems it necessary)
