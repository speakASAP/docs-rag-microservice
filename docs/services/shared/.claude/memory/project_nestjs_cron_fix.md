---
name: NestJS @Cron Fix — Node.js v24 + reflect-metadata incompatibility
description: Root cause and permanent fix for @Cron decorators not firing in NestJS on Node.js v22+/v24
type: project
originSessionId: 97bfe054-af9a-4643-8724-d69dfed69d9b
---
## Root Cause

Node.js v22+ has a native `Reflect.decorate` that does NOT convert `null` descriptor to the actual property descriptor. TypeScript compiles `@Cron` as `__decorate([Cron(...)], Class.prototype, 'method', null)`. On Node.js v24 this causes `SetMetadata` to fail silently — metadata never stored on the method reference. `ScheduleExplorer.explore()` then finds no cron jobs and registers nothing.

**Symptom:** Service starts, crons logged at `addCron` time, but no `[Cron]` ticks, no Redis lease keys, no dispatch events.

## Permanent Fix (in source code)

**File:** `runlayer/src/main.ts`

Monkey-patch `Reflect.decorate` immediately after `import 'reflect-metadata'`:

```typescript
import 'reflect-metadata';

const _originalDecorate = (Reflect as any).decorate;
(Reflect as any).decorate = function (decorators: any[], target: any, key?: any, desc?: any) {
  if (key !== undefined && desc === null) {
    desc = Object.getOwnPropertyDescriptor(target, key) || null;
  }
  return _originalDecorate.call(this, decorators, target, key, desc);
};
```

**Also:** `Dockerfile` changed to `node:22-slim` for both builder and runtime stages to avoid the issue at the image level.

## Runtime Workaround (K8s ConfigMap)

ConfigMap `bo-startup-patch` in `statex-apps` namespace contains a `patch.js` that applies the Reflect.decorate patch to `dist/main.js` at startup. Container command overridden to: `sh -c "node /etc/bo-patch/patch.js && node dist/main"`. This allows the fix to survive until the image is rebuilt.

**Why:** Docker builder was broken (overlay2 symlink corruption at `/mnt/docker-data/docker/`) at the time. Fix is in source so next image rebuild will include it natively.

## K8s Deployment Gotcha

`runlayer` K8s container name is `app` (not `runlayer`). Strategic merge patch that specifies wrong container name adds a SECOND container and wipes `envFrom` from the original `app` container. Always use the correct container name or `kubectl replace -f` with full manifest.

**Why:** `envFrom` references `runlayer-config` (ConfigMap) and `runlayer-secret` (Secret) for all DB/Redis/etc credentials.

## Verification

After fix: `[SCHED] addCron: */10 * * * * *` appears in logs AND `[WP] dispatch called` appears every 10s.
