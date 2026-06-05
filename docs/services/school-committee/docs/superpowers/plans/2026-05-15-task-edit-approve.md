# Task Edit + Approve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Edit and Approve (draft→open, completed→verified) actions to the task detail page (staff only) and the admin tasks table, plus the backing API endpoints.

**Architecture:** Four new pieces — `updateTask()` in the DB layer, `PATCH /api/tasks/[id]` route, `POST /api/tasks/[id]/verify` route, then UI wired to all three. Edit uses an inline form (no separate page). Approve is context-sensitive by status. All mutations write audit events in the same transaction.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma, Tailwind CSS, existing `lib/db/tasks.ts` + `lib/db/audit.ts` patterns.

---

## File Map

| Action | File |
|--------|------|
| Modify | `lib/db/tasks.ts` — add `updateTask()` |
| Modify | `app/api/tasks/[id]/route.ts` — add `PATCH` handler |
| Create | `app/api/tasks/[id]/verify/route.ts` — new verify route |
| Modify | `app/(public)/tasks/[id]/page.tsx` — Edit button + inline form |
| Modify | `app/admin/tasks/page.tsx` — Edit + Approve columns |

---

## Task 1: `updateTask()` in DB layer

**Files:**
- Modify: `lib/db/tasks.ts`

- [ ] **Step 1: Add the interface and function after `deleteTask`**

Open `lib/db/tasks.ts`. After the closing brace of `deleteTask`, add:

```typescript
export interface UpdateTaskParams {
  taskId: string;
  actorUserId: string;
  tenantId: string;
  schoolId: string;
  title: string;
  description: string;
  priority: string;
  deadline?: string | null;
  requestId?: string;
}

export async function updateTask(params: UpdateTaskParams): Promise<Task> {
  return db.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: params.taskId } });
    if (!task) throw new NotFoundError("Task not found");

    if (params.deadline !== undefined && params.deadline !== null) {
      const d = new Date(params.deadline);
      if (isNaN(d.getTime())) {
        throw new AppError("VALIDATION_ERROR", "Invalid deadline date", 400);
      }
    }

    const updated = await tx.task.update({
      where: { id: params.taskId },
      data: {
        title: params.title,
        description: params.description,
        priority: params.priority,
        deadline: params.deadline ? new Date(params.deadline) : params.deadline === null ? null : undefined,
      },
    });

    await writeAuditEvent(
      {
        tenantId: params.tenantId,
        schoolId: params.schoolId,
        actorUserId: params.actorUserId,
        action: "task.updated",
        entityType: "task",
        entityId: params.taskId,
        requestId: params.requestId,
      },
      tx,
    );

    return updated;
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (clean).

---

## Task 2: `PATCH /api/tasks/[id]` — edit endpoint

**Files:**
- Modify: `app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Add `updateTask` to the import line**

The current import is:
```typescript
import { getTaskDetail, deleteTask } from "@/lib/db/tasks";
```

Change it to:
```typescript
import { getTaskDetail, deleteTask, updateTask } from "@/lib/db/tasks";
```

- [ ] **Step 2: Add `PATCH` handler between `DELETE` and `GET`**

After the closing brace of the `DELETE` export and before `export async function GET`, insert:

```typescript
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));
  const { id } = await params;
  const ROUTE = `/api/tasks/${id}`;

  try {
    const user = await getCurrentUser(requestId);
    if (!user.roles.some((r) => STAFF_ROLES.has(r))) {
      throw new AppError("FORBIDDEN", "Insufficient role", 403);
    }

    let body: { title?: string; description?: string; priority?: string; deadline?: string | null };
    try {
      body = await req.json() as typeof body;
    } catch {
      throw new AppError("VALIDATION_ERROR", "Invalid JSON body", 400);
    }

    if (!body.title?.trim()) throw new AppError("VALIDATION_ERROR", "title is required", 400);
    if (!body.description?.trim()) throw new AppError("VALIDATION_ERROR", "description is required", 400);
    if (!body.priority) throw new AppError("VALIDATION_ERROR", "priority is required", 400);

    const tenantId = process.env.DEFAULT_TENANT_ID ?? "";
    const schoolId = process.env.DEFAULT_SCHOOL_ID ?? "";
    if (!tenantId || !schoolId) {
      throw new AppError("INTERNAL_ERROR", "Server misconfiguration", 500);
    }

    const task = await updateTask({
      taskId: id,
      actorUserId: user.id,
      tenantId,
      schoolId,
      title: body.title,
      description: body.description,
      priority: body.priority,
      deadline: body.deadline,
      requestId,
    });

    logger.info(`${ROUTE} PATCH: task updated`, { request_id: requestId, task_id: id });
    return NextResponse.json({ task: { id: task.id, title: task.title, status: task.status } }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error(`${ROUTE} PATCH: error`, {
        request_id: requestId,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error(`${ROUTE} PATCH: unexpected error`, {
      request_id: requestId,
      error_message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

---

## Task 3: `POST /api/tasks/[id]/verify` — approve completed task

**Files:**
- Create: `app/api/tasks/[id]/verify/route.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p app/api/tasks/\[id\]/verify
```

- [ ] **Step 2: Create the route file**

Create `app/api/tasks/[id]/verify/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { getTask } from "@/lib/db/tasks";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/db/audit";
import { toErrorResponse, AppError } from "@/types/errors";

