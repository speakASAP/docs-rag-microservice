# Tasks Graph Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the `/tasks` Dependency Graph so it shows the full Goal → Batch → Task → SubTask → Retry hierarchy with arrows, highlights tasks needing approval first, and fixes missing status colors.

**Architecture:** Pure frontend changes to `public/app.js`. Add Goal diamond nodes from `portfolioState.goalsAllCache`, draw `spawned` edges from `parentTaskId`, add missing status colors for `pending_approval`/`awaiting_user`, switch dagre layout to top-to-bottom, and inject an "Approve First" sticky banner above the graph listing any tasks with those statuses.

**Tech Stack:** Vanilla JS · Cytoscape.js · cytoscape-dagre · NestJS (no backend changes needed)

**Context (read first):**
- All changes are in: `public/app.js`
- Graph entry point: `renderTaskGraph(tasks)` at line 1813 — called from `renderTasksTable()` at line 1292
- Graph elements builder: `buildTaskGraphElements(tasks)` at line 1727
- Status color map: `TASK_GRAPH_STATUS_COLORS` at line 1719
- Goals cache: `portfolioState.goalsAllCache` — populated by `loadGoalsSection()` at line 1070
- Tasks are loaded by `loadTasksSection()` at line 1152 — goals may not be loaded yet when tasks page opens
- Approval functions: `approveTaskInline(taskId)` at line 3091, `rejectTaskInline(taskId, reason)` at line 3112 — both exist and work
- The API returns `parent_task_id` (snake_case) and `goal_id` and `batch_id` on each task object
- `portfolioState.goalsAllCache` entries have shape: `{ id, title, status, projectId, completionPct }`

---

### Task 1: Fix missing status colors

**Files:**
- Modify: `public/app.js:1719-1723`

The `TASK_GRAPH_STATUS_COLORS` map is missing `pending_approval` and `awaiting_user`. These render as grey, indistinguishable from `created`. Fix is 2 lines.

- [ ] **Step 1: Open the file and find the color map**

```
public/app.js line 1719:
const TASK_GRAPH_STATUS_COLORS = {
  created: '#818cf8', in_progress: '#60a5fa', done: '#22c55e',
  failed: '#ef4444', validation: '#a855f7', assigned: '#f59e0b',
  cancelled: '#64748b',
};
```

- [ ] **Step 2: Replace the color map with the extended version**

Replace lines 1719–1723 with:

```javascript
const TASK_GRAPH_STATUS_COLORS = {
  created: '#818cf8', in_progress: '#60a5fa', done: '#22c55e',
  failed: '#ef4444', validation: '#a855f7', assigned: '#f59e0b',
  cancelled: '#64748b',
  pending_approval: '#f97316',
  awaiting_user: '#0ea5e9',
};
```

- [ ] **Step 3: Verify visually**

Open `/tasks`, switch to Dependency Graph view. If any tasks have status `pending_approval`, they should now appear orange. `awaiting_user` tasks appear sky blue.

If no tasks have those statuses currently, check the legend — it now shows the new colors in the legend strip below the graph (the legend is auto-generated from `Object.entries(TASK_GRAPH_STATUS_COLORS)` at line 1831).

---

### Task 2: Add `parentTaskId` spawned edges

**Files:**
- Modify: `public/app.js:1757-1762` (inside `buildTaskGraphElements`)

The `blockedBy` / `predecessor` / `successor` edges are already drawn. `parentTaskId` is returned from the API as `parent_task_id` but is never used in the graph. We need to add a `spawned` edge type (solid dark-grey arrow) from parent → child.

- [ ] **Step 1: Locate the explicit DB edges block inside `buildTaskGraphElements`**

```javascript
// 1. Explicit DB edges: blockedBy, predecessor, successor
tasks.forEach((t) => {
  (t.blockedBy || []).forEach((srcId) => { if (taskIds.has(srcId)) addEdge(srcId, t.id, 'blocked'); });
  (t.predecessor || []).forEach((srcId) => { if (taskIds.has(srcId)) addEdge(srcId, t.id, 'seq'); });
  (t.successor || []).forEach((tgtId) => { if (taskIds.has(tgtId)) addEdge(t.id, tgtId, 'seq'); });
});
```

