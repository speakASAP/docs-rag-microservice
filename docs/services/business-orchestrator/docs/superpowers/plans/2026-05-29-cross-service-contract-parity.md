# Cross-Service Contract Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the shared `AiCompleteRequest`/`AiCompleteResponse` contract between `business-orchestrator` and `ai-microservice`, remove dead envelope code, fix the unvalidated health endpoint, and add a CI-runnable parity script to prevent future drift.

**Architecture:** Both services already use the same contract pattern (Zod schemas, `parseOrThrow`, `ZodValidationPipe`, `ContractViolationFilter`). This plan only fixes four concrete divergences and adds a guard script — no new infrastructure needed.

**Tech Stack:** TypeScript, NestJS, Zod, Bash

---

## File Map

| Action | File |
|--------|------|
| Modify | `ai-microservice/src/contracts/ai-complete.contract.ts` |
| Modify | `business-orchestrator/src/contracts/ai-complete.contract.ts` |
| Modify | `ai-microservice/src/contracts/http-responses.contract.ts` |
| Modify | `ai-microservice/src/health.controller.ts` |
| Modify | `ai-microservice/src/contracts/contracts.spec.ts` |
| Create | `shared/scripts/check-contract-parity.sh` |
| Modify | `shared/docs/CONTRACT_STANDARD.md` |
| Modify | `shared/docs/CONTRACT_CHECKLIST.md` |

---

## Task 1: Fix `AiCompleteRequestSchema` divergence in ai-microservice

**Files:**
- Modify: `ai-microservice/src/contracts/ai-complete.contract.ts`
- Test: `ai-microservice/src/contracts/contracts.spec.ts`

- [ ] **Step 1: Write the failing test**

Open `ai-microservice/src/contracts/contracts.spec.ts` and add this test inside the existing `describe('AiCompleteRequestSchema', ...)` block (after the last existing `it()`):

```typescript
it('schemaVersion defaults to 1.0 when omitted (no .optional needed)', () => {
  const result = AiCompleteRequestSchema.safeParse({ model_tier: 'free', user_prompt: 'hi' });
  expect(result.success).toBe(true);
  // Verify the schema does NOT accept a non-1.0 literal (i.e. it is z.literal not z.string)
  const bad = AiCompleteRequestSchema.safeParse({ model_tier: 'free', user_prompt: 'hi', schemaVersion: '2.0' });
  expect(bad.success).toBe(false);
});
```

- [ ] **Step 2: Run the test to confirm current state**

```bash
cd /home/ssf/Documents/Github/ai-microservice && npx jest --testPathPattern="contracts.spec" --no-coverage 2>&1 | tail -20
```

