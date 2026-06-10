# Worker Self-Heal, URL Routing & Task Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the worker-disable bug (heartbeat monitor self-heals workers to idle instead of disabling them, failure count resets on success), shrink the disabled-workers banner to a compact chip, add `history.pushState` URL routing so every task/goal/project has a shareable URL, and show full step logs inline on each task detail view — matching the agentic-email-processing-system pattern.

**Architecture:** Three independent layers of change: (1) backend `AgentsService` + `HeartbeatMonitorService` TypeScript fix, (2) frontend `public/app.js` URL router using `history.pushState` + `popstate`, (3) frontend task detail view that loads and renders step logs from the existing `/api/dashboard/tasks/:taskId/logs` endpoint using expandable log timeline already in the CSS.

**Tech Stack:** NestJS (TypeScript), Jest (unit tests), vanilla JS (no framework), existing `step-log-*` CSS classes, existing `/api/dashboard/tasks/:taskId/logs` endpoint.

---

## File Map

| File | Change |
|------|--------|
| `src/agents/agents.service.ts` | `markIdle()` resets `failureCount`; `recordFailure()` log message improved |
| `src/agents/heartbeat-monitor.service.ts` | Stale-busy workers → `idle` instead of `disabled` |
| `src/dashboard/dashboard.controller.spec.ts` | Update/add tests for new heartbeat behavior |
| `public/app.js` | Add URL router (`navigate()`, `popstate`); shrink banner; task rows clickable → log view |
| `public/style.css` | Shrink banner CSS; add task-detail panel styles |

---

## Task 1: Fix `markIdle` to Reset Failure Count

**Files:**
- Modify: `src/agents/agents.service.ts:56-61`

- [ ] **Step 1: Write failing test**