This block starts at approximately line 1757.

- [ ] **Step 2: Add the `parentTaskId` edge inside that same block**

Replace the block above with:

```javascript
// 1. Explicit DB edges: blockedBy, predecessor, successor, parentTaskId
tasks.forEach((t) => {
  (t.blockedBy || []).forEach((srcId) => { if (taskIds.has(srcId)) addEdge(srcId, t.id, 'blocked'); });
  (t.predecessor || []).forEach((srcId) => { if (taskIds.has(srcId)) addEdge(srcId, t.id, 'seq'); });
  (t.successor || []).forEach((tgtId) => { if (taskIds.has(tgtId)) addEdge(t.id, tgtId, 'seq'); });
  const parentId = t.parent_task_id || t.parentTaskId;
  if (parentId && taskIds.has(parentId)) addEdge(parentId, t.id, 'spawned');
});
```

- [ ] **Step 3: Add the `spawned` edge style to `renderTaskGraph`**

In `renderTaskGraph`, find the style array (starting around line 1844). After the `edge[edgeType="flow"]` style block, add:

```javascript
{
  selector: 'edge[edgeType="spawned"]',
  style: {
    'width': 2,
    'line-color': '#7c3aed',
    'target-arrow-color': '#7c3aed',
    'target-arrow-shape': 'triangle',
    'curve-style': 'bezier',
    'label': 'spawned',
    'font-size': 8,
    'color': '#7c3aed',
    'text-rotation': 'autorotate',
    'line-style': 'solid',
  },
},
```

- [ ] **Step 4: Add `spawned` to the legend**

Find the legend strip line inside `renderTaskGraph` (around line 1834):

```javascript
<span style="margin-left:8px;">— retry chain &nbsp; ··· flow order</span>
```

Replace it with:

```javascript
<span style="margin-left:8px;">— retry chain &nbsp; ··· flow order &nbsp; <span style="color:#7c3aed;">— spawned subtask</span></span>
```

- [ ] **Step 5: Verify visually**

Load `/tasks` → Dependency Graph. Tasks that were spawned by another task (e.g., an `investigate` task spawned when a `coding` task failed) should now show a purple arrow from parent to child labeled "spawned".

---

### Task 3: Add Goal nodes to the graph

**Files:**
- Modify: `public/app.js` — `buildTaskGraphElements` function (line 1727) and `loadTasksSection` (line 1152)

Goal nodes are missing entirely. Without them, tasks that belong to different batches of the same goal appear as disconnected islands. We add one Goal diamond per unique `goalId` in the task list, and draw edges: Goal → Task (for unbatched tasks) and Goal → BatchGroup → Task (for tasks sharing a `batch_id`).

**Important:** `portfolioState.goalsAllCache` may be empty when the user navigates directly to `/tasks` without visiting `/goals` first. The fix: in `loadTasksSection`, also ensure goals are loaded.

- [ ] **Step 1: Ensure goals are loaded when tasks section loads**

Find `loadTasksSection` at line 1152:

```javascript
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
```

Replace with:

```javascript
async function loadTasksSection() {
  const container = document.getElementById('tasks-container');
  if (!container) return;
  const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
  if (!token) { container.innerHTML = '<div class="state-error">Not authenticated.</div>'; return; }
  container.innerHTML = 'Loading...';
  try {
    const [tasksResp, goalsResp] = await Promise.all([
      fetch('/api/dashboard/tasks', { headers: { Authorization: `Bearer ${token}` } }),
      portfolioState.goalsAllCache?.length
        ? Promise.resolve(null)
        : fetch('/api/dashboard/goals', { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const tasks = tasksResp.ok ? await tasksResp.json() : [];
    portfolioState.tasksCache = tasks;
    if (goalsResp && goalsResp.ok) {
      portfolioState.goalsAllCache = await goalsResp.json();
    }
    renderTasksTable(tasks);
  } catch (err) {
    container.innerHTML = `<div class="state-error">Failed to load tasks: ${escapeHtml(err.message)}</div>`;
  }
}
```

