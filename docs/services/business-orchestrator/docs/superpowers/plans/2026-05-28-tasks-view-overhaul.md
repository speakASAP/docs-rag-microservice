# Tasks View Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove "View tasks" and "View queue" buttons from the portfolio/dashboard homepage, and upgrade `/tasks` to be the canonical task hub: dependency graph, per-task detail page with task metadata + approve/reject actions.

**Architecture:** All changes are front-end only (public/app.js + public/index.html). The backend already exposes all required endpoints (`GET /api/dashboard/tasks/:taskId/detail`, `POST /api/dashboard/tasks/:taskId/approve`, `POST /api/dashboard/tasks/:taskId/reject`). The `/tasks/:taskId` route already renders an execution log — we replace that view with a full task detail page that also includes the approve button (shown only when `status === 'pending_approval'`). The dependency graph already exists in `renderTaskGraph()` — we embed it in the `/tasks` list view (it is already done there via `task-graph-hook`, but below the table). We move the graph to be more prominent.

**Tech Stack:** Vanilla JS (ES2020), Cytoscape.js (already loaded), no build step.

---

## File Map

| File | What changes |
|------|-------------|
| `public/index.html` | No changes needed (task-detail-drawer and execution-log-view already exist) |
| `public/app.js` | 4 targeted edits described below |

---

### Task 1: Remove "View tasks" and "View queue" from project cards

**Files:**
- Modify: `public/app.js:684-688`

The project card template at line 684–688 has two buttons to remove:
- `<button ... onclick="openGoalDetail(...)">View tasks</button>` (line 685)
- The conditional `View queue` button (line 688)

The mode badge and mode toggle button should remain.

- [ ] **Step 1: Edit app.js to remove the two buttons**

In `public/app.js`, find the `project-actions` div (around line 684):

```javascript
        <div class="project-actions">
          <button type="button" onclick="openGoalDetail('${escapeHtml(projectId)}','${escapeHtml(project.slug)}')">View tasks</button>
          <span class="mode-badge ${escapeHtml((project.executionMode || 'auto') === 'manual' ? 'mode-badge-manual' : 'mode-badge-auto')}">${escapeHtml((project.executionMode || 'auto') === 'manual' ? 'Manual mode' : 'Auto mode')}</span>
          <button type="button" class="mode-toggle-btn" onclick="toggleProjectMode('${escapeHtml(projectId)}','${escapeHtml((project.executionMode || 'auto') === 'manual' ? 'auto' : 'manual')}')">${escapeHtml((project.executionMode || 'auto') === 'manual' ? 'Switch to auto' : 'Switch to manual')}</button>
          ${(project.executionMode || 'auto') === 'manual' ? `<button type="button" class="btn-secondary" style="font-size:0.78rem;padding:3px 8px;" onclick="openPendingApprovalPanel('${escapeHtml(projectId)}')">View queue</button>` : ''}
        </div>
```

Replace with (remove the two buttons, keep only the mode badge + toggle):

```javascript
        <div class="project-actions">
          <span class="mode-badge ${escapeHtml((project.executionMode || 'auto') === 'manual' ? 'mode-badge-manual' : 'mode-badge-auto')}">${escapeHtml((project.executionMode || 'auto') === 'manual' ? 'Manual mode' : 'Auto mode')}</span>
          <button type="button" class="mode-toggle-btn" onclick="toggleProjectMode('${escapeHtml(projectId)}','${escapeHtml((project.executionMode || 'auto') === 'manual' ? 'auto' : 'manual')}')">${escapeHtml((project.executionMode || 'auto') === 'manual' ? 'Switch to auto' : 'Switch to manual')}</button>
        </div>
```

- [ ] **Step 2: Verify dashboard still renders**

Open https://orchestrator.alfares.cz/ in browser and confirm project cards no longer show "View tasks" or "View queue" buttons. The mode badge and toggle should still be there.

---

### Task 2: Make dependency graph more prominent in /tasks view

The graph already renders below the table via `renderTaskGraph(sorted)` at line 1262. The issue is it is buried after the table. Move the graph to be a dedicated tab/section above or alongside the table — or add a "Graph" toggle button so users can flip between table view and graph view without scrolling.

**Files:**
- Modify: `public/app.js` — `renderTasksTable` function (lines 1204–1263)

- [ ] **Step 1: Add a view-toggle state and render graph by default when switching**

After the `tasksViewState` object (line 1130), add a view mode toggle. The existing `tasksViewState` is:
```javascript
const tasksViewState = { status: '', search: '', project: '', sortKey: 'createdAt', sortDir: 'desc' };
```

Replace with:
```javascript
const tasksViewState = { status: '', search: '', project: '', sortKey: 'createdAt', sortDir: 'desc', view: 'table' };
```

- [ ] **Step 2: Modify renderTasksTable to include table/graph toggle buttons and split layout**