The new test may already pass (`.optional()` doesn't change runtime behaviour for omitted fields) — that's fine. We still fix it for schema identity.

- [ ] **Step 3: Remove `.optional()` from `schemaVersion` in ai-microservice**

In `ai-microservice/src/contracts/ai-complete.contract.ts`, line 6, change:

```typescript
// BEFORE
schemaVersion: z.literal('1.0').optional().default('1.0'),

// AFTER
schemaVersion: z.literal('1.0').default('1.0'),
```

The full file after the change:

```typescript
import { z } from 'zod';

export const ModelTierSchema = z.enum(['free', 'cheap', 'smart', 'premium']);

export const AiCompleteRequestSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  model_tier: ModelTierSchema,
  user_prompt: z.string().min(1),
  system_prompt: z.string().optional(),
  output_schema: z.record(z.string(), z.unknown()).optional(),
  max_tokens: z.number().int().positive().optional(),
  correlation_id: z.string().optional(),
});

export const AiCompleteResponseSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  text: z.string(),
  model_used: z.string(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  token_usage_estimate: z.number().int().nonnegative().optional(),
  error_code: z.string().optional(),
  error_message: z.string().optional(),
}).passthrough();

export type ModelTier = z.infer<typeof ModelTierSchema>;
export type AiCompleteRequest = z.infer<typeof AiCompleteRequestSchema>;
export type AiCompleteRequestInput = z.input<typeof AiCompleteRequestSchema>;
export type AiCompleteResponse = z.infer<typeof AiCompleteResponseSchema>;
```

- [ ] **Step 4: Run tests**

```bash
cd /home/ssf/Documents/Github/ai-microservice && npx jest --testPathPattern="contracts.spec" --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Add missing type exports to business-orchestrator**

In `business-orchestrator/src/contracts/ai-complete.contract.ts`, add two type exports after the existing ones:

```typescript
// Current end of file:
export type AiCompleteRequest = z.infer<typeof AiCompleteRequestSchema>;
export type AiCompleteResponse = z.infer<typeof AiCompleteResponseSchema>;

// Add these two lines:
export type ModelTier = z.infer<typeof ModelTierSchema>;
export type AiCompleteRequestInput = z.input<typeof AiCompleteRequestSchema>;
```

- [ ] **Step 6: Run business-orchestrator contract tests**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest --testPathPattern="contracts.spec" --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 7: Commit both changes**

```bash
cd /home/ssf/Documents/Github/ai-microservice && git add src/contracts/ai-complete.contract.ts src/contracts/contracts.spec.ts
git commit -m "fix(contracts): align AiCompleteRequestSchema with business-orchestrator (remove redundant .optional)"

cd /home/ssf/Documents/Github/business-orchestrator && git add src/contracts/ai-complete.contract.ts
git commit -m "feat(contracts): add ModelTier and AiCompleteRequestInput type exports to match ai-microservice"
```

---

## Task 2: Remove unused envelope schemas from ai-microservice

**Files:**
- Modify: `ai-microservice/src/contracts/http-responses.contract.ts`
- Modify: `ai-microservice/src/contracts/contracts.spec.ts`

- [ ] **Step 1: Verify nothing imports SuccessEnvelopeSchema or ErrorEnvelopeSchema**

```bash
grep -r "SuccessEnvelopeSchema\|ErrorEnvelopeSchema" /home/ssf/Documents/Github/ai-microservice/src --include="*.ts"
```

Expected: only `http-responses.contract.ts` and possibly `contracts.spec.ts`. No controller or service should reference them. If any service file does, stop and investigate before proceeding.

- [ ] **Step 2: Remove the envelope schemas**

Replace the top section of `ai-microservice/src/contracts/http-responses.contract.ts` so the full file reads:

```typescript
import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  service: z.string(),
});