- [ ] **Step 2: Add Goal nodes and edges in `buildTaskGraphElements`**

`buildTaskGraphElements(tasks)` currently starts with:

```javascript
function buildTaskGraphElements(tasks) {
  const taskIds = new Set(tasks.map((t) => t.id));
  const edgeSet = new Set();
  const elements = [];

  // Node for every task
  tasks.forEach((t) => {
```

Replace the entire function with:

```javascript
function buildTaskGraphElements(tasks) {
  const taskIds = new Set(tasks.map((t) => t.id));
  const edgeSet = new Set();
  const elements = [];

  function addEdge(src, tgt, edgeType) {
    const key = `${src}→${tgt}`;
    if (edgeSet.has(key) || src === tgt) return;
    edgeSet.add(key);
    elements.push({ data: { id: key, source: src, target: tgt, edgeType } });
  }

  // Goal nodes — one diamond per unique goalId found in the task list
  const goalsMap = {};
  (portfolioState.goalsAllCache || []).forEach((g) => { goalsMap[g.id] = g; });
  const goalIds = [...new Set(tasks.map((t) => t.goal_id || t.goalId).filter(Boolean))];
  goalIds.forEach((gid) => {
    const goal = goalsMap[gid];
    const label = goal ? `GOAL\n${(goal.title || '').slice(0, 18)}` : `GOAL\n${gid.slice(0, 8)}`;
    const status = goal ? (goal.status || 'active') : 'active';
    elements.push({
      data: {
        id: `goal-${gid}`,
        label,
        type: 'goal',
        status,
        color: status === 'completed' ? '#22c55e' : status === 'failed' ? '#ef4444' : '#3b82f6',
        goalId: gid,
        priority: 0,
        createdAt: '',
      },
    });
  });

  // Batch group nodes — one per unique batchId within a goal
  const batchIds = [...new Set(tasks.map((t) => t.batch_id || t.batchId).filter(Boolean))];
  const batchGoalMap = {};
  tasks.forEach((t) => {
    const bid = t.batch_id || t.batchId;
    if (bid) batchGoalMap[bid] = t.goal_id || t.goalId;
  });
  batchIds.forEach((bid) => {
    const gid = batchGoalMap[bid];
    elements.push({
      data: {
        id: `batch-${bid}`,
        label: `BATCH\n${bid.slice(0, 10)}`,
        type: 'batch',
        status: 'active',
        color: '#64748b',
        goalId: gid || '',
        priority: 0,
        createdAt: '',
      },
    });
    if (gid) addEdge(`goal-${gid}`, `batch-${bid}`, 'tree');
  });

  // Node for every task
  tasks.forEach((t) => {
    const shortType = (t.type || t.id.slice(0, 8));
    elements.push({
      data: {
        id: t.id,
        label: shortType + '\n' + (t.status || ''),
        fullType: shortType,
        status: t.status || 'created',
        color: TASK_GRAPH_STATUS_COLORS[t.status] || '#94a3b8',
        goalId: t.goal_id || t.goalId || '',
        projectSlug: t.projectSlug || '',
        priority: t.priority ?? 3,
        createdAt: t.createdAt || '',
      },
    });

    // Connect task to its batch or directly to its goal
    const bid = t.batch_id || t.batchId;
    const gid = t.goal_id || t.goalId;
    if (bid) {
      addEdge(`batch-${bid}`, t.id, 'tree');
    } else if (gid) {
      addEdge(`goal-${gid}`, t.id, 'tree');
    }
  });

  // 1. Explicit DB edges: blockedBy, predecessor, successor, parentTaskId
  tasks.forEach((t) => {
    (t.blockedBy || []).forEach((srcId) => { if (taskIds.has(srcId)) addEdge(srcId, t.id, 'blocked'); });
    (t.predecessor || []).forEach((srcId) => { if (taskIds.has(srcId)) addEdge(srcId, t.id, 'seq'); });
    (t.successor || []).forEach((tgtId) => { if (taskIds.has(tgtId)) addEdge(t.id, tgtId, 'seq'); });
    const parentId = t.parent_task_id || t.parentTaskId;
    if (parentId && taskIds.has(parentId)) addEdge(parentId, t.id, 'spawned');
  });

  // 2. Retry chains: same (goalId, type) ordered by createdAt → each failed links to next
  const byGoalType = {};
  tasks.forEach((t) => {
    const key = `${t.goal_id || t.goalId}||${t.type}`;
    (byGoalType[key] = byGoalType[key] || []).push(t);
  });
  Object.values(byGoalType).forEach((group) => {
    if (group.length < 2) return;
    group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    for (let i = 0; i < group.length - 1; i++) {
      addEdge(group[i].id, group[i + 1].id, 'retry');
    }
  });

  // 3. Cross-type ordering within same goal — only when no explicit edges exist for that goal
  const byGoal = {};
  tasks.forEach((t) => {
    const gid = t.goal_id || t.goalId;
    (byGoal[gid] = byGoal[gid] || []).push(t);
  });
  Object.values(byGoal).forEach((goalTasks) => {
    const goalTaskIds = new Set(goalTasks.map((t) => t.id));
    const hasExplicit = elements.some(
      (el) => el.data.source && goalTaskIds.has(el.data.source) && goalTaskIds.has(el.data.target) && el.data.edgeType !== 'retry' && el.data.edgeType !== 'tree'
    );
    if (hasExplicit) return;
    const typeGroups = {};
    goalTasks.forEach((t) => {
      (typeGroups[t.type] = typeGroups[t.type] || []).push(t);
    });
    const typesSorted = Object.entries(typeGroups)
      .map(([type, group]) => {
        group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return { type, group, priority: group[0].priority, firstAt: group[0].createdAt };
      })
      .sort((a, b) => a.priority - b.priority || new Date(a.firstAt) - new Date(b.firstAt));
    for (let i = 0; i < typesSorted.length - 1; i++) {
      const srcGroup = typesSorted[i].group;
      const tgtGroup = typesSorted[i + 1].group;
      addEdge(srcGroup[srcGroup.length - 1].id, tgtGroup[0].id, 'flow');
    }
  });

  return elements;
}
```