Find the `container.innerHTML = \`` template inside `renderTasksTable` (starts at line 1228). Replace the entire `container.innerHTML = \`` block (lines 1228–1260) with:

```javascript
  const viewToggle = `
    <div class="task-view-toggle">
      <button type="button" class="${tasksViewState.view === 'table' ? 'task-view-btn active' : 'task-view-btn'}" onclick="tasksViewState.view='table';renderTasksTable(portfolioState.tasksCache||[])">Table</button>
      <button type="button" class="${tasksViewState.view === 'graph' ? 'task-view-btn active' : 'task-view-btn'}" onclick="tasksViewState.view='graph';renderTasksTable(portfolioState.tasksCache||[])">Dependency Graph</button>
    </div>`;

  const tableHtml = `
    <table style="cursor:pointer">
      <thead><tr>
        ${thSort('type', 'Type')}
        ${thSort('projectSlug', 'Project')}
        ${thSort('status', 'Status')}
        ${thSort('priority', 'Priority')}
        <th>Attempt</th>
        ${thSort('createdAt', 'Created')}
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="color:#94a3b8">No tasks match the current filter.</td></tr>'}</tbody>
    </table>`;

  container.innerHTML = `
    <div class="task-filter-bar">
      <label>Project
        <select class="task-filter-select" onchange="tasksViewState.project=this.value;renderTasksTable(portfolioState.tasksCache||[])">
          <option value="">All projects</option>
          ${projects.map((p) => `<option value="${escapeHtml(p)}"${tasksViewState.project === p ? ' selected' : ''}>${escapeHtml(p)}</option>`).join('')}
        </select>
      </label>
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
      ${filtered.length > 0 ? `<button type="button" class="btn-danger task-bulk-delete-btn" onclick="bulkDeleteVisibleTasks()">Delete visible (${filtered.length})</button>` : ''}
    </div>
    ${viewToggle}
    ${tasksViewState.view === 'table' ? tableHtml : ''}
    <div id="task-graph-hook" style="${tasksViewState.view === 'graph' ? '' : 'display:none'}"></div>`;
```

- [ ] **Step 3: Always render the graph (regardless of view mode) so Cytoscape initializes**

The line after `container.innerHTML` (line 1262) currently reads:
```javascript
  renderTaskGraph(sorted);
```

Keep it as-is — it targets `#task-graph-hook` which we still include in the DOM (just hidden when in table mode). This means the graph is always initialized, and toggling just shows/hides via the view toggle. No change needed here.

- [ ] **Step 4: Add CSS for the toggle buttons**

In `public/style.css`, add at the end:

```css
.task-view-toggle {
  display: flex;
  gap: 4px;
  margin: 8px 0 12px;
}
.task-view-btn {
  padding: 5px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.82rem;
  color: #475569;
}
.task-view-btn.active {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}
```

- [ ] **Step 5: Verify in browser**

Navigate to https://orchestrator.alfares.cz/tasks. Confirm Table/Dependency Graph toggle buttons appear. Click "Dependency Graph" — confirm the Cytoscape graph renders with task nodes and dependency edges.

---

### Task 3: Upgrade /tasks/:taskId to show full task detail + Approve button

Currently `handleRoute` at line 960–967 calls `openExecutionLog(taskId, type)` for `/tasks/:taskId`. This renders the execution log view. We need to change it so it renders the task detail page (full detail + approve button if `pending_approval`) AND keeps the execution log section below.

**Files:**
- Modify: `public/app.js` — `openExecutionLog` function (lines 1975–2075)

The plan: extend `openExecutionLog` to always fetch the full task detail (via `/api/dashboard/tasks/:taskId/detail`) and render it at the top of the execution log view. When `status === 'pending_approval'`, show an Approve button (and Reject button).

- [ ] **Step 1: Replace the task meta rendering block inside openExecutionLog**

The current meta block (lines 2014–2035) shows basic inline HTML from the tasks cache. Replace it with a call to the detail endpoint so we always get full data including `acceptanceCriteria` and `payloadRef`:

Find this block (lines 2014–2035):
```javascript
  const metaEl = document.getElementById('exec-task-meta');
  if (metaEl) {
    if (task) {
      const criteria = Array.isArray(task.acceptanceCriteria) && task.acceptanceCriteria.length
        ? `<div style="margin-top:8px;"><span style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;">Acceptance Criteria</span><ul style="margin:4px 0 0;padding-left:18px;">${task.acceptanceCriteria.map((c) => `<li style="font-size:0.82rem;color:#374151;">${escapeHtml(String(c))}</li>`).join('')}</ul></div>`
        : '';
      metaEl.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
          <span style="font-weight:600;font-size:0.92rem;color:#1e293b;">${escapeHtml(task.type || '--')}</span>
          <span class="badge badge-${escapeHtml(task.status)}">${escapeHtml(task.status)}</span>
          ${task.priority != null ? `<span class="step-log-fact">priority:${task.priority}</span>` : ''}
          ${task.attempt != null ? `<span class="step-log-fact">attempt:${task.attempt}/${task.maxAttempts}</span>` : ''}
          ${task.goalId ? `<span class="step-log-fact">goal:${escapeHtml(String(task.goalId).slice(0, 8))}</span>` : ''}
          ${task.projectSlug ? `<span class="step-log-fact">project:${escapeHtml(task.projectSlug)}</span>` : ''}
          ${task.createdAt ? `<span style="font-size:0.75rem;color:#94a3b8;margin-left:auto;">${new Date(task.createdAt).toLocaleString()}</span>` : ''}
        </div>
        <div style="margin-top:4px;font-size:0.75rem;color:#94a3b8;font-family:monospace;">${escapeHtml(taskId)}</div>
        ${criteria}`;
    } else {
      metaEl.innerHTML = `<span style="font-size:0.82rem;color:#94a3b8;font-family:monospace;">${escapeHtml(taskId)}</span>`;
    }
  }
```

Replace with:
```javascript
  const metaEl = document.getElementById('exec-task-meta');
  if (metaEl) {
    metaEl.innerHTML = 'Loading task detail…';
    const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
    let detail = null;
    if (token) {
      try {
        detail = await apiRequest(`/api/dashboard/tasks/${taskId}/detail`, 'GET', undefined, true);
      } catch (_) {}
    }
    if (!detail) {
      detail = task || null;
    }
    if (detail) {
      const criteria = Array.isArray(detail.acceptanceCriteria) && detail.acceptanceCriteria.length
        ? `<div class="task-detail-section"><strong>Acceptance criteria:</strong>${detail.acceptanceCriteria.map((c) => `<div class="criteria-item">• ${escapeHtml(String(c))}</div>`).join('')}</div>`
        : '';
      const isPendingApproval = detail.status === 'pending_approval';
      const approvalBtns = isPendingApproval
        ? `<div class="task-approval-actions" id="task-approval-actions-${escapeHtml(taskId)}">
            <button type="button" class="btn-primary" onclick="approveTaskInline('${escapeHtml(taskId)}')">Approve</button>
            <button type="button" class="btn-danger" onclick="promptRejectTaskInline('${escapeHtml(taskId)}')">Reject</button>
          </div>`
        : '';
      const depChain = [...(detail.blockedBy || []), ...(detail.predecessor || [])];
      metaEl.innerHTML = `
        <div class="task-detail-section">
          <div class="task-detail-row"><strong>Type:</strong> ${escapeHtml(detail.type || '--')}</div>
          <div class="task-detail-row"><strong>Status:</strong> <span class="badge badge-${escapeHtml(detail.status)}">${escapeHtml(detail.status)}</span></div>
          <div class="task-detail-row"><strong>Priority:</strong> ${detail.priority ?? '--'}</div>
          <div class="task-detail-row"><strong>Attempt:</strong> ${detail.attempt ?? 0} / ${detail.maxAttempts ?? 3}</div>
          ${detail.goalId ? `<div class="task-detail-row"><strong>Goal ID:</strong> <code style="font-size:0.78rem">${escapeHtml(String(detail.goalId))}</code></div>` : ''}
          ${detail.projectId ? `<div class="task-detail-row"><strong>Project ID:</strong> <code style="font-size:0.78rem">${escapeHtml(String(detail.projectId))}</code></div>` : ''}
          <div class="task-detail-row"><strong>Task ID:</strong> <code style="font-size:0.78rem">${escapeHtml(taskId)}</code></div>
          ${detail.createdAt ? `<div class="task-detail-row"><strong>Created:</strong> ${new Date(detail.createdAt).toLocaleString()}</div>` : ''}
        </div>
        ${criteria}
        ${depChain.length ? `<div class="task-detail-section"><strong>Dependency chain:</strong>${depChain.map((id) => `<div class="dep-id"><code>${escapeHtml(id)}</code></div>`).join('')}</div>` : ''}
        ${detail.payloadRef ? `<div class="task-detail-section task-detail-json">
          <div class="step-log-rich-label" onclick="toggleLogMeta('exec-td-payload')">► Payload (payloadRef)</div>
          <pre class="step-log-meta-block" id="exec-td-payload" style="display:none">${escapeHtml(JSON.stringify(detail.payloadRef, null, 2))}</pre>
        </div>` : ''}
        ${approvalBtns}`;
    } else {
      metaEl.innerHTML = `<span style="font-size:0.82rem;color:#94a3b8;font-family:monospace;">${escapeHtml(taskId)}</span>`;
    }
  }
```

- [ ] **Step 2: Add approveTaskInline and promptRejectTaskInline functions**

