# Cross-Service Contract Parity — Design Spec

**Date:** 2026-05-29  
**Status:** Approved (updated 2026-05-29)  
**Scope:** business-orchestrator + ai-microservice + shared/docs

---

## Goal

The shared contract between `business-orchestrator` and `ai-microservice` (`AiCompleteRequest` / `AiCompleteResponse`) must be byte-for-byte identical on both sides and enforced by a CI-runnable parity script. Four concrete divergences found in the current codebase are fixed. The canonical pattern (flat validated responses, no envelope wrapper) is documented and any dead code removed.

---

## Context

Both services already implement the contract standard documented in `shared/docs/CONTRACT_STANDARD.md`:
- `ContractViolationError` + `parseOrThrow` — identical in both services
- `ZodValidationPipe` on every controller
- `ContractViolationFilter` registered in `main.ts`
- All endpoints validate both inbound requests and outbound responses

The gaps are small but real: one schema divergence, one dead-code envelope pattern, one unvalidated health endpoint, and no enforcement script to prevent future drift.

---

## Changes

### 1. Align `AiCompleteRequestSchema` (both services)

**File:** `ai-microservice/src/contracts/ai-complete.contract.ts`

**Current:**
```ts
schemaVersion: z.literal('1.0').optional().default('1.0'),
```

**Fix:**
```ts
schemaVersion: z.literal('1.0').default('1.0'),
```

The `.optional()` is redundant — `.default()` already handles missing fields. business-orchestrator does not have `.optional()` here. Removing it makes the schemas identical on this field.

**File:** `business-orchestrator/src/contracts/ai-complete.contract.ts`

Add missing type exports that `ai-microservice` already has, so both services expose the same type surface:
```ts
export type ModelTier = z.infer<typeof ModelTierSchema>;
export type AiCompleteRequestInput = z.input<typeof AiCompleteRequestSchema>;
```

---

### 2. Remove `SuccessEnvelopeSchema` / `ErrorEnvelopeSchema` from ai-microservice

**File:** `ai-microservice/src/contracts/http-responses.contract.ts`

Remove:
- `SuccessEnvelopeSchema` (generic `{ success: true, data: T }` wrapper)
- `ErrorEnvelopeSchema` (generic `{ error, context?, issues? }` wrapper)

These are unused infrastructure. No controller in `ai-microservice` wraps responses in `SuccessEnvelopeSchema`. The email-triage endpoints use `success: true` as an inline field, not via this helper. The canonical pattern (flat validated responses) is the orchestrator's pattern — no wrapping.

`NotFoundResponseSchema` and `HealthResponseSchema` remain — they are used.

---

### 3. Fix `ai-microservice` health endpoint

**File:** `ai-microservice/src/health.controller.ts`

**Current:** Returns `{ status: 'ok' }` with no `parseOrThrow` call.

**Fix:** Add `parseOrThrow` call so the response is validated at the boundary:
```ts
import { parseOrThrow, HealthResponseSchema } from './contracts';

check() {
  return parseOrThrow(
    HealthResponseSchema,
    { status: 'ok', service: 'ai-microservice' },
    'health.check',
  );
}
```

**File:** `ai-microservice/src/contracts/http-responses.contract.ts`

**Current `HealthResponseSchema`:**
```ts
export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  service: z.string(),
});
```

This is fine — align the controller to it (add `service` field). Keep `z.enum` for the status values; it's stricter than `z.string()` and desirable.

---

### 4. Parity guard script

**New file:** `shared/scripts/check-contract-parity.sh`

Diffs `ai-complete.contract.ts` schema definitions between both services. Strips type-export lines (lines starting with `export type`) before diffing so the comparison is schema-only. Exits 0 if identical, exits 1 with a diff if not.

Usage:
```bash
./shared/scripts/check-contract-parity.sh
```

Run before deploying either `business-orchestrator` or `ai-microservice`.

---

### 5. Update `shared/docs/CONTRACT_STANDARD.md`

Add an **Enforcement** section:
- Reference the parity script
- Document the intentional asymmetry in `ContractViolationFilter`: orchestrator escalates via notifications-microservice, ai-microservice only logs. This is correct — orchestrator owns business escalations.
- Clarify `SuccessEnvelopeSchema` is not part of the standard (flat responses are canonical).
- Add `ModelTier` and `AiCompleteRequestInput` to the type-export convention.

