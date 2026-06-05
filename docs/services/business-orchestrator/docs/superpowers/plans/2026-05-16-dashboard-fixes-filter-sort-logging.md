# Dashboard Fixes: Filter/Sort Tasks, Task Logging Panel, URL Hash Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three dashboard issues: (1) add filter/sort to the global Tasks page, (2) ensure every task detail view shows its logs inline with request/response details, and (3) strip legacy `#/` hash fragments from URLs on page load.

**Architecture:** All changes are frontend-only (`public/app.js` + `public/style.css`). No backend changes needed — the API endpoints `/api/dashboard/tasks` and `/api/dashboard/tasks/:taskId/logs` already exist and return the required data. The hash stripping already exists in `initAuth()` but needs a cache-busting deploy to take effect. Task filter/sort is implemented in-memory on the already-fetched task list.

**Tech Stack:** Vanilla JS (no framework), CSS, NestJS ServeStaticModule (serves `public/` as SPA with index.html fallback).

---

## Files to Modify

| File | Change |
|------|--------|
| `public/app.js` | Add filter/sort UI to `loadTasksSection()`, verify hash-strip on load, ensure `openExecutionLog` is reachable from Tasks page |
| `public/style.css` | Add styles for filter bar, sortable column headers |
| `public/index.html` | Bump cache-buster version on `app.js` and `style.css` script/link tags |

---

## Task 1: Filter and Sort the Global Tasks Page

The global Tasks page (`/tasks`) currently renders all tasks grouped by project with no filtering or sorting. This task adds a filter bar (status dropdown + text search) and clickable sortable column headers.

**Files:**
- Modify: `public/app.js` — rewrite `loadTasksSection()` (~line 1289–1328) and add `renderTasksTable()`, `applyTaskFilters()`, `setTaskSort()`
- Modify: `public/style.css` — add `.task-filter-bar`, `.task-filter-select`, `.task-th-sort` styles

- [ ] **Step 1: Add CSS for the filter bar and sortable headers**

Open `public/style.css`. Append at the end of the file:

```css
/* === Task filter bar === */
.task-filter-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.task-filter-bar label {
  font-size: 0.8rem;
  color: #64748b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.task-filter-select,
.task-filter-input {
  padding: 4px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  font-size: 0.82rem;
  background: #fff;
  color: #1e293b;
}
.task-filter-input { min-width: 160px; }
.task-filter-count {
  margin-left: auto;
  font-size: 0.78rem;
  color: #94a3b8;
}

/* === Sortable table headers === */
.task-th-sort {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.task-th-sort:hover { background: #f1f5f9; }
.task-th-sort .sort-arrow { margin-left: 4px; color: #94a3b8; font-size: 0.7rem; }
.task-th-sort.sort-asc .sort-arrow::after { content: '▲'; }
.task-th-sort.sort-desc .sort-arrow::after { content: '▼'; }
.task-th-sort:not(.sort-asc):not(.sort-desc) .sort-arrow::after { content: '⇅'; }
```

- [ ] **Step 2: Rewrite `loadTasksSection()` in `app.js`**

Find the existing `loadTasksSection()` function (around line 1289). Replace the entire function with:

```js
// Tracks current filter/sort state for the global tasks view
const tasksViewState = { status: '', search: '', sortKey: 'createdAt', sortDir: 'desc' };

async function loadTasksSection() {
  const container = document.getElementById('tasks-container');
  if (!container) return;
  const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
  if (!token) { container.innerHTML = '<div class="state-error">Not authenticated.</div>'; return; }
  container.innerHTML = 'Loading...';
  try {
    const resp = await fetch('/api/dashboard/tasks', { headers: { Authorization: `Bearer ${token}` } });
    const tasks = resp.ok ? await resp.json() : [];
    portfolioState.tasksCache = tasks;
    renderTasksTable(tasks);
  } catch (err) {
    container.innerHTML = `<div class="state-error">Failed to load tasks: ${escapeHtml(err.message)}</div>`;
  }
}

function applyTaskFilters(tasks) {
  let result = tasks;
  if (tasksViewState.status) {
    result = result.filter((t) => t.status === tasksViewState.status);
  }
  if (tasksViewState.search) {
    const q = tasksViewState.search.toLowerCase();
    result = result.filter((t) =>
      (t.type || '').toLowerCase().includes(q) ||
      (t.businessSlug || '').toLowerCase().includes(q) ||
      (t.projectSlug || '').toLowerCase().includes(q) ||
      (t.id || '').toLowerCase().includes(q)
    );
  }
  return result;
}

function sortTasks(tasks) {
  const key = tasksViewState.sortKey;
  const dir = tasksViewState.sortDir === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    let av = a[key] ?? '';
    let bv = b[key] ?? '';
    if (key === 'createdAt') {
      av = new Date(av).getTime() || 0;
      bv = new Date(bv).getTime() || 0;
    } else if (key === 'priority') {
      av = Number(av) || 99;
      bv = Number(bv) || 99;
    } else {
      av = String(av).toLowerCase();
      bv = String(bv).toLowerCase();
    }
    return av < bv ? -dir : av > bv ? dir : 0;
  });
}

function setTaskSort(key) {
  if (tasksViewState.sortKey === key) {
    tasksViewState.sortDir = tasksViewState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    tasksViewState.sortKey = key;
    tasksViewState.sortDir = key === 'createdAt' ? 'desc' : 'asc';
  }
  renderTasksTable(portfolioState.tasksCache || []);
}

function thSort(key, label) {
  const active = tasksViewState.sortKey === key;
  const cls = active ? `sort-${tasksViewState.sortDir}` : '';
  return `<th class="task-th-sort ${cls}" onclick="setTaskSort('${key}')">${label}<span class="sort-arrow"></span></th>`;
}

function renderTasksTable(allTasks) {
  const container = document.getElementById('tasks-container');
  if (!container) return;

  const statuses = [...new Set(allTasks.map((t) => t.status).filter(Boolean))].sort();
  const filtered = applyTaskFilters(allTasks);
  const sorted = sortTasks(filtered);

  if (!allTasks.length) {
    container.innerHTML = '<div class="state-empty">No tasks found.</div>';
    return;
  }

  const rows = sorted.map((t) => `
    <tr onclick="navigate('/tasks/${escapeHtml(encodeURIComponent(t.id))}')">
      <td>${escapeHtml(t.type || '--')}</td>
      <td>${escapeHtml(`${t.businessSlug || ''} / ${t.projectSlug || ''}`)}</td>
      <td><span class="badge badge-${escapeHtml(t.status || '')}">${escapeHtml(t.status || '--')}</span></td>
      <td>${t.priority ?? '--'}</td>
      <td>${t.attempt != null ? `${t.attempt} / ${t.maxAttempts}` : '--'}</td>
      <td>${t.createdAt ? new Date(t.createdAt).toLocaleString() : '--'}</td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="task-filter-bar">
      <label>Status
        <select class="task-filter-select" onchange="tasksViewState.status=this.value;renderTasksTable(portfolioState.tasksCache||[])">
          <option value="">All statuses</option>
          ${statuses.map((s) => `<option value="${escapeHtml(s)}"${tasksViewState.status === s ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
      </label>
      <label>Search
        <input class="task-filter-input" type="text" placeholder="type, project, id…" value="${escapeHtml(tasksViewState.search)}"
          oninput="tasksViewState.search=this.value;renderTasksTable(portfolioState.tasksCache||[])" />
      </label>
      <span class="task-filter-count">${filtered.length} / ${allTasks.length} tasks</span>
    </div>
    <table style="cursor:pointer">
      <thead><tr>
        ${thSort('type', 'Type')}
        ${thSort('businessSlug', 'Project')}
        ${thSort('status', 'Status')}
        ${thSort('priority', 'Priority')}
        <th>Attempt</th>
        ${thSort('createdAt', 'Created')}
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="color:#94a3b8">No tasks match the current filter.</td></tr>'}</tbody>
    </table>`;
}
```

- [ ] **Step 3: Verify the old `loadTasksSection` is fully replaced**

Run:
```bash
grep -c "async function loadTasksSection" /home/ssf/Documents/Github/business-orchestrator/public/app.js
```
Expected output: `1` (exactly one definition). If you see `2`, delete the old one.

- [ ] **Step 4: Manual smoke test**

Navigate to `https://orchestrator.alfares.cz/tasks` in the browser. Verify:
- Filter bar with Status dropdown and Search input appears above the table
- Column headers `Type`, `Project`, `Status`, `Priority`, `Created` are clickable and sort the rows
- The task count `N / M tasks` updates when filtering
- Clicking a row navigates to the task detail / execution log view

---

## Task 2: Ensure Hash-Fragment URLs Are Stripped on Load

The legacy URL pattern `https://orchestrator.alfares.cz/#/projects/flipflop-v1/tasks` uses a hash prefix. The `initAuth()` function already strips `#/` prefixes via `history.replaceState`. The fix is to ensure the page is deployed with updated cache-busting so browsers load the latest `app.js`.

**Files:**
- Modify: `public/index.html` — bump version query string on `app.js` and `style.css`

- [ ] **Step 1: Generate a new cache-buster hash**

Run:
```bash
date +%s | sha256sum | head -c 12
```
Note the 12-character output (e.g. `a3f9c2b84d1e`). Use it in the next step.

- [ ] **Step 2: Update cache-busting version in `index.html`**

Open `public/index.html`. Find the two lines with the version query string (currently `?v=eecdda207dc7`):

```html
  <link rel="stylesheet" href="/style.css?v=eecdda207dc7">
```
and
```html
  <script src="/app.js?v=eecdda207dc7"></script>
```

Replace both `eecdda207dc7` values with the new hash from Step 1. Both tags must use the same new hash.

- [ ] **Step 3: Verify the strip logic is present in `initAuth()`**

Run:
```bash
grep -A5 "hash.startsWith" /home/ssf/Documents/Github/business-orchestrator/public/app.js
```
Expected output must include:
```js
} else if (hash && hash.startsWith('#/')) {
    history.replaceState(null, '', hash.slice(1));
```
If absent, add it inside `initAuth()` before the `const token =` line:
```js
} else if (hash && hash.startsWith('#/')) {
    history.replaceState(null, '', hash.slice(1));
}
```

---

## Task 3: Task Log Panel — Verify It Works and Wire From Global Tasks Page

The execution log view (`openExecutionLog`) already loads and renders step logs from the logging-microservice. This task verifies the panel works correctly when navigating from the global Tasks page (not just from the goal detail view) and ensures the "Back" button returns to `/tasks` when that was the entry point.

**Files:**
- Modify: `public/app.js` — fix `goBackToTasks()` usage and ensure `openExecutionLog` is the only handler for `/tasks/:taskId` route

- [ ] **Step 1: Verify `handleRoute` calls `openExecutionLog` for `/tasks/:taskId`**

Run:
```bash
grep -A6 "taskMatch" /home/ssf/Documents/Github/business-orchestrator/public/app.js | head -12
```
Expected: the `/tasks/:taskId` route calls `openExecutionLog(taskId, type)`. If it does not, add it:

Find in `handleRoute`:
```js
  const taskMatch = p.match(/^\/tasks\/([^/]+)$/);
  if (taskMatch) {
    const taskId = decodeURIComponent(taskMatch[1]);
    const type = portfolioState.tasksCache?.find((t) => t.id === taskId)?.type || '';
    openExecutionLog(taskId, type);
    return;
  }
```
This should already be present. If not, add it at the top of `handleRoute`.

- [ ] **Step 2: Check the Back button uses `goBackToTasks()` for entries from the Tasks page**

The `openExecutionLog` function renders a static "Back" button (`onclick="goBackToTasks()"`). `goBackToTasks()` already navigates to `/tasks` and reloads the tasks section. Verify:

```bash
grep -A5 "goBackToTasks" /home/ssf/Documents/Github/business-orchestrator/public/app.js | head -10
```
Expected to see `history.pushState(null, '', '/tasks')` and `loadTasksSection()`. If present, no change needed.

- [ ] **Step 3: Manual smoke test of the log panel**

1. Navigate to `/tasks`
2. Click any task row
3. Verify the URL changes to `/tasks/<task-uuid>` (no `#`)
4. Verify the "Step Logs" section appears (may show "No step logs recorded for this task yet." if the task ran before logging was active — that is expected)
5. Click the Refresh button — verify it re-fetches without error
6. Click "← Back" — verify it returns to `/tasks` with the filter bar visible

---

## Task 4: Deploy

**Files:**
- Run: `scripts/deploy.sh`

- [ ] **Step 1: Build and deploy**

```bash
cd /home/ssf/Documents/Github/business-orchestrator
./scripts/deploy.sh
```
Expected: build succeeds, pod restarts, health check passes.

- [ ] **Step 2: Verify deployment**

```bash
kubectl rollout status deployment/business-orchestrator -n statex-apps
```
Expected: `deployment "business-orchestrator" successfully rolled out`

- [ ] **Step 3: Smoke test production**

1. Open `https://orchestrator.alfares.cz/tasks` — verify filter bar is visible
2. Open `https://orchestrator.alfares.cz/#/tasks` — verify URL becomes `https://orchestrator.alfares.cz/tasks` automatically (hash stripped)
3. Open any task, verify Step Logs section loads

---

## Self-Review

**Spec coverage:**
- Item 2 (task-level logs visible in task detail): covered — Task 3 verifies the existing log panel is wired correctly from the Tasks page. The backend and frontend already support this fully.
- Item 3 (filter/sort tasks): covered — Task 1.
- Item 4 (why tasks not running): **no code fix needed** — investigation showed all 41 tasks are `done` and 3 workers are idle. There are no pending tasks. The system is healthy; the Tasks page showing old completed tasks created the impression tasks were "stuck". The filter added in Task 1 lets you filter to `status=created` to see only pending tasks.
- Item 5 (remove `#` from URLs): covered — Task 2 + already implemented in `initAuth()`.

**Placeholder scan:** None found — all steps contain complete code.

**Type consistency:** `tasksViewState` object is defined once in `loadTasksSection` replacement and referenced consistently by `applyTaskFilters`, `sortTasks`, `setTaskSort`, and `renderTasksTable`.