const STAFF_ROLES = new Set(["committee", "teacher", "school_staff", "admin"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));
  const { id: taskId } = await params;
  const ROUTE = `/api/tasks/${taskId}/verify`;

  try {
    const user = await getCurrentUser(requestId);
    if (!user.roles.some((r) => STAFF_ROLES.has(r))) {
      throw new AppError("FORBIDDEN", "Staff role required", 403);
    }

    const tenantId = process.env.DEFAULT_TENANT_ID ?? "";
    const schoolId = process.env.DEFAULT_SCHOOL_ID ?? "";
    if (!tenantId || !schoolId) {
      throw new AppError("INTERNAL_ERROR", "Server misconfiguration", 500);
    }

    const task = await getTask(taskId);
    if (task.status !== "completed") {
      throw new AppError("VALIDATION_ERROR", "Task must be in completed status to verify", 400);
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.task.update({
        where: { id: taskId },
        data: { status: "verified", verifiedBy: user.id },
      });

      await tx.taskStatusEvent.create({
        data: {
          taskId,
          oldStatus: "completed",
          newStatus: "verified",
          actorUserId: user.id,
        },
      });

      await writeAuditEvent(
        {
          tenantId,
          schoolId,
          actorUserId: user.id,
          action: "task.verified",
          entityType: "task",
          entityId: taskId,
          requestId,
        },
        tx,
      );

      return result;
    });

    logger.info(`${ROUTE}: task verified`, { request_id: requestId, task_id: taskId, actor: user.id });
    return NextResponse.json({ task: { id: updated.id, status: updated.status } }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error(`${ROUTE}: error`, {
        request_id: requestId,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error(`${ROUTE}: unexpected error`, {
      request_id: requestId,
      error_message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

---

## Task 4: Edit button + inline form on `/tasks/[id]`

**Files:**
- Modify: `app/(public)/tasks/[id]/page.tsx`

The current file already has `isStaff` state and a "Smazat úkol" delete button. We add an edit form that appears inline when "Upravit" is clicked.

- [ ] **Step 1: Add edit state variables**

In the `TaskDetail` function, after the existing state declarations (`const [actionError, setActionError] = useState...`), add:

```typescript
const [editing, setEditing] = useState(false);
const [editTitle, setEditTitle] = useState("");
const [editDescription, setEditDescription] = useState("");
const [editPriority, setEditPriority] = useState("normal");
const [editDeadline, setEditDeadline] = useState("");
const [saveLoading, setSaveLoading] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
```

- [ ] **Step 2: Populate edit state when task loads**

In the `.then(([taskData, sessionData]...)` block, after `setTask(taskData.task ?? null)`, add:

```typescript
if (taskData.task) {
  setEditTitle(taskData.task.title);
  setEditDescription(taskData.task.description);
  setEditPriority(taskData.task.priority);
  setEditDeadline(taskData.task.deadline ? taskData.task.deadline.split("T")[0] : "");
}
```

- [ ] **Step 3: Add `saveEdit` function**

After the existing `deleteTask` async function, add:

```typescript
async function saveEdit() {
  setSaveLoading(true);
  setSaveError(null);
  try {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription,
        priority: editPriority,
        deadline: editDeadline || null,
      }),
    });
    if (res.status === 401) { window.location.href = `/login?next=/tasks/${id}`; return; }
    if (!res.ok) {
      const body = await res.json();
      setSaveError(body.error?.message ?? "Uložení selhalo");
      return;
    }
    setTask((t) => t ? { ...t, title: editTitle, description: editDescription, priority: editPriority, deadline: editDeadline || null } : t);
    setEditing(false);
  } catch {
    setSaveError("Chyba sítě");
  } finally {
    setSaveLoading(false);
  }
}
```

- [ ] **Step 4: Add Edit button next to Delete button**

Find the block that renders the "Smazat úkol" button:

```typescript
{isStaff && (
  <button
    onClick={deleteTask}
    disabled={actionLoading}
    className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-colors"
  >
    {actionLoading ? "…" : "Smazat úkol"}
  </button>
)}
```

Replace it with:

```typescript
{isStaff && (
  <>
    <button
      onClick={() => setEditing((e) => !e)}
      className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
    >
      {editing ? "Zrušit" : "Upravit"}
    </button>
    <button
      onClick={deleteTask}
      disabled={actionLoading}
      className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-colors"
    >
      {actionLoading ? "…" : "Smazat úkol"}
    </button>
  </>
)}
```

- [ ] **Step 5: Add inline edit form below the action buttons**

After the closing `</div>` of the `flex gap-3 pt-2 flex-wrap` buttons div, add:

```typescript
{editing && (
  <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
    {saveError && <p className="text-sm text-red-600">{saveError}</p>}
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Název</label>
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        value={editTitle}
        onChange={(e) => setEditTitle(e.target.value)}
      />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Popis</label>
      <textarea
        rows={4}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        value={editDescription}
        onChange={(e) => setEditDescription(e.target.value)}
      />
    </div>
    <div className="flex gap-3 flex-wrap">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Priorita</label>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={editPriority}
          onChange={(e) => setEditPriority(e.target.value)}
        >
          <option value="high">vysoká</option>
          <option value="normal">normální</option>
          <option value="low">nízká</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Termín</label>
        <input
          type="date"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={editDeadline}
          onChange={(e) => setEditDeadline(e.target.value)}
        />
      </div>
    </div>
    <button
      onClick={saveEdit}
      disabled={saveLoading || !editTitle.trim() || !editDescription.trim()}
      className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-colors"
    >
      {saveLoading ? "Ukládám…" : "Uložit změny"}
    </button>
  </div>
)}
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

---

## Task 5: Edit + Approve columns in `/admin/tasks`

**Files:**
- Modify: `app/admin/tasks/page.tsx`

The current page loads tasks via `GET /api/tasks?limit=200` and has a single "Smazat" button per row. We add inline edit (expand row) and context-sensitive Approve.

- [ ] **Step 1: Replace the entire file**

The changes are substantial enough that a full rewrite is cleaner than patching. Write `app/admin/tasks/page.tsx` with this content:

```typescript
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  createdAt: string;
  assigneeName: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Koncept",
  open: "Otevřený",
  reserved: "Probíhá",
  claimed: "Probíhá",
  completed: "Dokončený",
  verified: "Ověřený",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "vysoká",
  normal: "normální",
  low: "nízká",
};

function canApprove(status: string) {
  return status === "draft" || status === "completed";
}

function approveLabel(status: string) {
  if (status === "draft") return "Publikovat";
  if (status === "completed") return "Ověřit";
  return "";
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // approve
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("normal");
  const [editDeadline, setEditDeadline] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tasks?limit=200")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error.message);
        else setTasks(d.items ?? []);
      })
      .catch(() => setError("Chyba sítě"))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(""); // not in list response — user must retype or we fetch
    setEditPriority(task.priority);
    setEditDeadline(task.deadline ? task.deadline.split("T")[0] : "");
    setSaveError(null);
    // Fetch full description
    fetch(`/api/tasks/${task.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.task?.description) setEditDescription(d.task.description); })
      .catch(() => {});
  }

  async function saveEdit(taskId: string) {
    setSaveLoading(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          priority: editPriority,
          deadline: editDeadline || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setSaveError(body.error?.message ?? "Uložení selhalo");
        return;
      }
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, title: editTitle, priority: editPriority, deadline: editDeadline || null }
            : t,
        ),
      );
      setEditingId(null);
    } catch {
      setSaveError("Chyba sítě");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleDelete(taskId: string, title: string) {
    if (!confirm(`Opravdu smazat úkol "${title}"? Tato akce je nevratná.`)) return;
    setDeletingId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        alert(`Chyba: ${body.error?.message ?? res.status}`);
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch {
      alert("Chyba sítě");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleApprove(task: Task) {
    const label = approveLabel(task.status);
    if (!confirm(`${label} úkol "${task.title}"?`)) return;
    setApprovingId(task.id);
    try {
      const url =
        task.status === "draft"
          ? `/api/tasks/${task.id}/publish`
          : `/api/tasks/${task.id}/verify`;

      let body: Record<string, string> = {};
      if (task.status === "draft") {
        // publish requires title + description — fetch current values first
        const detail = await fetch(`/api/tasks/${task.id}`).then((r) => r.json());
        body = {
          title: detail.task?.title ?? task.title,
          description: detail.task?.description ?? "",
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json();
        alert(`Chyba: ${b.error?.message ?? res.status}`);
        return;
      }
      const newStatus = task.status === "draft" ? "open" : "verified";
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)),
      );
    } catch {
      alert("Chyba sítě");
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Správa úkolů</h1>
        <Link
          href="/dashboard/tasks/new"
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 transition-colors"
        >
          + Nový úkol
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-400">Načítám…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && tasks.length === 0 && (
        <p className="text-sm text-gray-500">Žádné úkoly.</p>
      )}

      {tasks.length > 0 && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-3 font-medium">Název</th>
              <th className="pb-2 pr-3 font-medium">Stav</th>
              <th className="pb-2 pr-3 font-medium">Priorita</th>
              <th className="pb-2 pr-3 font-medium">Termín</th>
              <th className="pb-2 pr-3 font-medium">Řeší</th>
              <th className="pb-2 font-medium">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tasks.map((task) => (
              <>
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium text-gray-900 max-w-xs truncate">
                    <Link href={`/tasks/${task.id}`} className="hover:text-blue-600 hover:underline">
                      {task.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-gray-600">{STATUS_LABEL[task.status] ?? task.status}</td>
                  <td className="py-2 pr-3 text-gray-600">{PRIORITY_LABEL[task.priority] ?? task.priority}</td>
                  <td className="py-2 pr-3 text-gray-500">
                    {task.deadline ? new Date(task.deadline).toLocaleDateString("cs-CZ") : "—"}
                  </td>
                  <td className="py-2 pr-3 text-gray-500">{task.assigneeName ?? "—"}</td>
                  <td className="py-2">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() =>
                          editingId === task.id ? setEditingId(null) : startEdit(task)
                        }
                        className="text-yellow-600 hover:text-yellow-800 text-xs font-medium"
                      >
                        {editingId === task.id ? "Zrušit" : "Upravit"}
                      </button>
                      <button
                        onClick={() => handleDelete(task.id, task.title)}
                        disabled={deletingId === task.id}
                        className="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-50"
                      >
                        {deletingId === task.id ? "Mažu…" : "Smazat"}
                      </button>
                      {canApprove(task.status) && (
                        <button
                          onClick={() => handleApprove(task)}
                          disabled={approvingId === task.id}
                          className="text-green-700 hover:text-green-900 text-xs font-medium disabled:opacity-50"
                        >
                          {approvingId === task.id ? "…" : approveLabel(task.status)}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {editingId === task.id && (
                  <tr key={`${task.id}-edit`}>
                    <td colSpan={6} className="py-3 px-2 bg-yellow-50 border-b border-yellow-100">
                      <div className="space-y-2 max-w-xl">
                        {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                        <div className="flex gap-2 flex-wrap">
                          <div className="flex-1 min-w-48">
                            <label className="block text-xs text-gray-500 mb-0.5">Název</label>
                            <input
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">Priorita</label>
                            <select
                              className="border border-gray-200 rounded px-2 py-1 text-sm"
                              value={editPriority}
                              onChange={(e) => setEditPriority(e.target.value)}
                            >
                              <option value="high">vysoká</option>
                              <option value="normal">normální</option>
                              <option value="low">nízká</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">Termín</label>
                            <input
                              type="date"
                              className="border border-gray-200 rounded px-2 py-1 text-sm"
                              value={editDeadline}
                              onChange={(e) => setEditDeadline(e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">Popis</label>
                          <textarea
                            rows={3}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                          />
                        </div>
                        <button
                          onClick={() => saveEdit(task.id)}
                          disabled={saveLoading || !editTitle.trim() || !editDescription.trim()}
                          className="bg-blue-600 text-white rounded px-3 py-1 text-xs font-medium disabled:opacity-50"
                        >
                          {saveLoading ? "Ukládám…" : "Uložit"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

---

## Self-Review

**Spec coverage:**
- ✅ `updateTask()` DB function — Task 1
- ✅ `PATCH /api/tasks/[id]` — Task 2
- ✅ `POST /api/tasks/[id]/verify` — Task 3
- ✅ Edit button + inline form on `/tasks/[id]` — Task 4
- ✅ Edit + Delete + Approve in `/admin/tasks` — Task 5
- ✅ Approve routes: draft→publish uses existing `/publish`, completed→verify uses new `/verify`

**Placeholder scan:** No TBDs, all code is complete.

**Type consistency:**
- `UpdateTaskParams` defined in Task 1, consumed in Task 2 — consistent field names (`taskId`, `title`, `description`, `priority`, `deadline`)
- `getTask` imported in Task 3 — already exported from `lib/db/tasks.ts`
- `writeAuditEvent` used in Task 3 same pattern as Task 1 — consistent