After the `closeTaskDetailDrawer` function (after line 3002), add:

```javascript
async function approveTaskInline(taskId) {
  const actionsEl = document.getElementById(`task-approval-actions-${taskId}`);
  if (actionsEl) actionsEl.innerHTML = 'Approving…';
  try {
    await apiRequest(`/api/dashboard/tasks/${taskId}/approve`, 'POST', {}, true);
    showNotification('Task approved — queued for execution');
    // Re-open to refresh status
    openExecutionLog(taskId, '');
  } catch (err) {
    showNotification(`Approve failed: ${err.message}`);
    if (actionsEl) actionsEl.innerHTML = `
      <button type="button" class="btn-primary" onclick="approveTaskInline('${escapeHtml(taskId)}')">Approve</button>
      <button type="button" class="btn-danger" onclick="promptRejectTaskInline('${escapeHtml(taskId)}')">Reject</button>`;
  }
}

function promptRejectTaskInline(taskId) {
  const reason = window.prompt('Reason for rejection (required):');
  if (!reason || !reason.trim()) return;
  rejectTaskInline(taskId, reason.trim());
}

async function rejectTaskInline(taskId, reason) {
  const actionsEl = document.getElementById(`task-approval-actions-${taskId}`);
  if (actionsEl) actionsEl.innerHTML = 'Rejecting…';
  try {
    await apiRequest(`/api/dashboard/tasks/${taskId}/reject`, 'POST', { reason }, true);
    showNotification('Task rejected');
    openExecutionLog(taskId, '');
  } catch (err) {
    showNotification(`Reject failed: ${err.message}`);
    if (actionsEl) actionsEl.innerHTML = `
      <button type="button" class="btn-primary" onclick="approveTaskInline('${escapeHtml(taskId)}')">Approve</button>
      <button type="button" class="btn-danger" onclick="promptRejectTaskInline('${escapeHtml(taskId)}')">Reject</button>`;
  }
}
```

- [ ] **Step 3: Add CSS for approval action buttons section**

In `public/style.css`, add:

```css
.task-approval-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  padding: 12px 0 4px;
  border-top: 1px solid #e2e8f0;
}
```

- [ ] **Step 4: Verify in browser**

1. Navigate to https://orchestrator.alfares.cz/tasks
2. Click any task row — URL should become `/tasks/<uuid>`
3. Verify the task detail panel shows: Type, Status, Priority, Attempt, Goal ID, Project ID, Task ID, Created, Acceptance Criteria (if any), Payload collapsible
4. Find a task with `status: pending_approval` — navigate to it directly and verify Approve + Reject buttons appear
5. Click Approve — verify notification fires, status updates, buttons disappear

---

### Task 4: Add dependency graph node click → navigate to task detail

Currently in `renderTaskGraph`, clicking a node shows a side panel (`task-graph-info`). At line 1941, there is already a link: `Open detail →`. We need to make the node click in the tasks view graph also navigate to `/tasks/:id` directly on double-click (single click still shows info panel).

**Files:**
- Modify: `public/app.js` — Cytoscape tap handler inside `renderTaskGraph` (around line 1919–1941)

- [ ] **Step 1: Locate the node click handler in renderTaskGraph**

Find the Cytoscape `.on('tap', 'node', ...)` handler inside `renderTaskGraph` (around line 1910–1945). It currently populates `task-graph-info`. We just need to ensure the "Open detail" link it already renders is functional.

The existing code at line 1941 already generates:
```javascript
        <a href="#" onclick="event.preventDefault();navigate('/tasks/${encodeURIComponent(task.id)}')" style="font-size:0.78rem;color:#3b82f6;margin-top:4px;">Open detail →</a>
```

This already works — no code change needed here. The link navigates to `/tasks/:id` which routes to `openExecutionLog` which now shows our improved task detail.

- [ ] **Step 2: Verify**

Navigate to https://orchestrator.alfares.cz/tasks, switch to "Dependency Graph" view, click a node. Confirm the side info panel appears with the "Open detail →" link. Click it — confirm it navigates to the task detail page with full metadata.

---

## Self-Review

**Spec coverage:**
1. ✅ Remove "View tasks" from dashboard → Task 1
2. ✅ Remove "View queue" from dashboard → Task 1
3. ✅ Dependency graph visualization in /tasks → Task 2 (already exists, made prominent with toggle)
4. ✅ Task detail on /tasks/:uuid → Task 3 (full detail replaces sparse meta)
5. ✅ Approve button inside task detail page → Task 3 (shown when status=pending_approval)
6. ✅ Graph node → navigate to task detail → Task 4 (already wired, verified)

**Placeholder scan:** All steps have concrete code. No TBD/TODO.

**Type consistency:** All functions reference `taskId` (string UUID), `detail` (task detail object), consistent with existing codebase patterns.
