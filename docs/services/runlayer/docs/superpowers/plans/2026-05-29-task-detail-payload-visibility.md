# Task Detail Payload Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the task detail view at `/tasks/:taskId` show all decision-relevant information: full `payloadRef` (open by default), `aiRequestLog` (the prompt sent to AI), and `aiResponseLog` (the AI's response), using contracted JSON format from `DashboardTaskDetailSchema`.

**Architecture:** The backend already stores `aiRequestLog` and `aiResponseLog` on the task entity and returns them from `GET /api/dashboard/tasks/:taskId/detail` via `toTaskDetail()`. The frontend `openExecutionLog()` function fetches this detail but only renders `payloadRef` in a collapsed block — it omits `aiRequestLog` and `aiResponseLog` entirely. Fix is purely in `public/app.js`: expand the `metaEl.innerHTML` section in `openExecutionLog()` to also render AI request/response sections open by default, and ensure `payloadRef` is open by default too.

**Tech Stack:** Vanilla JS (`public/app.js`), NestJS backend (no backend changes needed — data is already returned)

---

### Task 1: Fix `openExecutionLog` to show all payload sections open by default

**Files:**
- Modify: `public/app.js:2035-2064` (the `metaEl.innerHTML` render block inside `openExecutionLog`)

The current block renders `payloadRef` in a collapsed `<pre>` with `style="display:none"`. `aiRequestLog` and `aiResponseLog` are missing.

The fix:
1. Remove `style="display:none"` from the payload pre-block so it opens by default.
2. Update the `► Payload` toggle label arrow from `►` to `▼` to indicate it's expanded.
3. Add `aiRequestLog` section (open by default, labeled "AI Request — Prompt sent to agent") after payload.
4. Add `aiResponseLog` section (open by default, labeled "AI Response — Agent output") after AI request.
5. Add a human-readable description line before the `payloadRef` block based on `payloadRef.goal_title`, `payloadRef.description`, or `payloadRef.type`.

- [ ] **Step 1: Locate and read the exact current block**

File: `public/app.js`, lines 2035–2068 (the `if (detail)` block inside `openExecutionLog`).

Current payload section (lines 2060–2063):
```js
${detail.payloadRef ? `<div class="task-detail-section task-detail-json">
  <div class="step-log-rich-label" onclick="toggleLogMeta('exec-td-payload')">► Payload (payloadRef)</div>
  <pre class="step-log-meta-block" id="exec-td-payload" style="display:none">${escapeHtml(JSON.stringify(detail.payloadRef, null, 2))}</pre>
</div>` : ''}
```

- [ ] **Step 2: Replace the payload+approval block with expanded version**

Replace the block from line 2035 (`if (detail) {`) through the closing `} else {` at 2065 with:

```js
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

      // Human-readable summary from payloadRef
      const payloadSummary = (() => {
        const p = detail.payloadRef || {};
        const desc = p.goal_title || p.description || p.title || p.prompt || null;
        if (!desc) return '';
        return `<div class="task-detail-row" style="margin-bottom:6px;color:#475569;font-size:0.85rem;font-style:italic">${escapeHtml(String(desc).slice(0, 300))}</div>`;
      })();

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
          <div class="step-log-rich-label open" onclick="toggleLogMeta('exec-td-payload')">▼ Payload — what this task will do</div>
          ${payloadSummary}
          <pre class="step-log-meta-block open" id="exec-td-payload">${escapeHtml(JSON.stringify(detail.payloadRef, null, 2))}</pre>
        </div>` : ''}
        ${detail.aiRequestLog ? `<div class="task-detail-section task-detail-json">
          <div class="step-log-rich-label open" onclick="toggleLogMeta('exec-td-ai-req')">▼ AI Request — prompt sent to agent</div>
          <pre class="step-log-meta-block open" id="exec-td-ai-req">${escapeHtml(JSON.stringify(detail.aiRequestLog, null, 2))}</pre>
        </div>` : ''}
        ${detail.aiResponseLog ? `<div class="task-detail-section task-detail-json">
          <div class="step-log-rich-label open" onclick="toggleLogMeta('exec-td-ai-resp')">▼ AI Response — agent output</div>
          <pre class="step-log-meta-block open" id="exec-td-ai-resp">${escapeHtml(JSON.stringify(detail.aiResponseLog, null, 2))}</pre>
        </div>` : ''}
        ${approvalBtns}`;
    } else {
```

- [ ] **Step 3: Verify `step-log-meta-block.open` renders as visible**

Check `public/style.css` for `.step-log-meta-block` to confirm `open` class makes it visible (not `display:none`).