export const NotFoundResponseSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  error: z.string(),
}).passthrough();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type NotFoundResponse = z.infer<typeof NotFoundResponseSchema>;
```

- [ ] **Step 3: Remove any spec tests that reference the removed schemas**

In `ai-microservice/src/contracts/contracts.spec.ts`, remove any `describe` or `it` blocks that reference `SuccessEnvelopeSchema` or `ErrorEnvelopeSchema`. Also remove the import if present.

Check first:
```bash
grep -n "SuccessEnvelope\|ErrorEnvelope" /home/ssf/Documents/Github/ai-microservice/src/contracts/contracts.spec.ts
```

If any lines found, delete those lines/blocks. If none found, skip.

- [ ] **Step 4: Add HealthResponseSchema tests**

In `ai-microservice/src/contracts/contracts.spec.ts`, add a new describe block. Insert it after the last existing describe block, before the closing of the file:

```typescript
describe('HealthResponseSchema', () => {
  it('accepts valid health response', () => {
    const result = HealthResponseSchema.safeParse({ status: 'ok', service: 'ai-microservice' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status value', () => {
    const result = HealthResponseSchema.safeParse({ status: 'running', service: 'ai-microservice' });
    expect(result.success).toBe(false);
  });

  it('rejects missing service field', () => {
    const result = HealthResponseSchema.safeParse({ status: 'ok' });
    expect(result.success).toBe(false);
  });
});
```

Also add the import at the top of contracts.spec.ts (alongside existing imports):

```typescript
import { HealthResponseSchema } from './http-responses.contract';
```

- [ ] **Step 5: Run tests**

```bash
cd /home/ssf/Documents/Github/ai-microservice && npx jest --testPathPattern="contracts.spec" --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/ssf/Documents/Github/ai-microservice && git add src/contracts/http-responses.contract.ts src/contracts/contracts.spec.ts
git commit -m "fix(contracts): remove unused SuccessEnvelopeSchema/ErrorEnvelopeSchema; add HealthResponseSchema tests"
```

---

## Task 3: Fix ai-microservice health endpoint validation

**Files:**
- Modify: `ai-microservice/src/health.controller.ts`

- [ ] **Step 1: Write the failing test**

There is no existing test for the health controller. Add a minimal test file:

```bash
cat /home/ssf/Documents/Github/ai-microservice/src/health.controller.ts
```

Confirm the current file returns `{ status: 'ok' }` with no `parseOrThrow`.

- [ ] **Step 2: Update the health controller**

Replace the full content of `ai-microservice/src/health.controller.ts` with:

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from './service-identity/public.decorator';
import { parseOrThrow } from './contracts/parse-or-throw';
import { HealthResponseSchema } from './contracts/http-responses.contract';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check() {
    return parseOrThrow(
      HealthResponseSchema,
      { status: 'ok', service: 'ai-microservice' },
      'health.check',
    );
  }
}
```

- [ ] **Step 3: Build check — verify no TypeScript errors**

```bash
cd /home/ssf/Documents/Github/ai-microservice && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
cd /home/ssf/Documents/Github/ai-microservice && npx jest --no-coverage 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/ssf/Documents/Github/ai-microservice && git add src/health.controller.ts
git commit -m "fix(health): add parseOrThrow validation to health endpoint"
```

---

## Task 4: Create parity guard script

**Files:**
- Create: `shared/scripts/check-contract-parity.sh`

- [ ] **Step 1: Check the scripts directory exists**

```bash
ls /home/ssf/Documents/Github/shared/scripts/
```

Confirm the directory exists. If not, create it: `mkdir -p /home/ssf/Documents/Github/shared/scripts/`

- [ ] **Step 2: Create the parity script**

Create `shared/scripts/check-contract-parity.sh` with this content:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

FILE_A="$REPO_ROOT/business-orchestrator/src/contracts/ai-complete.contract.ts"
FILE_B="$REPO_ROOT/ai-microservice/src/contracts/ai-complete.contract.ts"

if [[ ! -f "$FILE_A" ]]; then
  echo "ERROR: not found: $FILE_A" >&2
  exit 2
fi

if [[ ! -f "$FILE_B" ]]; then
  echo "ERROR: not found: $FILE_B" >&2
  exit 2
fi

# Strip type-export lines — compare schema definitions only
strip_types() {
  grep -v '^export type ' "$1"
}

DIFF=$(diff <(strip_types "$FILE_A") <(strip_types "$FILE_B") || true)

if [[ -z "$DIFF" ]]; then
  echo "✓ ai-complete.contract.ts schemas are identical in both services."
  exit 0
else
  echo "✗ SCHEMA DRIFT DETECTED in ai-complete.contract.ts" >&2
  echo "" >&2
  echo "--- business-orchestrator/src/contracts/ai-complete.contract.ts" >&2
  echo "+++ ai-microservice/src/contracts/ai-complete.contract.ts" >&2
  echo "$DIFF" >&2
  echo "" >&2
  echo "Fix: update both files so their schema definitions (non-type-export lines) are identical." >&2
  exit 1
fi
```

- [ ] **Step 3: Make executable**

```bash
chmod +x /home/ssf/Documents/Github/shared/scripts/check-contract-parity.sh
```

- [ ] **Step 4: Run the script — should pass now that Task 1 is done**

```bash
/home/ssf/Documents/Github/shared/scripts/check-contract-parity.sh
```

Expected output:
```
✓ ai-complete.contract.ts schemas are identical in both services.
```

If it fails, re-check Task 1 changes.

- [ ] **Step 5: Verify script detects drift (manual test)**

Temporarily add a space to one file, run the script, confirm it exits 1, then revert:

```bash
echo " " >> /home/ssf/Documents/Github/ai-microservice/src/contracts/ai-complete.contract.ts
/home/ssf/Documents/Github/shared/scripts/check-contract-parity.sh; echo "exit: $?"
# Remove the appended space
head -n -1 /home/ssf/Documents/Github/ai-microservice/src/contracts/ai-complete.contract.ts > /tmp/ai-complete-tmp.ts && mv /tmp/ai-complete-tmp.ts /home/ssf/Documents/Github/ai-microservice/src/contracts/ai-complete.contract.ts
```

Expected: script exits 1 with drift message, then reverted file passes again.

- [ ] **Step 6: Commit**

```bash
cd /home/ssf/Documents/Github/shared && git add scripts/check-contract-parity.sh
git commit -m "feat(contracts): add check-contract-parity.sh parity guard script"
```

---

## Task 5: Update shared documentation

**Files:**
- Modify: `shared/docs/CONTRACT_STANDARD.md`
- Modify: `shared/docs/CONTRACT_CHECKLIST.md`

- [ ] **Step 1: Add Enforcement section to CONTRACT_STANDARD.md**

Open `shared/docs/CONTRACT_STANDARD.md`. After the `## Reference Infrastructure Files` section (before `## Testing Requirements`), insert:

```markdown
---

## Enforcement

### Parity guard script

Run before deploying either `business-orchestrator` or `ai-microservice`:

```bash
./shared/scripts/check-contract-parity.sh
```

Exits 0 if `ai-complete.contract.ts` schema definitions are identical across both services. Exits 1 with a diff if they have drifted.

### Intentional filter asymmetry

`ContractViolationFilter` behaves differently by design:

| Service | Behaviour |
|---------|-----------|
| `business-orchestrator` | Logs + fire-and-forget escalation via `notifications-microservice` |
| `ai-microservice` | Logs only |

This is correct. `business-orchestrator` owns business escalations. Do not "fix" `ai-microservice` to also escalate.

### No SuccessEnvelopeSchema

`SuccessEnvelopeSchema` (a generic `{ success: true, data: T }` wrapper) is **not** part of this standard. The canonical pattern is flat validated responses — each schema defines exactly the fields it returns. Do not add envelope wrappers.

```

- [ ] **Step 2: Add ModelTier and AiCompleteRequestInput to type-export convention in CONTRACT_STANDARD.md**

Find the `### Export inferred types alongside schemas` section. Update the example to include input types:

```markdown
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
```

- [ ] **Step 3: Update CONTRACT_CHECKLIST.md**

In `shared/docs/CONTRACT_CHECKLIST.md`, add to the `## New Inter-Service HTTP Call` section:

```markdown
- [ ] Run `./shared/scripts/check-contract-parity.sh` — must exit 0 before deploying either `business-orchestrator` or `ai-microservice`
```

Also add to `## Schema Change (breaking)` section:

```markdown
- [ ] Run `./shared/scripts/check-contract-parity.sh` after updating both files — confirms parity
```

- [ ] **Step 4: Commit**

```bash
cd /home/ssf/Documents/Github/shared && git add docs/CONTRACT_STANDARD.md docs/CONTRACT_CHECKLIST.md
git commit -m "docs(contracts): add Enforcement section, parity script reference, no-envelope rule"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run parity script**

```bash
/home/ssf/Documents/Github/shared/scripts/check-contract-parity.sh
```

Expected:
```
✓ ai-complete.contract.ts schemas are identical in both services.
```

- [ ] **Step 2: Run ai-microservice full test suite**

```bash
cd /home/ssf/Documents/Github/ai-microservice && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 3: Run business-orchestrator full test suite**

```bash
cd /home/ssf/Documents/Github/business-orchestrator && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 4: TypeScript build check on both services**

```bash
cd /home/ssf/Documents/Github/ai-microservice && npx tsc --noEmit 2>&1 | head -20
cd /home/ssf/Documents/Github/business-orchestrator && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in either service.

- [ ] **Step 5: Close GitHub issue**

```bash
gh issue comment 2 --repo speakASAP/ai-microservice --body "## Completed

**What was done:**
- Removed \`.optional()\` from \`schemaVersion\` in \`ai-microservice/src/contracts/ai-complete.contract.ts\`
- Added \`ModelTier\` and \`AiCompleteRequestInput\` type exports to \`business-orchestrator/src/contracts/ai-complete.contract.ts\`
- Removed unused \`SuccessEnvelopeSchema\` and \`ErrorEnvelopeSchema\` from \`ai-microservice/src/contracts/http-responses.contract.ts\`
- Fixed \`ai-microservice/src/health.controller.ts\` to call \`parseOrThrow\` with \`HealthResponseSchema\`
- Added \`HealthResponseSchema\` tests to \`ai-microservice/src/contracts/contracts.spec.ts\`
- Created \`shared/scripts/check-contract-parity.sh\` parity guard script
- Updated \`shared/docs/CONTRACT_STANDARD.md\` with Enforcement section
- Updated \`shared/docs/CONTRACT_CHECKLIST.md\` with parity script checklist item

**Outcome:** All tests pass, schemas are identical, parity script exits 0."

gh issue close 2 --repo speakASAP/ai-microservice
```
