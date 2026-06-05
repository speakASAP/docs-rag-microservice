# JSON Contract Gap Enforcement — Issue #21

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all 8 unvalidated JSON boundaries between agents/services so every message is Zod-parsed at the point it crosses a boundary, with `ContractViolationError` on failure.

**Architecture:** `parseOrThrow` and `ContractViolationError` already exist in `src/contracts/`. Each task adds or wires a Zod schema at one specific gap site. No new dependencies — Zod is already in use everywhere. Existing `contracts.spec.ts` is extended with tests per task.

**Tech Stack:** NestJS · Zod · TypeScript

---

## File Map

| Action | File | Gap |
|--------|------|-----|
| MODIFY | `src/validator/validator-agent.service.ts` | Gap 1 — ValidationRequest input gate |
| CREATE | `src/contracts/events.contract.ts` | Gap 2 — event payload schemas |
| MODIFY | `src/events/events.publisher.ts` | Gap 2 — validate at publish |
| CREATE | `src/contracts/notifications.contract.ts` | Gap 3 — notification send schemas |
| MODIFY | `src/common/notifications/notifications.client.ts` | Gap 3 — validate before post |
| CREATE | `src/contracts/logging.contract.ts` | Gap 4 — log entry schema |
| MODIFY | `src/common/logging/logging.client.ts` | Gap 4 — validate before post |
| CREATE | `src/contracts/auth.contract.ts` | Gap 5 — auth validate response schema |
| MODIFY | `src/common/auth/jwt.guard.ts` | Gap 5 — validate auth response |
| CREATE | `src/contracts/spawn-payload.contract.ts` | Gap 6 — investigate/fix spawn payloads |
| MODIFY | `src/worker/worker-agent.service.ts` | Gap 6 + Gap 7 — spawn + AgentResult gate |
| MODIFY | `src/contracts/index.ts` | re-export all new schemas |
| MODIFY | `src/contracts/contracts.spec.ts` | tests for all new schemas |

---

## Task 1: Gate `ValidatorAgentService.validate()` input

**Files:**
- Modify: `src/validator/validator-agent.service.ts`
- Modify: `src/contracts/contracts.spec.ts`

`ValidationRequestSchema` already exists in `src/contracts/validation-request.contract.ts` but is never called. The `validate()` method accepts a free `ValidationInput` interface. This task wires the existing schema as an input gate.

- [ ] **Step 1: Write the failing test**

Append to `src/contracts/contracts.spec.ts`:

```typescript
import { ValidationRequestSchema } from './validation-request.contract';

describe('ValidationRequestSchema — input gate', () => {
  it('accepts valid request', () => {
    const r = ValidationRequestSchema.safeParse({
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      output_ref: { result: 'ok' },
      acceptance_criteria: ['output_present'],
    });
    expect(r.success).toBe(true);
  });

  it('rejects non-uuid task_id', () => {
    const r = ValidationRequestSchema.safeParse({
      task_id: 'not-a-uuid',
      output_ref: {},
      acceptance_criteria: [],
    });
    expect(r.success).toBe(false);
  });

  it('rejects missing output_ref', () => {
    const r = ValidationRequestSchema.safeParse({
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      acceptance_criteria: [],
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm it passes (schema already exists)**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
npx jest src/contracts/contracts.spec.ts --no-coverage --testNamePattern="ValidationRequestSchema" 2>&1 | tail -10
```

Expected: `Tests: 3 passed`

- [ ] **Step 3: Wire input gate in ValidatorAgentService**

In `src/validator/validator-agent.service.ts`, add this import (already has `ValidationResultSchema` import — extend it):

```typescript
import { ValidationResultSchema, ValidationRequestSchema, parseOrThrow } from '../contracts';
```

Find the top of the `validate` method:

```typescript
async validate(input: ValidationInput): Promise<ValidationResult> {
  const start = Date.now();
  const findings: string[] = [];
```

Replace with:

```typescript
async validate(input: ValidationInput): Promise<ValidationResult> {
  parseOrThrow(ValidationRequestSchema, {
    task_id: input.taskId,
    output_ref: input.outputRef ?? {},
    acceptance_criteria: input.acceptanceCriteria,
  }, 'validator.validate.input');
  const start = Date.now();
  const findings: string[] = [];
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output

- [ ] **Step 5: Run full contracts spec**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: all tests pass

---

## Task 2: Event payload contracts for `EventsPublisher`

**Files:**
- Create: `src/contracts/events.contract.ts`
- Modify: `src/events/events.publisher.ts`
- Modify: `src/contracts/index.ts`
- Modify: `src/contracts/contracts.spec.ts`

`EventsPublisher.publish()` accepts `Record<string, any>` — any shape can slip through. This task adds per-event Zod schemas and validates at publish time.

- [ ] **Step 1: Write failing tests**

Append to `src/contracts/contracts.spec.ts`:

```typescript
import {
  TaskCreatedPayloadSchema,
  TaskCompletedPayloadSchema,
  TaskFailedPayloadSchema,
  TaskRequeuedPayloadSchema,
  GoalCreatedPayloadSchema,
  GoalActivatedPayloadSchema,
  GoalCompletedPayloadSchema,
  ProjectStalledPayloadSchema,
  CycleStartedPayloadSchema,
  CycleCompletedPayloadSchema,
} from './events.contract';