Note: the inner `addEdge` helper that was at line 1750 is now at the top of the function — remove the old one if it still exists after the edit.

- [ ] **Step 3: Add styles for goal and batch nodes in `renderTaskGraph`**

In the Cytoscape style array inside `renderTaskGraph` (starting ~line 1844), after the existing `node` base style, add:

```javascript
{
  selector: 'node[type="goal"]',
  style: {
    'background-color': 'data(color)',
    'shape': 'diamond',
    'width': 90,
    'height': 90,
    'font-size': 10,
    'border-color': '#1e3a5f',
    'border-width': 3,
  },
},
{
  selector: 'node[type="batch"]',
  style: {
    'background-color': '#64748b',
    'shape': 'roundrectangle',
    'width': 80,
    'height': 30,
    'font-size': 9,
  },
},
```

- [ ] **Step 4: Add style for `tree` edges**

In the same style array, after the `edge[edgeType="spawned"]` block added in Task 2, add:

```javascript
{
  selector: 'edge[edgeType="tree"]',
  style: {
    'width': 1.5,
    'line-color': '#cbd5e1',
    'target-arrow-color': '#cbd5e1',
    'target-arrow-shape': 'triangle',
    'curve-style': 'bezier',
  },
},
```

- [ ] **Step 5: Update legend to include Goal and Batch**

Find the legend strip line in `renderTaskGraph` (after Task 2, it now reads):

```javascript
<span style="margin-left:8px;">— retry chain &nbsp; ··· flow order &nbsp; <span style="color:#7c3aed;">— spawned subtask</span></span>
```

Replace with:

```javascript
<span style="margin-left:8px;">
  <span style="display:inline-block;width:10px;height:10px;background:#3b82f6;transform:rotate(45deg);vertical-align:middle;margin-right:3px;"></span>goal &nbsp;
  <span style="display:inline-block;width:10px;height:10px;background:#64748b;border-radius:2px;vertical-align:middle;margin-right:3px;"></span>batch &nbsp;
  — retry &nbsp; ··· flow &nbsp; <span style="color:#7c3aed;">— spawned</span>
</span>
```

- [ ] **Step 6: Switch dagre layout direction to TB**

Find the layout config inside `renderTaskGraph` (around line 1920):

```javascript
layout: hasEdges && window.dagre ? {
  name: 'dagre',
  rankDir: 'LR',
  nodeSep: 40,
  rankSep: 120,
  padding: 40,
  animate: false,
  ranker: 'tight-tree',
} :
```

Change `rankDir: 'LR'` to `rankDir: 'TB'` and increase `rankSep` to `80` to give goals and batches room:

```javascript
layout: hasEdges && window.dagre ? {
  name: 'dagre',
  rankDir: 'TB',
  nodeSep: 40,
  rankSep: 80,
  padding: 40,
  animate: false,
  ranker: 'tight-tree',
} :
```

- [ ] **Step 7: Verify visually**

Open `/tasks` → Dependency Graph. You should see:
- Blue diamond nodes at the top for each Goal
- Grey batch rectangles below each goal (if tasks have `batch_id`)
- Tasks below batches/goals connected with light grey arrows
- Subtasks connected to parents with purple "spawned" arrows
- Hierarchy flows top-to-bottom

---

### Task 4: Approval-first sticky banner

**Files:**
- Modify: `public/app.js` — `renderTasksTable` function (line 1224) and `renderTaskGraph` (line 1813)

When the graph view is active and there are tasks with status `pending_approval` or `awaiting_user`, show an orange sticky banner above the graph listing them. Each row has type, project, and Approve / Reject buttons. This answers "what to approve first" without hunting the graph.

- [ ] **Step 1: Add `buildApprovalBanner` helper function**

Add this new function just before `renderTaskGraph` (at approximately line 1813, before `function renderTaskGraph`):

```javascript
function buildApprovalBanner(tasks) {
  const needsAction = tasks.filter((t) => t.status === 'pending_approval' || t.status === 'awaiting_user');
  if (!needsAction.length) return '';
  const rows = needsAction.map((t) => `
    <div class="approval-banner-row" id="approval-banner-row-${escapeHtml(t.id)}">
      <span class="badge badge-${escapeHtml(t.status)}">${escapeHtml(t.status)}</span>
      <span style="font-weight:600;">${escapeHtml(t.type || '--')}</span>
      <span style="color:#94a3b8;font-size:0.82rem;">${escapeHtml(t.projectSlug || '')}</span>
      <div style="display:flex;gap:6px;margin-left:auto;">
        <button type="button" class="btn-primary btn-sm" onclick="approveBannerTask('${escapeHtml(t.id)}')">Approve</button>
        <button type="button" class="btn-danger btn-sm" onclick="rejectBannerTask('${escapeHtml(t.id)}')">Reject</button>
      </div>
    </div>`).join('');
  return `
    <div id="approval-first-banner" style="background:#fff7ed;border:1.5px solid #f97316;border-radius:8px;padding:10px 14px;margin-bottom:12px;">
      <div style="font-weight:700;color:#c2410c;margin-bottom:8px;">⚠ Approve these tasks first (${needsAction.length})</div>
      <div style="display:flex;flex-direction:column;gap:6px;">${rows}</div>
    </div>`;
}

async function approveBannerTask(taskId) {
  const row = document.getElementById(`approval-banner-row-${taskId}`);
  if (row) row.style.opacity = '0.5';
  try {
    await apiRequest(`/api/dashboard/tasks/${taskId}/approve`, 'POST', {}, true);
    showNotification('Task approved — queued for execution');
    if (row) row.remove();
    const banner = document.getElementById('approval-first-banner');
    const remaining = banner ? banner.querySelectorAll('.approval-banner-row').length : 0;
    if (banner && remaining === 0) banner.remove();
  } catch (err) {
    showNotification(`Approve failed: ${err.message}`);
    if (row) row.style.opacity = '1';
  }
}

async function rejectBannerTask(taskId) {
  const reason = window.prompt('Reason for rejection (required):');
  if (!reason || !reason.trim()) return;
  const row = document.getElementById(`approval-banner-row-${taskId}`);
  if (row) row.style.opacity = '0.5';
  try {
    await apiRequest(`/api/dashboard/tasks/${taskId}/reject`, 'POST', { reason: reason.trim() }, true);
    showNotification('Task rejected');
    if (row) row.remove();
    const banner = document.getElementById('approval-first-banner');
    const remaining = banner ? banner.querySelectorAll('.approval-banner-row').length : 0;
    if (banner && remaining === 0) banner.remove();
  } catch (err) {
    showNotification(`Reject failed: ${err.message}`);
    if (row) row.style.opacity = '1';
  }
}
```

