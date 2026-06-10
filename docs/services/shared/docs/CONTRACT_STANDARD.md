# Ecosystem JSON Contract Standard

**Version:** 1.0  
**Status:** Active  
**Reference implementations:** `runlayer/src/contracts/`, `ai-microservice/src/contracts/`

---

## Why This Standard Exists

All microservices communicate via HTTP JSON. Without enforced contracts, a shape mismatch at any boundary is a silent runtime bug — data flows without validation, error messages are inconsistent, and debugging requires tracing through multiple services.

This standard mandates:
1. Every HTTP **request body** is validated by a DTO before the handler runs.
2. Every HTTP **response** is validated by a Zod schema before it leaves the service.
3. Every **inter-service HTTP call** validates both the outbound request shape and the inbound response.
4. **All schema violations crash loudly** with a standardized error envelope, never silently corrupt data.

---

## Two-Layer Validation

| Layer | Tool | When |
|-------|------|------|
| Request body (inbound) | `class-validator` + NestJS `ValidationPipe` OR `ZodValidationPipe` | HTTP boundary — before handler runs |
| Response / inter-service (outbound) | `zod` + `parseOrThrow()` | In handler, before returning / after receiving |

**Why two tools?** `class-validator` integrates tightly with NestJS's `@Body()` decorator pipeline. `zod` provides type inference, composable schemas, and `.passthrough()` for extensible shapes in inter-service contracts. Both approaches are acceptable for request validation — the key requirement is that all boundaries have validation.

---

## Required Files Per Service

Every NestJS microservice in the ecosystem MUST have:

```
src/
  contracts/
    contract-violation.error.ts   ← copy verbatim from reference
    parse-or-throw.ts              ← copy verbatim from reference
    <feature>.contract.ts          ← one file per feature/domain
    index.ts                       ← barrel re-export
  common/
    filters/
      contract-violation.filter.ts ← registered in main.ts
```

---

## Schema Conventions

### Every schema MUST include `schemaVersion`

```typescript
export const MySchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  // ... fields
});
```

### Use `.passthrough()` for LLM / external responses

```typescript
export const LlmResponseSchema = z.object({
  text: z.string(),
  model_used: z.string(),
}).passthrough(); // allow extra fields from new model versions
```

### Export inferred types alongside schemas

```typescript
export type MyData = z.infer<typeof MySchema>;
export type MyDataInput = z.input<typeof MySchema>; // use for controller @Body() params
```

For enum schemas, also export the inferred type:

```typescript
export const ModelTierSchema = z.enum(['free', 'cheap', 'smart', 'premium']);
export type ModelTier = z.infer<typeof ModelTierSchema>;
```

### Enum fields use `z.enum()`

```typescript
export const ModelTierSchema = z.enum(['free', 'cheap', 'smart', 'premium']);
```

### Nullable optional fields

```typescript
queue: z.string().nullable().optional(),
```

---

## `parseOrThrow()` Usage Pattern

```typescript
import { parseOrThrow, MyResponseSchema } from '../contracts';

// In a controller handler — validate outbound response:
const result = await this.service.doSomething();
return parseOrThrow(MyResponseSchema, result, 'module.endpoint.response');

// In an HTTP client — validate inbound response from another service:
const raw = await this.httpClient.post(url, payload);
return parseOrThrow(TheirResponseSchema, raw, 'their-service.endpoint.response');
```

The context string format is: `<module>.<endpoint>.<direction>` — e.g. `ai.complete.response`, `email-triage.ingest.request`.

---

## `ContractViolationFilter` Registration

Every service's `main.ts` must register the filter:

```typescript
import { ContractViolationFilter } from './common/filters/contract-violation.filter';

app.useGlobalFilters(new ContractViolationFilter());
```

The filter returns HTTP 500 with:
```json
{
  "error": "contract_violation",
  "context": "module.endpoint.direction",
  "issues": [{ "path": ["field"], "message": "..." }]
}
```

Services with a `NotificationsClient` should additionally fire-and-forget an escalation alert (see `runlayer/src/common/filters/contract-violation.filter.ts`).

---

## `AiCompleteRequest` / `AiCompleteResponse` — Shared Contract

These two schemas are the **most critical shared contract** in the ecosystem. runlayer calls ai-microservice; both sides MUST validate against the same shape.

Canonical definition lives in:
- `runlayer/src/contracts/ai-complete.contract.ts`
- `ai-microservice/src/contracts/ai-complete.contract.ts`

They must remain byte-for-byte identical. Any change requires updating both services simultaneously.

---

## Reference Infrastructure Files

Copy these verbatim when bootstrapping a new service:

**`src/contracts/contract-violation.error.ts`:**
```typescript
import { ZodIssue } from 'zod';

export class ContractViolationError extends Error {
  constructor(
    readonly context: string,
    readonly issues: ZodIssue[],
  ) {
    super(`contract_violation:${context}`);
    this.name = 'ContractViolationError';
  }
}
```

**`src/contracts/parse-or-throw.ts`:**
```typescript
import { ZodSchema } from 'zod';
import { ContractViolationError } from './contract-violation.error';

export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ContractViolationError(context, result.error.issues);
  }
  return result.data;
}
```

---

## Enforcement

### Parity guard script

Run before deploying either `runlayer` or `ai-microservice`:

```bash
./shared/scripts/check-contract-parity.sh
```

Exits 0 if `ai-complete.contract.ts` schema definitions are identical across both services. Exits 1 with a diff if they have drifted.

### Intentional filter asymmetry

`ContractViolationFilter` behaves differently by design:

| Service | Behaviour |
|---------|-----------|
| `runlayer` | Logs + fire-and-forget escalation via `notifications-microservice` |
| `ai-microservice` | Logs only |

This is correct. `runlayer` owns business escalations. Do not "fix" `ai-microservice` to also escalate.

### No SuccessEnvelopeSchema

`SuccessEnvelopeSchema` (a generic `{ success: true, data: T }` wrapper) is **not** part of this standard. The canonical pattern is flat validated responses — each schema defines exactly the fields it returns. Do not add envelope wrappers.

---

## Testing Requirements

Every service MUST have `src/contracts/contracts.spec.ts` with:
- ✓ Accept valid input for every schema
- ✓ Reject invalid input (wrong enum, missing required field, empty string where min(1) required)
- ✓ Test `parseOrThrow` throws `ContractViolationError` on bad data
- ✓ Test `ContractViolationError` carries context and issues

---

## Adding a New Endpoint Checklist

See `CONTRACT_CHECKLIST.md` for the step-by-step checklist.