---

### 6. Update `shared/docs/CONTRACT_CHECKLIST.md`

Add to "New Inter-Service HTTP Call" section:
```
- [ ] Run `shared/scripts/check-contract-parity.sh` — exits 0 before deploying either service
```

---

### 7. Fix `ai-microservice` controller validation gaps

Three controllers do not consistently apply `ZodValidationPipe` on input + `parseOrThrow` on output:

**`ai-microservice/src/shop-assistant/shop-assistant.controller.ts`**
- Each handler must add `@UsePipes(new ZodValidationPipe(ShopXxxRequestSchema))` OR call `parseOrThrow(ShopXxxRequestSchema, body, 'shop-assistant.<endpoint>.request')` at the top of the method
- Each handler must wrap its return with `parseOrThrow(ShopXxxResponseSchema, result, 'shop-assistant.<endpoint>.response')`

**`ai-microservice/src/voice/voice.controller.ts`**
- Add `@UsePipes(new ZodValidationPipe(TranscribeRequestSchema))` on the transcribe endpoint
- Wrap response with `parseOrThrow(TranscribeResponseSchema, result, 'voice.transcribe.response')`

**`ai-microservice/src/claude-code/claude-code.controller.ts`**
- Audit all handlers; add missing `ZodValidationPipe` + `parseOrThrow` calls

---

### 8. Fix `business-orchestrator` missing output gates

**`AgentResult` output gate in `WorkerAgentService`**

After every AI call in `src/worker/worker-agent.service.ts`, add:
```ts
import { parseOrThrow, AgentResultSchema } from '../contracts';
const validated = parseOrThrow(AgentResultSchema, rawResult, 'worker.execute.result');
```

**`SpawnPayload` at `tasksService.create()` call sites**

In `src/worker/worker-agent.service.ts` (and any other service calling `tasksService.create()` with a spawn payload), add:
```ts
import { parseOrThrow, SpawnPayloadSchema } from '../contracts';
parseOrThrow(SpawnPayloadSchema, spawnPayload, 'worker.spawn.request');
```

---

### 9. Align `ContractViolationFilter` escalation behavior

The existing spec marks `ai-microservice` logging-only as intentional asymmetry. This is **revised**: both services must escalate on contract violations.

**`ai-microservice/src/common/filters/contract-violation.filter.ts`**

Add `NotificationsClient` injection and fire-and-forget escalation — mirror `business-orchestrator`'s implementation exactly.

---

## What does NOT change

- `ContractViolationError` — identical in both services, no change needed
- `parseOrThrow` — identical in both services, no change needed
- The copy-paste model — Approach C (shared npm package) is the right long-term move for 10+ services but not now

---

## Testing

**`ai-microservice/src/contracts/contracts.spec.ts`:**
- Remove any test referencing `SuccessEnvelopeSchema` or `ErrorEnvelopeSchema`
- Add test: `HealthResponseSchema` accepts `{ status: 'ok', service: 'ai-microservice' }`
- Add test: `HealthResponseSchema` rejects `{ status: 'running' }` (not in enum)
- Add test: `AiCompleteRequestSchema` — `schemaVersion` defaults to `'1.0'` when omitted

**`shared/scripts/check-contract-parity.sh`:**
- The script itself is the enforcement test — run it in CI before deploying either service

**`ai-microservice` new controller tests:**
- Add tests for each shop-assistant endpoint: valid input accepted, invalid input rejected
- Add test: `TranscribeRequestSchema` rejects empty `fileKey`
- Add tests for `ContractViolationFilter` escalation call

**`business-orchestrator` new tests:**
- Add test: `AgentResultSchema` is used as output gate in worker pipeline (mock `parseOrThrow`, assert called)
- Add test: `SpawnPayloadSchema` is called before `tasksService.create()`

---

## Intentional Asymmetry Preserved

| Feature | business-orchestrator | ai-microservice |
|---------|----------------------|-----------------|
| `ContractViolationFilter` | Logs + escalates | Logs + escalates (now aligned) |
| `HealthResponseSchema` | `{status: string, service: string, ts: string}` | `{status: enum, service: string}` |
| `AiCompleteRequestInput` type | Added (was missing) | Already present |
| `ModelTier` type | Added (was missing) | Already present |

Health schemas intentionally differ — they are not a cross-service contract.