- [ ] **Step 2: Inject the banner in `renderTaskGraph`**

In `renderTaskGraph`, the function currently starts with:

```javascript
function renderTaskGraph(tasks) {
  const container = document.getElementById('task-graph-hook');
  if (!container || !Array.isArray(tasks) || tasks.length === 0) return;
  if (!window.cytoscape) return;

  const canvasHeight = Math.max(500, Math.min(800, tasks.length * 50));

  container.innerHTML = `
    <div style="display:flex;...
```

Replace `container.innerHTML = \`` with:

```javascript
function renderTaskGraph(tasks) {
  const container = document.getElementById('task-graph-hook');
  if (!container || !Array.isArray(tasks) || tasks.length === 0) return;
  if (!window.cytoscape) return;

  const canvasHeight = Math.max(500, Math.min(800, tasks.length * 50));
  const approvalBanner = buildApprovalBanner(tasks);

  container.innerHTML = approvalBanner + `
    <div style="display:flex;...
```

Keep everything after `approvalBanner + \`` exactly as it was.

- [ ] **Step 3: Add CSS for `approval-banner-row` in `public/style.css`**

Open `public/style.css` and add at the end:

```css
.approval-banner-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: #fff;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  font-size: 0.85rem;
}
.btn-sm {
  padding: 3px 10px;
  font-size: 0.78rem;
  border-radius: 5px;
  cursor: pointer;
  border: none;
}
```

- [ ] **Step 4: Verify visually**

If you have a task with `pending_approval` status: open `/tasks`, switch to Dependency Graph. The orange banner should appear at the top with Approve/Reject buttons. Clicking Approve should call the API and remove the row. If no `pending_approval` tasks exist, the banner is hidden.

---

### Task 5: Info panel shows goal and parent context

**Files:**
- Modify: `public/app.js` — the `_taskGraphCy.on('tap', 'node', ...)` handler inside `renderTaskGraph` (line 1951)

When clicking a task node, the info panel currently shows type, status, priority, project, attempt, createdAt. Add the goal title and parent task type so you can see exactly where a task came from.

- [ ] **Step 1: Find the tap handler info panel**

In `renderTaskGraph`, find (around line 1963):

```javascript
if (infoPanel) {
  infoPanel.innerHTML = `
    <strong style="word-break:break-all;">${escapeHtml(task.type || task.id.slice(0, 12))}</strong>
    <span class="badge badge-${escapeHtml(task.status || '')}">${escapeHtml(task.status || '--')}</span>
    <span style="color:#64748b;font-size:0.75rem;">Priority: ${task.priority ?? '—'}</span>
    <span style="color:#64748b;font-size:0.75rem;">Project: ${escapeHtml(task.projectSlug || '—')}</span>
    <span style="color:#64748b;font-size:0.75rem;">Attempt: ${task.attempt ?? 0} / ${task.maxAttempts ?? '—'}</span>
    <span style="color:#64748b;font-size:0.75rem;">${task.createdAt ? new Date(task.createdAt).toLocaleString() : ''}</span>
    <a href="#" onclick="event.preventDefault();navigate('/tasks/${encodeURIComponent(task.id)}')" style="font-size:0.78rem;color:#3b82f6;margin-top:4px;">Open detail →</a>`;
  infoPanel.style.display = 'flex';
}
```