Look for:
```css
.step-log-meta-block { display: none; ... }
.step-log-meta-block.open { display: block; }
```

If the `open` class is not defined as `display: block`, add it. The `toggleLogMeta` function in `app.js:191` uses `classList.toggle('open')`, so the CSS must already handle `open`.

- [ ] **Step 4: Also fix `toggleLogMeta` label update to handle pre-opened blocks**

Current `toggleLogMeta` (line 191–197):
```js
function toggleLogMeta(id) {
  const block = document.getElementById(id);
  if (!block) return;
  const open = block.classList.toggle('open');
  const toggle = block.previousElementSibling;
  if (toggle) toggle.textContent = open ? 'Hide metadata' : 'Show metadata';
}
```

The label update clobbers the descriptive label text. Fix to preserve the prefix:

```js
function toggleLogMeta(id) {
  const block = document.getElementById(id);
  if (!block) return;
  const open = block.classList.toggle('open');
  const toggle = block.previousElementSibling;
  if (toggle) {
    const text = toggle.textContent || '';
    // Replace only the leading arrow character
    toggle.textContent = open
      ? text.replace(/^[►▶▼▲]\s*/, '▼ ')
      : text.replace(/^[►▶▼▲]\s*/, '► ');
  }
}
```

- [ ] **Step 5: Check style.css for `.step-log-meta-block` and `.step-log-rich-label`**

```bash
grep -n "step-log-meta-block\|step-log-rich-label" /home/ssf/Documents/Github/runlayer/public/style.css
```

If `.step-log-meta-block` defaults to `display:none` and `open` makes it visible — we're done. If the default is not `display:none`, the blocks will always be open (which is what we want for payload/AI logs anyway).

- [ ] **Step 6: Test in browser**

Navigate to a task detail URL like `https://runlayer.alfares.cz/tasks/<uuid>`.

Verify:
- Payload section is **open by default** (not collapsed)
- A human-readable summary line appears above the JSON if `goal_title`, `description`, or `prompt` exists in `payloadRef`
- If `aiRequestLog` exists: "AI Request — prompt sent to agent" section is visible and open
- If `aiResponseLog` exists: "AI Response — agent output" section is visible and open
- Clicking the label collapses/expands the section
- Approve/Reject buttons still appear for `pending_approval` tasks

---

### Task 2: Validate the `DashboardTaskDetailSchema` contract includes ai logs

**Files:**
- Read: `src/contracts/http-responses.contract.ts:87-106`

The `DashboardTaskDetailSchema` currently has:
```ts
aiRequestLog: z.unknown().nullable(),
aiResponseLog: z.unknown().nullable(),
```

This is correctly typed. No change needed — the backend already returns these fields.

- [ ] **Step 1: Confirm the schema covers the fields**

```bash
grep -n "aiRequestLog\|aiResponseLog" /home/ssf/Documents/Github/runlayer/src/contracts/http-responses.contract.ts
```

Expected output: lines showing both fields in `DashboardTaskDetailSchema`.

- [ ] **Step 2: Confirm `toTaskDetail()` returns both fields**

```bash
grep -n "aiRequestLog\|aiResponseLog" /home/ssf/Documents/Github/runlayer/src/dashboard/dashboard.controller.ts
```

Expected: lines 198-199 showing `aiRequestLog: t.aiRequestLog ?? null` and `aiResponseLog: t.aiResponseLog ?? null`.

No backend changes needed.

---

### Task 3: Deploy and verify

**Files:**
- No new files

- [ ] **Step 1: Run deploy**

```bash
cd /home/ssf/Documents/Github/runlayer && ./scripts/deploy.sh
```

- [ ] **Step 2: Open a task in browser and verify all sections render**

Visit `https://runlayer.alfares.cz/tasks/<uuid>` for a task that has been executed (so `aiRequestLog` and `aiResponseLog` are populated).

Verify all three sections are visible by default.

---

## Self-Review

**Spec coverage:**
- ✅ Show `payloadRef` open by default — Task 1 Step 2
- ✅ Show `aiRequestLog` (prompt to AI) open by default — Task 1 Step 2
- ✅ Show `aiResponseLog` (AI response) open by default — Task 1 Step 2
- ✅ Human-readable summary from payload — Task 1 Step 2
- ✅ Contracted JSON format — Task 2 confirms `DashboardTaskDetailSchema` already includes these
- ✅ Toggle still works — Task 1 Steps 4-5

**Placeholder scan:** No placeholders — all code is complete.

**Type consistency:** `detail.aiRequestLog`, `detail.aiResponseLog`, `detail.payloadRef` match what `toTaskDetail()` returns and what `DashboardTaskDetailSchema` defines.