Add to `src/dashboard/dashboard.controller.spec.ts` (or create `src/agents/agents.service.spec.ts` if it doesn't exist yet — check with `ls src/agents/`):

```typescript
// src/agents/agents.service.spec.ts
import { AgentsService } from './agents.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Agent } from './agent.entity';
import { Test } from '@nestjs/testing';

describe('AgentsService.markIdle', () => {
  let service: AgentsService;
  let mockRepo: any;
  let mockLogger: any;

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((a) => a),
      createQueryBuilder: jest.fn(),
    };
    mockLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: getRepositoryToken(Agent), useValue: mockRepo },
        { provide: 'LoggingClient', useValue: mockLogger },
      ],
    }).compile();

    service = module.get(AgentsService);
  });

  it('resets failureCount to 0 when marking idle', async () => {
    const agent = { id: 'a1', status: 'busy', failureCount: 2, currentTaskId: 'task-1' } as Agent;
    mockRepo.findOne.mockResolvedValue(agent);

    const result = await service.markIdle('a1');

    expect(result.failureCount).toBe(0);
    expect(result.status).toBe('idle');
    expect(result.currentTaskId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/ssf/Documents/Github/runlayer
npx jest src/agents/agents.service.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `expect(received).toBe(0)` because `failureCount` is not reset.

- [ ] **Step 3: Fix `markIdle` to reset `failureCount`**

In `src/agents/agents.service.ts`, change lines 56-61:

```typescript
async markIdle(id: string): Promise<Agent> {
  const agent = await this.findOne(id);
  agent.status = 'idle';
  agent.currentTaskId = null;
  agent.failureCount = 0;
  return this.repo.save(agent);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/agents/agents.service.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS — 1 test suite, 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add src/agents/agents.service.ts src/agents/agents.service.spec.ts
git commit -m "fix(agents): reset failureCount to 0 on markIdle so recovered workers can retry"
```

---

## Task 2: Fix Heartbeat Monitor to Self-Heal Workers (idle, not disabled)

**Files:**
- Modify: `src/agents/heartbeat-monitor.service.ts:27-29`

The current code calls `markDisabled(agent.id)` for any worker that is `busy` but missed its heartbeat window. This permanently kills workers even when the pod simply restarted. The fix: call `markIdle` instead so the worker re-enters the pool.

- [ ] **Step 1: Write failing test**

Create `src/agents/heartbeat-monitor.service.spec.ts`:

```typescript
import { HeartbeatMonitorService } from './heartbeat-monitor.service';

describe('HeartbeatMonitorService.checkStaleAgents', () => {
  let service: HeartbeatMonitorService;
  let mockAgents: any;
  let mockTasks: any;
  let mockGateway: any;
  let mockLogger: any;

  beforeEach(() => {
    mockAgents = {
      findStaleBusy: jest.fn(),
      markIdle: jest.fn().mockResolvedValue({ id: 'a1', status: 'idle' }),
    };
    mockTasks = {
      resetOrFail: jest.fn().mockResolvedValue({ id: 't1', projectId: 'p1', status: 'created', type: 'coding' }),
    };
    mockGateway = {
      emitTaskUpdate: jest.fn(),
      emitAgentUpdate: jest.fn(),
    };
    mockLogger = { log: jest.fn().mockResolvedValue(undefined) };

    service = new HeartbeatMonitorService(mockAgents, mockTasks, mockGateway, mockLogger);
  });

  it('sets stale-busy workers to idle (not disabled)', async () => {
    mockAgents.findStaleBusy.mockResolvedValue([
      { id: 'a1', currentTaskId: 't1' },
    ]);

    await service.checkStaleAgents();

    expect(mockAgents.markIdle).toHaveBeenCalledWith('a1');
    expect(mockGateway.emitAgentUpdate).toHaveBeenCalledWith({ agentId: 'a1', status: 'idle' });
  });

  it('resets the task belonging to the stale agent', async () => {
    mockAgents.findStaleBusy.mockResolvedValue([
      { id: 'a1', currentTaskId: 't1' },
    ]);

    await service.checkStaleAgents();

    expect(mockTasks.resetOrFail).toHaveBeenCalledWith('t1');
    expect(mockGateway.emitTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't1' }),
    );
  });

  it('does nothing when no stale agents', async () => {
    mockAgents.findStaleBusy.mockResolvedValue([]);

    await service.checkStaleAgents();

    expect(mockAgents.markIdle).not.toHaveBeenCalled();
    expect(mockLogger.log).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/agents/heartbeat-monitor.service.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `markIdle` not called, `markDisabled` was called instead.

- [ ] **Step 3: Change heartbeat monitor to call `markIdle` and emit `idle`**

Replace `src/agents/heartbeat-monitor.service.ts` entirely:

```typescript
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AgentsService } from './agents.service';
import { TasksService } from '../tasks/tasks.service';
import { DashboardGateway } from '../dashboard/dashboard.gateway';
import { LoggingClient } from '../common/logging/logging.client';

const HEARTBEAT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — matches 900s task timeout

@Injectable()
export class HeartbeatMonitorService {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly tasksService: TasksService,
    private readonly dashboardGateway: DashboardGateway,
    private readonly logger: LoggingClient,
  ) {}

  @Cron('*/30 * * * * *') // every 30 seconds
  async checkStaleAgents(): Promise<void> {
    const stale = await this.agentsService.findStaleBusy(HEARTBEAT_TIMEOUT_MS);
    if (stale.length === 0) return;

    const start = Date.now();
    const recoveredIds: string[] = [];

    for (const agent of stale) {
      // Self-heal: return worker to idle pool instead of disabling it.
      // Workers go stale when pods restart mid-task; they are not broken.
      await this.agentsService.markIdle(agent.id);
      recoveredIds.push(agent.id);

      if (agent.currentTaskId) {
        const task = await this.tasksService.resetOrFail(agent.currentTaskId);
        this.dashboardGateway.emitTaskUpdate({
          taskId: task.id,
          projectId: task.projectId,
          status: task.status,
          type: task.type,
          assigneeAgentId: null,
        });
      }

      this.dashboardGateway.emitAgentUpdate({
        agentId: agent.id,
        status: 'idle',
      });
    }

    await this.logger.log({
      level: 'warn',
      msg: 'heartbeat_monitor_stale_agents_recovered',
      durationMs: Date.now() - start,
      metadata: { stale_count: stale.length, recovered_ids: recoveredIds },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/agents/heartbeat-monitor.service.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS — 3 tests passed.

- [ ] **Step 5: Run existing worker-pool tests to confirm no regression**

```bash
npx jest src/worker/worker-pool.service.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS — all tests passed.

- [ ] **Step 6: Commit**

```bash
git add src/agents/heartbeat-monitor.service.ts src/agents/heartbeat-monitor.service.spec.ts
git commit -m "fix(heartbeat): self-heal stale-busy workers to idle instead of disabled"
```

---

## Task 3: Shrink the Disabled-Workers Banner

**Files:**
- Modify: `public/style.css:194-202`
- Modify: `public/app.js:57-59` (banner-red HTML)

The current banner fills the entire top of the page with a red background when workers are disabled. Change it to a compact fixed chip in the bottom-right corner, just like the yellow banner already is — small text, icon, "Enable" button inline.

- [ ] **Step 1: Update banner CSS in `public/style.css`**

Find and replace the banner block (lines 194-202):

```css
/* Agent health banner */
#agent-health-banner { position: fixed; bottom: 16px; right: 16px; z-index: 200; display: none; align-items: center; gap: 8px; }
#agent-health-banner.banner-red .banner-msg { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; border-radius: 20px; padding: 4px 12px; font-size: 0.78rem; }
#agent-health-banner.banner-yellow .banner-msg { background: #fef9c3; border: 1px solid #fde68a; color: #854d0e; border-radius: 20px; padding: 4px 12px; font-size: 0.78rem; }
#agent-health-banner .banner-actions { display: flex; gap: 6px; }
.banner-btn { padding: 3px 10px; border: 1px solid currentColor; border-radius: 20px; background: transparent; cursor: pointer; font-size: 0.75rem; font-weight: 500; color: inherit; }
.banner-btn:hover { opacity: 0.75; }
```

- [ ] **Step 2: Update banner-red message text to be terse in `public/app.js`**

Find lines 57-59 in `public/app.js`:

```javascript
  if (data.allWorkersDisabled) {
    banner.className = 'banner-red';
    banner.innerHTML = `<span class="banner-msg">All ${w.total || 0} worker agents are disabled — tasks cannot start. ${w.disabled || 0} disabled, ${w.busy || 0} busy.</span><span class="banner-actions">${enableBtn}</span>`;
```

Replace with:

```javascript
  if (data.allWorkersDisabled) {
    banner.className = 'banner-red';
    banner.innerHTML = `<span class="banner-msg">Workers disabled (${w.disabled || 0}/${w.total || 0})</span><span class="banner-actions">${enableBtn}</span>`;
```

- [ ] **Step 3: Verify visually**

```bash
cd /home/ssf/Documents/Github/runlayer && npm run start:dev 2>&1 &
sleep 5
```

Open http://localhost:3390 in browser. The banner should now appear as a small chip in the bottom-right, not a full red page overlay.

- [ ] **Step 4: Commit**

```bash
git add public/style.css public/app.js
git commit -m "feat(ui): shrink worker-disabled banner to compact bottom-right chip"
```

---

## Task 4: Add URL Routing with `history.pushState`

**Files:**
- Modify: `public/app.js` — add `navigate()`, `popstate` handler, update all view-switching calls

Currently all navigation uses `style.display` toggling with no URL change. Add a router so each view has a URL:
- `/#/` → portfolio
- `/#/projects/:slug/tasks` → project task list (task-graph-view)
- `/#/tasks/:taskId` → execution log view
- `/#/goals` → goals-view
- `/#/tasks` → tasks-view
- `/#/agents` → agents-view
- `/#/admin` → admin-view

- [ ] **Step 1: Add the `navigate()` function and `popstate` handler**

Find the navigation block starting at line 1090 (`// Navigation`) in `public/app.js`. Insert the following **before** the existing `const sectionMap` line:

```javascript
// === URL Router ===

function navigate(hash, { replace = false } = {}) {
  if (replace) {
    history.replaceState(null, '', hash);
  } else {
    history.pushState(null, '', hash);
  }
  handleRoute(hash);
}

function handleRoute(hash) {
  const h = hash || window.location.hash || '/#/';

  // /#/tasks/:taskId
  const taskMatch = h.match(/^\/#\/tasks\/([^/]+)$/);
  if (taskMatch) {
    const taskId = decodeURIComponent(taskMatch[1]);
    const type = portfolioState.tasksCache?.find((t) => t.id === taskId)?.type || '';
    openExecutionLog(taskId, type);
    return;
  }

  // /#/projects/:slug/tasks — handled by deep-link: show portfolio and let user click in,
  // or if already on that project re-open it
  const projectTasksMatch = h.match(/^\/#\/projects\/([^/]+)\/tasks$/);
  if (projectTasksMatch) {
    // If activeProjectId is already set (navigating back/forward), re-open goal-detail-view
    if (portfolioState.activeProjectId) {
      ALL_SECTION_IDS.forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      const goalDetailView = document.getElementById('goal-detail-view');
      if (goalDetailView) goalDetailView.style.display = 'block';
    } else {
      // Fall back to portfolio so user can navigate in
      document.getElementById('portfolio-view').style.display = 'block';
    }
    return;
  }

  // top-level sections
  ALL_SECTION_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  if (h === '/#/goals' || h === '#goals') {
    document.getElementById('goals-view').style.display = 'block';
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#goals'));
    loadGoalsSection();
  } else if (h === '/#/tasks' || h === '#tasks') {
    document.getElementById('tasks-view').style.display = 'block';
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#tasks'));
    loadTasksSection();
  } else if (h === '/#/agents' || h === '#agents') {
    document.getElementById('agents-view').style.display = 'block';
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#agents'));
    loadAgentsSection();
  } else if (h === '/#/admin' || h === '#admin') {
    document.getElementById('admin-view').style.display = 'block';
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#admin'));
  } else {
    // default: portfolio
    document.getElementById('portfolio-view').style.display = 'block';
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#portfolio'));
  }
}

window.addEventListener('popstate', () => handleRoute(window.location.hash));
```

- [ ] **Step 2: Update nav-link click handlers to use `navigate()`**

Find the `document.querySelectorAll('.nav-link').forEach` block (around line 1101). Replace it entirely:

```javascript
document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = link.getAttribute('href')?.replace('#', '');
    navigate(`/#/${target}`);
  });
});
```

- [ ] **Step 3: Update `openExecutionLog` to push URL**

Find `async function openExecutionLog(taskId, type)` (around line 1589). Add `history.pushState` at the start of the function, after the null-checks:

```javascript
async function openExecutionLog(taskId, type) {
  const goalDetailView = document.getElementById('goal-detail-view');
  const executionLogView = document.getElementById('execution-log-view');
  const executionLogContainer = document.getElementById('execution-log-container');
  if (!goalDetailView || !executionLogView || !executionLogContainer) return;

  history.pushState(null, '', `/#/tasks/${encodeURIComponent(taskId)}`);
  // ... rest of existing function unchanged
```

- [ ] **Step 4: Update `showGoalDetail` to push URL when entering project tasks**

Find the `showGoalDetail` function (the one that sets `portfolioState.activeProjectSlug = slug` around line 1427). After `portfolioState.activeProjectSlug = slug;` add:

```javascript
  history.pushState(null, '', `/#/projects/${encodeURIComponent(slug)}/tasks`);
```

- [ ] **Step 5: Update `goBackToPortfolio` to push URL**

Find `function goBackToPortfolio()`. At the top of the function, replace any existing `history.replaceState` or add:

```javascript
  history.pushState(null, '', '/#/');
```

- [ ] **Step 6: Update `initAuth` to call `handleRoute` after login**

Find `initAuth()`. After `showDashboard();` is called (line ~212), add:

```javascript
    showDashboard();
    handleRoute(window.location.hash || '/#/');
```

- [ ] **Step 7: Update task rows to be clickable with URL**

Find `loadTasksSection()` (around line 1170). In the row template, change the `<tr>` to be clickable:

```javascript
const html = Object.entries(byProject).map(([label, rows]) => `
  <div class="goals-group">
    <h3 class="goals-group-label">${escapeHtml(label)}</h3>
    <table>
      <thead><tr><th>Type</th><th>Status</th><th>Priority</th><th>Attempt</th><th>Created</th></tr></thead>
      <tbody>${rows.map((t) => `
        <tr onclick="navigate('/#/tasks/${encodeURIComponent(t.id)}')" style="cursor:pointer">
          <td>${escapeHtml(t.type || '--')}</td>
          <td><span class="badge badge-${escapeHtml(t.status)}">${escapeHtml(t.status)}</span></td>
          <td>${t.priority ?? '--'}</td>
          <td>${t.attempt != null ? t.attempt + ' / ' + t.maxAttempts : '--'}</td>
          <td>${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '--'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`).join('');
```

- [ ] **Step 8: Cache tasks when loading**

Find `loadTasksSection()`. After `const tasks = resp.ok ? await resp.json() : [];`, add:

```javascript
    portfolioState.tasksCache = tasks;
```

- [ ] **Step 9: Commit**

```bash
git add public/app.js
git commit -m "feat(ui): add pushState URL routing for tasks, projects, goals, and execution logs"
```

---

## Task 5: Show Step Logs Inline on Task Detail — Rich Log View

**Files:**
- Modify: `public/app.js` — `openExecutionLog()` — load and display logs with request/response metadata per log entry
- Modify: `public/style.css` — add `task-detail-*` styles

The step logs timeline already exists (CSS classes `step-log-item`, `step-log-level`, etc.) and the `/api/dashboard/tasks/:taskId/logs` endpoint is already in place. The issue is that the worker agent logs each step with `metadata` containing `msg`, `durationMs`, and other context — but the current view only shows them as a flat list with no grouping. This task enriches the view to group logs by `msg` type (phases like `worker_model_tier`, `worker_budget_check`, `task_completed`) and show metadata inline.

- [ ] **Step 1: Rewrite `renderStepLogs` to group by phase and show metadata expanded**

Find `function renderStepLogs(logs)` in `public/app.js` (around line 102). Replace it:

```javascript
function renderStepLogs(logs) {
  if (!logs || !logs.length) return '<p style="color:#94a3b8;font-size:0.82rem;padding:12px 0;">No step logs recorded for this task yet.</p>';
  return logs.map((log, i) => {
    const id = `log-meta-${i}`;
    const level = (log.level || 'info').toLowerCase();
    const msg = escapeHtml(log.message || log.msg || '(no message)');
    const ts = log.timestamp ? new Date(log.timestamp).toLocaleString() : '';
    const meta = log.metadata || {};
    const metaKeys = Object.keys(meta);
    const hasMeta = metaKeys.length > 0;

    // Inline key facts from metadata (duration, error, tier, etc.)
    const inlineFacts = [];
    if (meta.durationMs != null) inlineFacts.push(`${meta.durationMs}ms`);
    if (meta.capped_tier) inlineFacts.push(`tier:${meta.capped_tier}`);
    if (meta.error_code) inlineFacts.push(`err:${meta.error_code}`);
    if (meta.skip_reason) inlineFacts.push(`skip:${meta.skip_reason}`);
    if (meta.error) inlineFacts.push(`error:${escapeHtml(String(meta.error).slice(0, 80))}`);
    const factsHtml = inlineFacts.length ? `<span class="step-log-facts">${inlineFacts.join(' · ')}</span>` : '';

    const metaJson = hasMeta ? escapeHtml(JSON.stringify(meta, null, 2)) : '';
    return `
      <div class="step-log-item">
        <div class="step-log-level level-${level}">${level}</div>
        <div class="step-log-body">
          <div class="step-log-msg">${msg}${factsHtml}</div>
          <div class="step-log-ts">${ts}</div>
          ${hasMeta ? `<div class="step-log-meta-toggle" onclick="toggleLogMeta('${id}')">Show metadata</div><pre class="step-log-meta-block" id="${id}">${metaJson}</pre>` : ''}
        </div>
      </div>`;
  }).join('');
}
```

- [ ] **Step 2: Add CSS for inline facts**

Append to `public/style.css` after the `.exec-step-section h4` rule (line ~220):

```css
.step-log-facts { margin-left: 8px; font-size: 0.72rem; color: #64748b; font-weight: 400; }
.task-log-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.task-log-refresh-btn { border: 1px solid #cbd5e1; background: #fff; color: #475569; border-radius: 6px; padding: 4px 10px; font-size: 0.78rem; cursor: pointer; }
.task-log-refresh-btn:hover { background: #f1f5f9; }
```

- [ ] **Step 3: Add auto-refresh on execution log view**

Find `openExecutionLog` in `public/app.js`. After the step logs are loaded at the bottom of the function, add a "Refresh logs" button and auto-refresh every 10 seconds while the view is visible:

```javascript
  stepLogsSection.innerHTML = renderStepLogs(logs);

  // Add refresh button
  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'task-log-refresh-btn';
  refreshBtn.textContent = 'Refresh logs';
  refreshBtn.onclick = async () => {
    stepLogsSection.innerHTML = 'Loading…';
    const fresh = await loadStepLogs(taskId);
    stepLogsSection.innerHTML = renderStepLogs(fresh);
  };
  const stepSection = document.querySelector('.exec-step-section h4');
  if (stepSection) stepSection.after(refreshBtn);
```

- [ ] **Step 4: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat(ui): enrich task step-log view with inline metadata facts and refresh button"
```

---

## Task 6: Build and Deploy

- [ ] **Step 1: Run full test suite**

```bash
cd /home/ssf/Documents/Github/runlayer
npx jest --no-coverage 2>&1 | tail -20
```

Expected: all test suites pass.

- [ ] **Step 2: TypeScript build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Deploy**

```bash
./scripts/deploy.sh 2>&1 | tail -30
```

- [ ] **Step 4: Enable workers via the UI button or Admin API**

```bash
curl -s -X POST https://runlayer.alfares.cz/api/dashboard/admin/agents/enable-workers \
  -H "Authorization: Bearer $(cat ~/.orchestrator-token 2>/dev/null || echo 'YOUR_TOKEN')" \
  -H "Content-Type: application/json" | jq .
```

Expected: `{ "enabled": 5, "message": "5 worker(s) set to idle" }`

- [ ] **Step 5: Verify workers stay idle after 11 minutes**

Wait 11 minutes (the heartbeat monitor runs every 30s with a 10-minute threshold). Then check agent health:

```bash
curl -s https://runlayer.alfares.cz/api/dashboard/agent-health \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.workers'
```

Expected: `disabled: 0` — workers should remain idle since no tasks are running on them.

- [ ] **Step 6: Final commit if any last-minute fixes were needed**

```bash
git add -p
git commit -m "fix: post-deploy corrections"
```