- [ ] **Step 2: Extend the panel to show goal title and parent task**

Replace the `infoPanel.innerHTML` block with:

```javascript
if (infoPanel) {
  const gid = task.goal_id || task.goalId;
  const goal = (portfolioState.goalsAllCache || []).find((g) => g.id === gid);
  const goalLine = goal
    ? `<span style="color:#3b82f6;font-size:0.75rem;">Goal: ${escapeHtml((goal.title || '').slice(0, 24))}</span>`
    : '';
  const parentId = task.parent_task_id || task.parentTaskId;
  const parentTask = parentId ? tasks.find((t) => t.id === parentId) : null;
  const parentLine = parentTask
    ? `<span style="color:#7c3aed;font-size:0.75rem;">↳ spawned by: ${escapeHtml(parentTask.type || parentId.slice(0, 8))}</span>`
    : '';
  infoPanel.innerHTML = `
    <strong style="word-break:break-all;">${escapeHtml(task.type || task.id.slice(0, 12))}</strong>
    <span class="badge badge-${escapeHtml(task.status || '')}">${escapeHtml(task.status || '--')}</span>
    ${goalLine}
    ${parentLine}
    <span style="color:#64748b;font-size:0.75rem;">Priority: ${task.priority ?? '—'}</span>
    <span style="color:#64748b;font-size:0.75rem;">Project: ${escapeHtml(task.projectSlug || '—')}</span>
    <span style="color:#64748b;font-size:0.75rem;">Attempt: ${task.attempt ?? 0} / ${task.maxAttempts ?? '—'}</span>
    <span style="color:#64748b;font-size:0.75rem;">${task.createdAt ? new Date(task.createdAt).toLocaleString() : ''}</span>
    <a href="#" onclick="event.preventDefault();navigate('/tasks/${encodeURIComponent(task.id)}')" style="font-size:0.78rem;color:#3b82f6;margin-top:4px;">Open detail →</a>`;
  infoPanel.style.display = 'flex';
}
```

- [ ] **Step 3: Verify visually**

Click any task node in the graph. If the task belongs to a goal in the cache, you see "Goal: <title>" in blue. If the task was spawned by another task, you see "↳ spawned by: <type>" in purple.

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Full Goal → Task hierarchy with arrows | Task 3 |
| Batch grouping under goals | Task 3 |
| `parentTaskId` spawned edges | Task 2 |
| `pending_approval` / `awaiting_user` colors | Task 1 |
| "Approve first" banner with action buttons | Task 4 |
| Info panel shows goal and parent context | Task 5 |
| TB layout (hierarchy reads top-to-bottom) | Task 3, Step 6 |
| Goals loaded when navigating directly to /tasks | Task 3, Step 1 |

**Placeholder scan:** None — all steps contain complete code.

**Type consistency:** 
- `t.goal_id || t.goalId` — used consistently in Tasks 2, 3, 5 (API returns snake_case `goal_id`; cache uses camelCase `goalId`)
- `t.parent_task_id || t.parentTaskId` — used consistently in Tasks 2, 5
- `t.batch_id || t.batchId` — used consistently in Task 3
- `buildApprovalBanner` defined in Task 4 Step 1, called in Task 4 Step 2 — consistent
- `approveBannerTask` / `rejectBannerTask` — defined and called in same task
- `addEdge` — defined at top of `buildTaskGraphElements` in Task 3; Task 2 adds calls to it inside the same function

**Order dependency:** Tasks 2 and 3 both modify `buildTaskGraphElements`. Task 3 Step 2 rewrites the entire function including the `addEdge` helper and the `parentTaskId` edge from Task 2. **Implementer must apply Task 2's spawned edge and style changes first, then apply Task 3's full function rewrite — Task 3's replacement already includes the `parentTaskId` edge.** If doing Task 3 first, skip Task 2's Step 2 (the edge code is already in Task 3's rewrite).