describe('Event payload schemas', () => {
  it('TaskCreatedPayloadSchema accepts valid payload', () => {
    const r = TaskCreatedPayloadSchema.safeParse({
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      project_id: '123e4567-e89b-12d3-a456-426614174001',
      goal_id: '123e4567-e89b-12d3-a456-426614174002',
      type: 'implement:feature',
      priority: 2,
    });
    expect(r.success).toBe(true);
  });

  it('TaskCreatedPayloadSchema rejects missing task_id', () => {
    const r = TaskCreatedPayloadSchema.safeParse({
      project_id: '123e4567-e89b-12d3-a456-426614174001',
      goal_id: null,
      type: 'implement:feature',
      priority: 2,
    });
    expect(r.success).toBe(false);
  });

  it('TaskFailedPayloadSchema accepts valid payload', () => {
    const r = TaskFailedPayloadSchema.safeParse({
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      error_code: 'BUDGET_EXCEEDED',
      attempt: 1,
    });
    expect(r.success).toBe(true);
  });

  it('TaskCompletedPayloadSchema accepts valid payload', () => {
    const r = TaskCompletedPayloadSchema.safeParse({
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      output_ref: { result: 'done' },
    });
    expect(r.success).toBe(true);
  });

  it('CycleStartedPayloadSchema accepts valid payload', () => {
    const r = CycleStartedPayloadSchema.safeParse({
      project_id: '123e4567-e89b-12d3-a456-426614174000',
      goal_id: '123e4567-e89b-12d3-a456-426614174001',
      cycle_number: 5,
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage --testNamePattern="Event payload" 2>&1 | tail -10
```

Expected: `Cannot find module './events.contract'`

- [ ] **Step 3: Create `src/contracts/events.contract.ts`**

```typescript
import { z } from 'zod';

const UuidString = z.string().uuid();
const NullableUuid = UuidString.nullable();

export const TaskCreatedPayloadSchema = z.object({
  task_id: UuidString,
  project_id: UuidString,
  goal_id: NullableUuid,
  type: z.string().min(1),
  priority: z.number().int(),
});
export type TaskCreatedPayload = z.infer<typeof TaskCreatedPayloadSchema>;

export const TaskAssignedPayloadSchema = z.object({
  task_id: UuidString,
  agent_id: z.string().min(1),
});
export type TaskAssignedPayload = z.infer<typeof TaskAssignedPayloadSchema>;

export const TaskCompletedPayloadSchema = z.object({
  task_id: UuidString,
  output_ref: z.record(z.string(), z.unknown()),
});
export type TaskCompletedPayload = z.infer<typeof TaskCompletedPayloadSchema>;

export const TaskFailedPayloadSchema = z.object({
  task_id: UuidString,
  error_code: z.string().min(1),
  attempt: z.number().int().nonnegative(),
});
export type TaskFailedPayload = z.infer<typeof TaskFailedPayloadSchema>;

export const TaskCancelledPayloadSchema = z.object({
  task_id: UuidString,
  reason: z.string().optional(),
});
export type TaskCancelledPayload = z.infer<typeof TaskCancelledPayloadSchema>;

export const TaskRequeuedPayloadSchema = z.object({
  task_id: UuidString,
  reason: z.string().min(1),
  attempt: z.number().int().nonnegative(),
});
export type TaskRequeuedPayload = z.infer<typeof TaskRequeuedPayloadSchema>;

export const GoalCreatedPayloadSchema = z.object({
  goal_id: UuidString,
  project_id: UuidString,
  title: z.string().min(1),
});
export type GoalCreatedPayload = z.infer<typeof GoalCreatedPayloadSchema>;

export const GoalActivatedPayloadSchema = z.object({
  goal_id: UuidString,
  project_id: UuidString,
});
export type GoalActivatedPayload = z.infer<typeof GoalActivatedPayloadSchema>;

export const GoalCompletedPayloadSchema = z.object({
  goal_id: UuidString,
  project_id: UuidString,
});
export type GoalCompletedPayload = z.infer<typeof GoalCompletedPayloadSchema>;

export const GoalAutoCompletedPayloadSchema = z.object({
  project_id: UuidString,
  goal_id: UuidString,
});
export type GoalAutoCompletedPayload = z.infer<typeof GoalAutoCompletedPayloadSchema>;

export const GoalAutoActivatedPayloadSchema = z.object({
  project_id: UuidString,
  goal_id: UuidString,
  title: z.string().min(1),
});
export type GoalAutoActivatedPayload = z.infer<typeof GoalAutoActivatedPayloadSchema>;

export const AgentFailedPayloadSchema = z.object({
  agent_id: z.string().min(1),
  reason: z.string().optional(),
});
export type AgentFailedPayload = z.infer<typeof AgentFailedPayloadSchema>;

export const AgentRetiredPayloadSchema = z.object({
  agent_id: z.string().min(1),
});
export type AgentRetiredPayload = z.infer<typeof AgentRetiredPayloadSchema>;

export const ProjectUpdatedPayloadSchema = z.object({
  project_id: UuidString,
}).passthrough();
export type ProjectUpdatedPayload = z.infer<typeof ProjectUpdatedPayloadSchema>;

export const ProjectStalledPayloadSchema = z.object({
  project_id: UuidString,
  last_cycle_at: z.union([z.string(), z.date(), z.null()]),
});
export type ProjectStalledPayload = z.infer<typeof ProjectStalledPayloadSchema>;

export const ProjectIdlePayloadSchema = z.object({
  project_id: UuidString,
  reason: z.string().min(1),
});
export type ProjectIdlePayload = z.infer<typeof ProjectIdlePayloadSchema>;

export const ProjectHealthDegradedPayloadSchema = z.object({
  project_id: UuidString,
  failure_rate: z.number().optional(),
}).passthrough();
export type ProjectHealthDegradedPayload = z.infer<typeof ProjectHealthDegradedPayloadSchema>;

export const OrchestratorEscalatedPayloadSchema = z.object({
  reason: z.string().min(1),
}).passthrough();
export type OrchestratorEscalatedPayload = z.infer<typeof OrchestratorEscalatedPayloadSchema>;

export const CycleStartedPayloadSchema = z.object({
  project_id: UuidString,
  goal_id: UuidString,
  cycle_number: z.number().int().nonnegative(),
});
export type CycleStartedPayload = z.infer<typeof CycleStartedPayloadSchema>;

export const CycleCompletedPayloadSchema = z.object({
  project_id: UuidString,
  tasks_created: z.number().int().nonnegative(),
  duration_ms: z.number().int().nonnegative(),
});
export type CycleCompletedPayload = z.infer<typeof CycleCompletedPayloadSchema>;

export const EVENT_PAYLOAD_SCHEMAS = {
  'task.created': TaskCreatedPayloadSchema,
  'task.assigned': TaskAssignedPayloadSchema,
  'task.completed': TaskCompletedPayloadSchema,
  'task.failed': TaskFailedPayloadSchema,
  'task.cancelled': TaskCancelledPayloadSchema,
  'task.requeued': TaskRequeuedPayloadSchema,
  'goal.created': GoalCreatedPayloadSchema,
  'goal.activated': GoalActivatedPayloadSchema,
  'goal.completed': GoalCompletedPayloadSchema,
  'goal.auto_completed': GoalAutoCompletedPayloadSchema,
  'goal.auto_activated': GoalAutoActivatedPayloadSchema,
  'agent.failed': AgentFailedPayloadSchema,
  'agent.retired': AgentRetiredPayloadSchema,
  'project.updated': ProjectUpdatedPayloadSchema,
  'project.stalled': ProjectStalledPayloadSchema,
  'project.idle': ProjectIdlePayloadSchema,
  'project.health_degraded': ProjectHealthDegradedPayloadSchema,
  'orchestrator.escalated': OrchestratorEscalatedPayloadSchema,
  'cycle.started': CycleStartedPayloadSchema,
  'cycle.completed': CycleCompletedPayloadSchema,
} as const;
```

- [ ] **Step 4: Update `src/contracts/index.ts` to export events.contract**

Read the current `src/contracts/index.ts` and add this line at the end:

```typescript
export * from './events.contract';
```

- [ ] **Step 5: Wire validation in `EventsPublisher.publish()`**

In `src/events/events.publisher.ts`, add import:

```typescript
import { EVENT_PAYLOAD_SCHEMAS } from '../contracts/events.contract';
import { parseOrThrow } from '../contracts/parse-or-throw';
```

Find the `publish` method:

```typescript
async publish(type: EventType, data: Record<string, any>): Promise<void> {
  if (!this.connected) return;
  const envelope = {
```

Replace with:

```typescript
async publish(type: EventType, data: Record<string, any>): Promise<void> {
  if (!this.connected) return;
  const schema = EVENT_PAYLOAD_SCHEMAS[type];
  if (schema) {
    parseOrThrow(schema, data, `events.publish.${type}`);
  }
  const envelope = {
```

- [ ] **Step 6: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output

- [ ] **Step 7: Run failing tests now pass**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage --testNamePattern="Event payload" 2>&1 | tail -10
```

Expected: `Tests: 5 passed`

---

## Task 3: Notification send contracts

**Files:**
- Create: `src/contracts/notifications.contract.ts`
- Modify: `src/common/notifications/notifications.client.ts`
- Modify: `src/contracts/index.ts`
- Modify: `src/contracts/contracts.spec.ts`

`NotificationsClient` builds 3 different POST payloads inline as plain objects. This task defines schemas for each and validates before posting.

- [ ] **Step 1: Write failing tests**

Append to `src/contracts/contracts.spec.ts`:

```typescript
import {
  TelegramDigestSendSchema,
  TelegramCustomSendSchema,
  EmailCustomSendSchema,
} from './notifications.contract';

describe('Notification send schemas', () => {
  it('TelegramDigestSendSchema accepts valid digest payload', () => {
    const r = TelegramDigestSendSchema.safeParse({
      channel: 'telegram',
      type: 'digest',
      recipient: '123456',
      service: 'business-orchestrator',
    });
    expect(r.success).toBe(true);
  });

  it('TelegramDigestSendSchema rejects wrong channel', () => {
    const r = TelegramDigestSendSchema.safeParse({
      channel: 'sms',
      type: 'digest',
      recipient: '123456',
      service: 'business-orchestrator',
    });
    expect(r.success).toBe(false);
  });

  it('TelegramCustomSendSchema accepts valid custom payload', () => {
    const r = TelegramCustomSendSchema.safeParse({
      channel: 'telegram',
      type: 'custom',
      recipient: '123456',
      subject: 'Alert',
      message: 'Something happened',
      templateData: {},
      service: 'business-orchestrator',
    });
    expect(r.success).toBe(true);
  });

  it('EmailCustomSendSchema accepts valid email payload', () => {
    const r = EmailCustomSendSchema.safeParse({
      channel: 'email',
      type: 'custom',
      recipient: 'test@example.com',
      subject: 'Alert',
      message: 'Something happened',
      service: 'business-orchestrator',
    });
    expect(r.success).toBe(true);
  });

  it('TelegramCustomSendSchema rejects missing subject', () => {
    const r = TelegramCustomSendSchema.safeParse({
      channel: 'telegram',
      type: 'custom',
      recipient: '123456',
      message: 'oops',
      templateData: {},
      service: 'business-orchestrator',
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage --testNamePattern="Notification send" 2>&1 | tail -10
```

Expected: `Cannot find module './notifications.contract'`

- [ ] **Step 3: Create `src/contracts/notifications.contract.ts`**

```typescript
import { z } from 'zod';

export const TelegramDigestSendSchema = z.object({
  channel: z.literal('telegram'),
  type: z.literal('digest'),
  recipient: z.string().min(1),
  service: z.string().min(1),
});
export type TelegramDigestSend = z.infer<typeof TelegramDigestSendSchema>;

export const EmailDigestSendSchema = z.object({
  channel: z.literal('email'),
  type: z.literal('digest'),
  recipient: z.string().email(),
  service: z.string().min(1),
});
export type EmailDigestSend = z.infer<typeof EmailDigestSendSchema>;

export const TelegramCustomSendSchema = z.object({
  channel: z.literal('telegram'),
  type: z.literal('custom'),
  recipient: z.string().min(1),
  subject: z.string().min(1),
  message: z.string().min(1),
  templateData: z.record(z.string(), z.unknown()).default({}),
  service: z.string().min(1),
  inlineKeyboard: z.array(z.array(z.object({
    text: z.string(),
    callback_data: z.string(),
  }))).optional(),
});
export type TelegramCustomSend = z.infer<typeof TelegramCustomSendSchema>;

export const EmailCustomSendSchema = z.object({
  channel: z.literal('email'),
  type: z.literal('custom'),
  recipient: z.string().email(),
  subject: z.string().min(1),
  message: z.string().min(1),
  service: z.string().min(1),
});
export type EmailCustomSend = z.infer<typeof EmailCustomSendSchema>;
```

- [ ] **Step 4: Add export to `src/contracts/index.ts`**

```typescript
export * from './notifications.contract';
```

- [ ] **Step 5: Wire validation in `NotificationsClient`**

Add to imports in `src/common/notifications/notifications.client.ts`:

```typescript
import {
  TelegramDigestSendSchema,
  EmailDigestSendSchema,
  TelegramCustomSendSchema,
  EmailCustomSendSchema,
} from '../../contracts/notifications.contract';
import { parseOrThrow } from '../../contracts/parse-or-throw';
```

In `_sendDigestToChannel`, find the telegram digest POST:

```typescript
await this.http.post('/notifications/send', {
  channel: 'telegram',
  type: 'digest',
  recipient: telegramChatId,
  service: 'business-orchestrator',
});
```

Replace with:

```typescript
const payload = parseOrThrow(TelegramDigestSendSchema, {
  channel: 'telegram',
  type: 'digest',
  recipient: telegramChatId,
  service: 'business-orchestrator',
}, 'notifications.telegram_digest');
await this.http.post('/notifications/send', payload);
```

In `_sendDigestToChannel`, find the email digest POST (inside the `for` loop):

```typescript
await this.http
  .post('/notifications/send', {
    channel: 'email',
    type: 'digest',
    recipient,
    service: 'business-orchestrator',
  })
```

Replace with:

```typescript
const emailPayload = parseOrThrow(EmailDigestSendSchema, {
  channel: 'email',
  type: 'digest',
  recipient,
  service: 'business-orchestrator',
}, 'notifications.email_digest');
await this.http.post('/notifications/send', emailPayload)
```

In `_sendDigestOnce`, find the POST:

```typescript
await this.http.post('/notifications/send', {
  channel: 'telegram',
  type: 'custom',
  recipient: telegramChatId,
  subject,
  message: body,
  templateData: metadata ?? {},
  service: 'business-orchestrator',
});
```

Replace with:

```typescript
const customPayload = parseOrThrow(TelegramCustomSendSchema, {
  channel: 'telegram',
  type: 'custom',
  recipient: telegramChatId,
  subject,
  message: body,
  templateData: metadata ?? {},
  service: 'business-orchestrator',
}, 'notifications.custom_digest');
await this.http.post('/notifications/send', customPayload);
```

In `sendEmail`, find the POST (inside the `for` loop):

```typescript
await this.http
  .post('/notifications/send', {
    channel: 'email',
    type: 'custom',
    recipient,
    subject,
    message: body,
    service: 'business-orchestrator',
  })
```

Replace with:

```typescript
const emailCustomPayload = parseOrThrow(EmailCustomSendSchema, {
  channel: 'email',
  type: 'custom',
  recipient,
  subject,
  message: body,
  service: 'business-orchestrator',
}, 'notifications.send_email');
await this.http.post('/notifications/send', emailCustomPayload)
```

In `_escalateOnce`, the payload has an optional `inlineKeyboard`. Build the payload object, then validate:

```typescript
const escPayload = parseOrThrow(TelegramCustomSendSchema, {
  channel: 'telegram',
  type: 'custom',
  recipient: telegramChatId,
  subject: alert.subject,
  message: alert.body,
  templateData: {
    level: alert.level,
    projectId: alert.projectId,
    taskId: alert.taskId,
    ...(alert.metadata ?? {}),
  },
  service: 'business-orchestrator',
  ...(alert.escalationId ? {
    inlineKeyboard: [[
      { text: 'Acknowledge', callback_data: `esc:acknowledge:${alert.escalationId}` },
      { text: 'Resolve', callback_data: `esc:resolve:${alert.escalationId}` },
    ]],
  } : {}),
}, 'notifications.escalate');
await this.http.post('/notifications/send', escPayload);
```

Remove the old `payload` variable and `if (alert.escalationId)` block entirely.

- [ ] **Step 6: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output

- [ ] **Step 7: Run tests pass**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage --testNamePattern="Notification send" 2>&1 | tail -10
```

Expected: `Tests: 5 passed`

---

## Task 4: Log entry contract

**Files:**
- Create: `src/contracts/logging.contract.ts`
- Modify: `src/common/logging/logging.client.ts`
- Modify: `src/contracts/index.ts`
- Modify: `src/contracts/contracts.spec.ts`

`LoggingClient.log()` accepts a freeform `LogEntry` interface with no validation before the HTTP POST.

- [ ] **Step 1: Write failing test**

Append to `src/contracts/contracts.spec.ts`:

```typescript
import { LogEntrySchema } from './logging.contract';

describe('LogEntrySchema', () => {
  it('accepts valid log entry', () => {
    const r = LogEntrySchema.safeParse({
      level: 'info',
      msg: 'task_started',
      durationMs: 0,
      metadata: {},
    });
    expect(r.success).toBe(true);
  });

  it('accepts entry with all optional fields', () => {
    const r = LogEntrySchema.safeParse({
      level: 'error',
      msg: 'something_failed',
      correlationId: 'abc',
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      taskId: '123e4567-e89b-12d3-a456-426614174001',
      agentId: 'agent-1',
      durationMs: 200,
      metadata: { detail: 'x' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid level', () => {
    const r = LogEntrySchema.safeParse({
      level: 'verbose',
      msg: 'test',
      durationMs: 0,
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty msg', () => {
    const r = LogEntrySchema.safeParse({
      level: 'info',
      msg: '',
      durationMs: 0,
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage --testNamePattern="LogEntrySchema" 2>&1 | tail -10
```

Expected: `Cannot find module './logging.contract'`

- [ ] **Step 3: Create `src/contracts/logging.contract.ts`**

```typescript
import { z } from 'zod';

export const LogEntrySchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  level: z.enum(['info', 'warn', 'error']),
  msg: z.string().min(1),
  correlationId: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  agentId: z.string().optional(),
  durationMs: z.number().int().nonnegative().default(0),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;
```

- [ ] **Step 4: Add export to `src/contracts/index.ts`**

```typescript
export * from './logging.contract';
```

- [ ] **Step 5: Wire validation in `LoggingClient.log()`**

In `src/common/logging/logging.client.ts`, delete the existing `LogEntry` interface and replace with the import:

```typescript
import { LogEntrySchema, LogEntry } from '../../contracts/logging.contract';
import { parseOrThrow } from '../../contracts/parse-or-throw';
```

In the `log` method, add parsing before the try block:

```typescript
async log(entry: LogEntry): Promise<void> {
  const validated = parseOrThrow(LogEntrySchema, entry, 'logging.log');
  try {
    await this.http.post('/api/logs', {
      service: 'business-orchestrator',
      level: validated.level,
      message: validated.msg,
      msg: validated.msg,
      correlation_id: validated.correlationId,
      project_id: validated.projectId,
      task_id: validated.taskId,
      agent_id: validated.agentId,
      duration_ms: validated.durationMs,
      timestamp: new Date().toISOString(),
      metadata: validated.metadata,
    });
  } catch {
    // Logging must never crash the service
  }
}
```

- [ ] **Step 6: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output

- [ ] **Step 7: Run tests pass**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage --testNamePattern="LogEntrySchema" 2>&1 | tail -10
```

Expected: `Tests: 4 passed`

---

## Task 5: Auth validate response contract

**Files:**
- Create: `src/contracts/auth.contract.ts`
- Modify: `src/common/auth/jwt.guard.ts`
- Modify: `src/contracts/index.ts`
- Modify: `src/contracts/contracts.spec.ts`

`JwtGuard` casts the `/auth/validate` response to `any` and reads `data.valid` and `data.userId` without validation.

- [ ] **Step 1: Write failing test**

Append to `src/contracts/contracts.spec.ts`:

```typescript
import { AuthValidateResponseSchema } from './auth.contract';

describe('AuthValidateResponseSchema', () => {
  it('accepts valid=true response with userId', () => {
    const r = AuthValidateResponseSchema.safeParse({ valid: true, userId: 'user-123' });
    expect(r.success).toBe(true);
  });

  it('accepts valid=false response', () => {
    const r = AuthValidateResponseSchema.safeParse({ valid: false });
    expect(r.success).toBe(true);
  });

  it('accepts response with user.id instead of userId', () => {
    const r = AuthValidateResponseSchema.safeParse({ valid: true, user: { id: 'user-123' } });
    expect(r.success).toBe(true);
  });

  it('rejects missing valid field', () => {
    const r = AuthValidateResponseSchema.safeParse({ userId: 'user-123' });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage --testNamePattern="AuthValidateResponseSchema" 2>&1 | tail -10
```

Expected: `Cannot find module './auth.contract'`

- [ ] **Step 3: Create `src/contracts/auth.contract.ts`**

```typescript
import { z } from 'zod';

export const AuthValidateResponseSchema = z.object({
  valid: z.boolean(),
  userId: z.string().optional(),
  user: z.object({ id: z.string() }).optional(),
}).passthrough();
export type AuthValidateResponse = z.infer<typeof AuthValidateResponseSchema>;
```

- [ ] **Step 4: Add export to `src/contracts/index.ts`**

```typescript
export * from './auth.contract';
```

- [ ] **Step 5: Wire validation in `JwtGuard.canActivate()`**

In `src/common/auth/jwt.guard.ts`, add import:

```typescript
import { AuthValidateResponseSchema } from '../../contracts/auth.contract';
import { parseOrThrow } from '../../contracts/parse-or-throw';
```

Find:

```typescript
const { data } = await this.http.post('/auth/validate', { token });
if (!data.valid) throw new UnauthorizedException('Invalid token');
request.userId = data.userId ?? data.user?.id;
```

Replace with:

```typescript
const { data } = await this.http.post('/auth/validate', { token });
const authResponse = parseOrThrow(AuthValidateResponseSchema, data, 'jwt.auth_validate');
if (!authResponse.valid) throw new UnauthorizedException('Invalid token');
request.userId = authResponse.userId ?? authResponse.user?.id;
```

- [ ] **Step 6: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output

- [ ] **Step 7: Run tests pass**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage --testNamePattern="AuthValidateResponseSchema" 2>&1 | tail -10
```

Expected: `Tests: 4 passed`

---

## Task 6: Investigate/fix spawn payload contracts

**Files:**
- Create: `src/contracts/spawn-payload.contract.ts`
- Modify: `src/worker/worker-agent.service.ts`
- Modify: `src/contracts/index.ts`
- Modify: `src/contracts/contracts.spec.ts`

`WorkerAgentService.spawnInvestigateFixChain()` builds `investigate:*` and `fix:*` task payloads as plain inline objects with no validation before `tasksService.create()`.

- [ ] **Step 1: Write failing test**

Append to `src/contracts/contracts.spec.ts`:

```typescript
import { InvestigatePayloadSchema, FixPayloadSchema } from './spawn-payload.contract';

describe('Spawn payload schemas', () => {
  it('InvestigatePayloadSchema accepts valid payload', () => {
    const r = InvestigatePayloadSchema.safeParse({
      source_task_id: '123e4567-e89b-12d3-a456-426614174000',
      source_task_type: 'implement:feature',
      blocked_reason: 'BUDGET_EXCEEDED',
      acceptance_criteria: ['identify root cause'],
      original_payload: { description: 'do X' },
      coding_error_log: [],
    });
    expect(r.success).toBe(true);
  });

  it('InvestigatePayloadSchema rejects non-uuid source_task_id', () => {
    const r = InvestigatePayloadSchema.safeParse({
      source_task_id: 'not-a-uuid',
      source_task_type: 'implement:feature',
      blocked_reason: 'BUDGET_EXCEEDED',
      acceptance_criteria: [],
      original_payload: {},
      coding_error_log: [],
    });
    expect(r.success).toBe(false);
  });

  it('FixPayloadSchema accepts valid payload', () => {
    const r = FixPayloadSchema.safeParse({
      source_task_id: '123e4567-e89b-12d3-a456-426614174000',
      source_task_type: 'implement:feature',
      blocked_reason: 'VALIDATION_FAILED',
      investigate_task_id: '123e4567-e89b-12d3-a456-426614174001',
      original_payload: {},
      acceptance_criteria: ['apply fix'],
      coding_error_log: [],
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage --testNamePattern="Spawn payload" 2>&1 | tail -10
```

Expected: `Cannot find module './spawn-payload.contract'`

- [ ] **Step 3: Create `src/contracts/spawn-payload.contract.ts`**

```typescript
import { z } from 'zod';

export const InvestigatePayloadSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  source_task_id: z.string().uuid(),
  source_task_type: z.string().min(1),
  blocked_reason: z.string().min(1),
  acceptance_criteria: z.array(z.string()),
  original_payload: z.record(z.string(), z.unknown()),
  coding_error_log: z.array(z.unknown()).default([]),
});
export type InvestigatePayload = z.infer<typeof InvestigatePayloadSchema>;

export const FixPayloadSchema = z.object({
  schemaVersion: z.literal('1.0').default('1.0'),
  source_task_id: z.string().uuid(),
  source_task_type: z.string().min(1),
  blocked_reason: z.string().min(1),
  investigate_task_id: z.string().uuid(),
  original_payload: z.record(z.string(), z.unknown()),
  acceptance_criteria: z.array(z.string()),
  coding_error_log: z.array(z.unknown()).default([]),
});
export type FixPayload = z.infer<typeof FixPayloadSchema>;
```

- [ ] **Step 4: Add export to `src/contracts/index.ts`**

```typescript
export * from './spawn-payload.contract';
```

- [ ] **Step 5: Wire validation in `WorkerAgentService.spawnInvestigateFixChain()`**

In `src/worker/worker-agent.service.ts`, add imports at top:

```typescript
import { TaskPayloadSchema, InvestigatePayloadSchema, FixPayloadSchema, parseOrThrow } from '../contracts';
```

Find the `investigateTask` creation in `spawnInvestigateFixChain` (around line 540):

```typescript
const investigateTask = await this.tasksService.create({
  projectId: failedTask.projectId,
  goalId: failedTask.goalId,
  type: `investigate:${failedTask.type}`,
  targetService: failedTask.targetService ?? undefined,
  payloadRef: {
    source_task_id: failedTask.id,
    source_task_type: failedTask.type,
    blocked_reason: reason,
    acceptance_criteria: failedTask.acceptanceCriteria,
    original_payload: failedTask.payloadRef,
    coding_error_log: failedTask.codingErrorLog ?? [],
  },
```

Replace the `payloadRef` value with:

```typescript
  payloadRef: parseOrThrow(InvestigatePayloadSchema, {
    source_task_id: failedTask.id,
    source_task_type: failedTask.type,
    blocked_reason: reason,
    acceptance_criteria: failedTask.acceptanceCriteria,
    original_payload: failedTask.payloadRef,
    coding_error_log: failedTask.codingErrorLog ?? [],
  }, 'worker.spawn_investigate'),
```

Find the `fix:*` task creation (a few lines below):

```typescript
  payloadRef: {
    source_task_id: failedTask.id,
    source_task_type: failedTask.type,
    blocked_reason: reason,
    investigate_task_id: investigateTask.id,
    original_payload: failedTask.payloadRef,
    acceptance_criteria: failedTask.acceptanceCriteria,
    coding_error_log: failedTask.codingErrorLog ?? [],
  },
```

Replace with:

```typescript
  payloadRef: parseOrThrow(FixPayloadSchema, {
    source_task_id: failedTask.id,
    source_task_type: failedTask.type,
    blocked_reason: reason,
    investigate_task_id: investigateTask.id,
    original_payload: failedTask.payloadRef,
    acceptance_criteria: failedTask.acceptanceCriteria,
    coding_error_log: failedTask.codingErrorLog ?? [],
  }, 'worker.spawn_fix'),
```

- [ ] **Step 6: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output

- [ ] **Step 7: Run tests pass**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage --testNamePattern="Spawn payload" 2>&1 | tail -10
```

Expected: `Tests: 3 passed`

---

## Task 7: `AgentResult` output gate in `WorkerAgentService`

**Files:**
- Modify: `src/worker/worker-agent.service.ts`
- Modify: `src/contracts/contracts.spec.ts`

`AgentResultSchema` is defined in `src/contracts/agent-result.contract.ts` but `WorkerAgentService` never parses the AI response through it. This task adds `parseOrThrow(AgentResultSchema, ...)` immediately after a successful `aiHttp.call()`.

The `AgentResultSchema` requires `text` and `model_used`. The existing AI call returns these alongside `output_ref`, so the parse must happen after the `output_ref` recovery block (where text is parsed into `output_ref`) — not before it.

- [ ] **Step 1: Write failing test for AgentResult schema**

Append to `src/contracts/contracts.spec.ts`:

```typescript
import { AgentResultSchema } from './agent-result.contract';

describe('AgentResultSchema — output gate', () => {
  it('accepts valid result with output_ref', () => {
    const r = AgentResultSchema.safeParse({
      output_ref: { result: 'done' },
      text: '{"output_ref":{"result":"done"}}',
      model_used: 'claude-sonnet-4-6',
      inputTokens: 100,
      outputTokens: 50,
      token_usage_estimate: 150,
    });
    expect(r.success).toBe(true);
  });

  it('rejects negative inputTokens', () => {
    const r = AgentResultSchema.safeParse({
      output_ref: {},
      text: 'hi',
      model_used: 'gpt-4',
      inputTokens: -1,
      outputTokens: 10,
    });
    expect(r.success).toBe(false);
  });

  it('accepts result without optional token fields', () => {
    const r = AgentResultSchema.safeParse({
      output_ref: { x: 1 },
      text: 'hi',
      model_used: 'gpt-4',
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm it passes (schema already exists)**

```bash
npx jest src/contracts/contracts.spec.ts --no-coverage --testNamePattern="AgentResultSchema" 2>&1 | tail -10
```

Expected: `Tests: 3 passed` (schema exists; tests just weren't there)

- [ ] **Step 3: Wire `AgentResultSchema` gate in `WorkerAgentService._executeInner()`**

In `src/worker/worker-agent.service.ts`, update the imports line to include `AgentResultSchema`:

```typescript
import { TaskPayloadSchema, InvestigatePayloadSchema, FixPayloadSchema, AgentResultSchema, parseOrThrow } from '../contracts';
```

Find the block after `aiResponse` is set via `aiHttp.call` (after the `output_ref` recovery block that ends with `aiResponse = { error_code: 'INVALID_JSON' }`). The parse gate must go immediately before the `errorCode` extraction:

Find:

```typescript
    const errorCode = aiResponse?.error_code;
```

Insert above it:

```typescript
    if (aiResponse && !aiResponse.error_code && 'output_ref' in aiResponse) {
      parseOrThrow(AgentResultSchema, {
        output_ref: aiResponse.output_ref ?? {},
        text: aiResponse.text ?? '',
        model_used: aiResponse.model_used ?? '',
        inputTokens: aiResponse.inputTokens,
        outputTokens: aiResponse.outputTokens,
        token_usage_estimate: aiResponse.token_usage_estimate,
      }, 'worker.agent_result');
    }
    const errorCode = aiResponse?.error_code;
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output

---

## Task 8: Final integration — run full suite

- [ ] **Step 1: Run all contract tests**

```bash
npx jest src/contracts/ --no-coverage 2>&1 | tail -20
```

Expected: all tests pass, 0 failures

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -25
```

Expected: all previously-passing tests still pass

- [ ] **Step 3: TypeScript build**

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors)

- [ ] **Step 4: Post completion comment on issue #21**

```bash
gh issue comment 21 --repo speakASAP/business-orchestrator \
  --body "## Completed

**What was done:**
- Gap 1: \`ValidatorAgentService.validate()\` input gated with \`ValidationRequestSchema\`
- Gap 2: \`EventsPublisher.publish()\` validates per-event payload via \`EVENT_PAYLOAD_SCHEMAS\` map (20 event types)
- Gap 3: \`NotificationsClient\` validates all 3 send-shapes before HTTP POST
- Gap 4: \`LoggingClient.log()\` validates \`LogEntrySchema\` before HTTP POST
- Gap 5: \`JwtGuard\` validates \`/auth/validate\` response via \`AuthValidateResponseSchema\`
- Gap 6: \`WorkerAgentService\` validates investigate/fix spawn payloads via named schemas
- Gap 7: \`AgentResultSchema\` parse gate added after every successful AI call in worker pipeline
- Gap 8: Tests added for all new schemas in \`contracts.spec.ts\`

**Files changed:**
- \`src/contracts/events.contract.ts\` (created)
- \`src/contracts/notifications.contract.ts\` (created)
- \`src/contracts/logging.contract.ts\` (created)
- \`src/contracts/auth.contract.ts\` (created)
- \`src/contracts/spawn-payload.contract.ts\` (created)
- \`src/contracts/index.ts\` (updated exports)
- \`src/contracts/contracts.spec.ts\` (tests added)
- \`src/validator/validator-agent.service.ts\` (input gate)
- \`src/events/events.publisher.ts\` (event validation)
- \`src/common/notifications/notifications.client.ts\` (payload validation)
- \`src/common/logging/logging.client.ts\` (entry validation)
- \`src/common/auth/jwt.guard.ts\` (response validation)
- \`src/worker/worker-agent.service.ts\` (spawn + AgentResult gates)

**Outcome:** All 8 contract gaps are closed. Every agent-to-agent and agent-to-service JSON message is now validated with \`parseOrThrow\` — malformed payloads throw \`ContractViolationError\` immediately."

gh issue close 21 --repo speakASAP/business-orchestrator
```

---

## Self-Review

**Spec coverage vs Issue #21 definition of done:**
- ✅ `ValidationRequestSchema` gates every `ValidatorAgentService.validate()` call — Task 1
- ✅ `EventsPublisher.publish()` typed per-event and validated — Task 2
- ✅ `NotificationsClient` has schemas for all 3 send-shapes — Task 3
- ✅ `LoggingClient.log()` has `LogEntrySchema` — Task 4
- ✅ `AuthGuard` validates `/auth/validate` response — Task 5
- ✅ Worker investigate/fix spawn payloads have named schemas — Task 6
- ✅ `AgentResult` output parsed via `parseOrThrow` after AI call in `WorkerAgentService` — Task 7
- ✅ All new schemas have tests in `contracts.spec.ts` — Tasks 1–7
- ✅ `schemaVersion: '1.0'` present in all new schemas that store data (logging, spawn) — Tasks 4, 6

**Placeholder scan:** None found. All steps include exact code.

**Type consistency:**
- `parseOrThrow` is from `src/contracts/parse-or-throw.ts` (already exists) — used consistently throughout
- `EVENT_PAYLOAD_SCHEMAS` map keys match the `EventType` union in `events.publisher.ts`
- `LogEntry` type from `logging.contract.ts` replaces the existing interface in `logging.client.ts` — same field names
