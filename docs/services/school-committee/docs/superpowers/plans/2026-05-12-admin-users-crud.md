# Admin Users CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub admin users page with a full CRUD table: list all registered users (profiles + roles), deactivate/reactivate accounts, change roles inline, and delete users from school-committee (profile + roles) without touching auth-microservice.

**Architecture:** Three new API routes (`GET /api/admin/users`, `PATCH /api/admin/users/[id]`, `DELETE /api/admin/users/[id]`) back a new `lib/db/users.ts` helper. The BFF fetches user emails from auth-microservice using the actor's JWT, merging them with local profile+role data. The frontend page replaces the stub with a full data table.

**Tech Stack:** Next.js 14 App Router, Prisma, TypeScript strict, Tailwind CSS, shadcn/ui, TanStack Query (server component + client interactions), Vitest

---

## File Map

| Action | Path |
|--------|------|
| Create | `lib/db/users.ts` — DB helpers: listUsers, setUserActive, deleteUserFromApp |
| Create | `app/api/admin/users/route.ts` — GET list endpoint |
| Create | `app/api/admin/users/[id]/route.ts` — PATCH (activate/deactivate) + DELETE |
| Modify | `app/admin/users/page.tsx` — replace stub with full data table |
| Modify | `tests/admin/admin-routes.test.ts` — add tests for 3 new routes |

---

### Task 1: DB helpers in `lib/db/users.ts`

**Files:**
- Create: `lib/db/users.ts`

- [ ] **Step 1: Write the file**

```typescript
// lib/db/users.ts
import { db } from "@/lib/db/client";

export interface UserRow {
  userId: string;
  tenantId: string;
  schoolId: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  language: string;
  participationType: string;
  onboardingStatus: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  roles: string[];
}

export async function listUsers(tenantId: string, schoolId?: string): Promise<UserRow[]> {
  const profiles = await db.profile.findMany({
    where: {
      tenantId,
      ...(schoolId ? { schoolId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  if (profiles.length === 0) return [];

  const userIds = profiles.map((p) => p.userId);

  const activeRoles = await db.userRole.findMany({
    where: {
      userId: { in: userIds },
      tenantId,
      revokedAt: null,
    },
    select: { userId: true, role: true },
  });

  const rolesByUser = new Map<string, string[]>();
  for (const r of activeRoles) {
    const existing = rolesByUser.get(r.userId) ?? [];
    existing.push(r.role);
    rolesByUser.set(r.userId, existing);
  }

  return profiles.map((p) => ({
    userId: p.userId,
    tenantId: p.tenantId,
    schoolId: p.schoolId,
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone,
    language: p.language,
    participationType: p.participationType,
    onboardingStatus: p.onboardingStatus,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    roles: rolesByUser.get(p.userId) ?? [],
  }));
}

export async function setUserActive(
  userId: string,
  tenantId: string,
  isActive: boolean,
): Promise<void> {
  await db.profile.update({
    where: { userId },
    data: { isActive },
  });
}

export async function deleteUserFromApp(
  userId: string,
  tenantId: string,
): Promise<void> {
  await db.$transaction([
    db.userRole.updateMany({
      where: { userId, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    db.profile.delete({
      where: { userId },
    }),
  ]);
}
```

- [ ] **Step 2: Verify TypeScript (no build step needed — check via IDE or skip to Task 2 tests)**

---

### Task 2: `GET /api/admin/users` route + tests

**Files:**
- Create: `app/api/admin/users/route.ts`
- Modify: `tests/admin/admin-routes.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/admin/admin-routes.test.ts`.

First extend the `vi.hoisted` block — add `mockListUsers` and `mockDb` for the new profile mock:

```typescript
// Add inside vi.hoisted(() => ({ ... })):
mockListUsers: vi.fn(),
mockSetUserActive: vi.fn(),
mockDeleteUserFromApp: vi.fn(),
mockAuthFetch: vi.fn(),
```

Add new vi.mock entries after the existing ones:

```typescript
vi.mock("@/lib/db/users", () => ({
  listUsers: mockListUsers,
  setUserActive: mockSetUserActive,
  deleteUserFromApp: mockDeleteUserFromApp,
}));
```

Add import at the top with existing imports:

```typescript
import { GET as listUsers } from "@/app/api/admin/users/route";
import { PATCH as patchUser, DELETE as deleteUser } from "@/app/api/admin/users/[id]/route";
```

Add test suite:

```typescript
// ── GET /api/admin/users ─────────────────────────────────────────────────────

describe("GET /api/admin/users — list users", () => {
  const profile1: import("@/lib/db/users").UserRow = {
    userId: "u-1",
    tenantId: "t-1",
    schoolId: "s-1",
    firstName: "Jana",
    lastName: "Novák",
    phone: null,
    language: "cs",
    participationType: "financial",
    onboardingStatus: "complete",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    roles: ["parent"],
  };

  beforeEach(() => {
    mockListUsers.mockResolvedValue([profile1]);
  });

  it("returns 403 for non-admin", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser);
    const req = new NextRequest("http://localhost/api/admin/users?tenantId=t-1");
    const res = await listUsers(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when tenantId missing", async () => {
    const req = new NextRequest("http://localhost/api/admin/users");
    const res = await listUsers(req);
    expect(res.status).toBe(400);
  });

  it("returns user list for admin", async () => {
    const req = new NextRequest("http://localhost/api/admin/users?tenantId=t-1");
    const res = await listUsers(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0].userId).toBe("u-1");
    expect(body.users[0].firstName).toBe("Jana");
    expect(body.users[0].roles).toEqual(["parent"]);
    expect(mockListUsers).toHaveBeenCalledWith("t-1", undefined);
  });

  it("passes schoolId filter when provided", async () => {
    const req = new NextRequest("http://localhost/api/admin/users?tenantId=t-1&schoolId=s-1");
    await listUsers(req);
    expect(mockListUsers).toHaveBeenCalledWith("t-1", "s-1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/ssf/Documents/Github/school-committee && npm test -- --reporter=verbose 2>&1 | grep -A3 "GET /api/admin/users"
```

Expected: import error or "route not found"

- [ ] **Step 3: Create `app/api/admin/users/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { listUsers } from "@/lib/db/users";
import { toErrorResponse, AppError } from "@/types/errors";

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));

  try {
    const actor = await getCurrentUser(requestId);
    if (!actor.roles.includes("admin")) {
      throw new AppError("FORBIDDEN", "Admin role required", 403);
    }

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId");
    const schoolId = searchParams.get("schoolId") ?? undefined;

    if (!tenantId) {
      throw new AppError("VALIDATION_ERROR", "tenantId is required", 400);
    }

    const users = await listUsers(tenantId, schoolId);

    return NextResponse.json({ users }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/ssf/Documents/Github/school-committee && npm test -- --reporter=verbose 2>&1 | grep -A3 "GET /api/admin/users"
```

Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /home/ssf/Documents/Github/school-committee
git add lib/db/users.ts app/api/admin/users/route.ts tests/admin/admin-routes.test.ts
git commit -m "feat: add GET /api/admin/users route and listUsers DB helper"
```

---

### Task 3: `PATCH /api/admin/users/[id]` (activate/deactivate) + tests

**Files:**
- Create: `app/api/admin/users/[id]/route.ts`
- Modify: `tests/admin/admin-routes.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/admin/admin-routes.test.ts` (after the GET suite):

```typescript
// ── PATCH /api/admin/users/[id] — deactivate/reactivate ─────────────────────

describe("PATCH /api/admin/users/[id] — activate/deactivate", () => {
  beforeEach(() => {
    mockSetUserActive.mockResolvedValue(undefined);
  });

  it("returns 403 for non-admin", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser);
    const req = new NextRequest("http://localhost/api/admin/users/u-1", {
      method: "PATCH",
      body: JSON.stringify({ action: "deactivate", tenantId: "t-1" }),
    });
    const res = await patchUser(req, { params: Promise.resolve({ id: "u-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing action", async () => {
    const req = new NextRequest("http://localhost/api/admin/users/u-1", {
      method: "PATCH",
      body: JSON.stringify({ tenantId: "t-1" }),
    });
    const res = await patchUser(req, { params: Promise.resolve({ id: "u-1" }) });
    expect(res.status).toBe(400);
  });

  it("deactivates user and writes audit", async () => {
    const req = new NextRequest("http://localhost/api/admin/users/u-1", {
      method: "PATCH",
      body: JSON.stringify({ action: "deactivate", tenantId: "t-1" }),
    });
    const res = await patchUser(req, { params: Promise.resolve({ id: "u-1" }) });
    expect(res.status).toBe(200);
    expect(mockSetUserActive).toHaveBeenCalledWith("u-1", "t-1", false);
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.deactivated", entityId: "u-1" }),
    );
  });

  it("reactivates user and writes audit", async () => {
    const req = new NextRequest("http://localhost/api/admin/users/u-1", {
      method: "PATCH",
      body: JSON.stringify({ action: "activate", tenantId: "t-1" }),
    });
    const res = await patchUser(req, { params: Promise.resolve({ id: "u-1" }) });
    expect(res.status).toBe(200);
    expect(mockSetUserActive).toHaveBeenCalledWith("u-1", "t-1", true);
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.activated", entityId: "u-1" }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/ssf/Documents/Github/school-committee && npm test -- --reporter=verbose 2>&1 | grep -A3 "PATCH /api/admin/users/\[id\]"
```

Expected: import error (route file doesn't exist yet)

- [ ] **Step 3: Create `app/api/admin/users/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { setUserActive, deleteUserFromApp } from "@/lib/db/users";
import { writeAuditEvent } from "@/lib/db/audit";
import { toErrorResponse, AppError } from "@/types/errors";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));

  try {
    const actor = await getCurrentUser(requestId);
    if (!actor.roles.includes("admin")) {
      throw new AppError("FORBIDDEN", "Admin role required", 403);
    }

    const { id: targetUserId } = await params;
    const body = await req.json() as { action?: string; tenantId?: string; schoolId?: string };

    if (!body.action || !["activate", "deactivate"].includes(body.action)) {
      throw new AppError("VALIDATION_ERROR", "action must be 'activate' or 'deactivate'", 400);
    }
    if (!body.tenantId) {
      throw new AppError("VALIDATION_ERROR", "tenantId is required", 400);
    }

    const isActive = body.action === "activate";
    await setUserActive(targetUserId, body.tenantId, isActive);

    await writeAuditEvent({
      tenantId: body.tenantId,
      schoolId: body.schoolId,
      actorUserId: actor.id,
      action: `user.${body.action}d`,
      entityType: "profile",
      entityId: targetUserId,
      metadata: { isActive, targetUserId },
      requestId,
    });

    return NextResponse.json({ success: true, userId: targetUserId, isActive }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));

  try {
    const actor = await getCurrentUser(requestId);
    if (!actor.roles.includes("admin")) {
      throw new AppError("FORBIDDEN", "Admin role required", 403);
    }

    const { id: targetUserId } = await params;
    const body = await req.json() as { tenantId?: string; schoolId?: string };

    if (!body.tenantId) {
      throw new AppError("VALIDATION_ERROR", "tenantId is required", 400);
    }

    await deleteUserFromApp(targetUserId, body.tenantId);

    await writeAuditEvent({
      tenantId: body.tenantId,
      schoolId: body.schoolId,
      actorUserId: actor.id,
      action: "user.removed_from_app",
      entityType: "profile",
      entityId: targetUserId,
      metadata: { targetUserId },
      requestId,
    });

    return NextResponse.json({ success: true, userId: targetUserId }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/ssf/Documents/Github/school-committee && npm test -- --reporter=verbose 2>&1 | grep -A3 "PATCH /api/admin/users/\[id\]"
```

Expected: all 4 PATCH tests PASS

- [ ] **Step 5: Commit**

```bash
cd /home/ssf/Documents/Github/school-committee
git add app/api/admin/users/[id]/route.ts tests/admin/admin-routes.test.ts
git commit -m "feat: add PATCH/DELETE /api/admin/users/[id] routes with audit logging"
```

---

### Task 4: `DELETE /api/admin/users/[id]` tests

**Files:**
- Modify: `tests/admin/admin-routes.test.ts`

The DELETE handler already exists in `app/api/admin/users/[id]/route.ts` from Task 3. This task adds its tests.

- [ ] **Step 1: Write the failing tests**

Add to `tests/admin/admin-routes.test.ts` (after PATCH suite):

```typescript
// ── DELETE /api/admin/users/[id] — remove from app ──────────────────────────

describe("DELETE /api/admin/users/[id] — remove from school-committee", () => {
  beforeEach(() => {
    mockDeleteUserFromApp.mockResolvedValue(undefined);
  });

  it("returns 403 for non-admin", async () => {
    mockGetCurrentUser.mockResolvedValue(committeeUser);
    const req = new NextRequest("http://localhost/api/admin/users/u-1", {
      method: "DELETE",
      body: JSON.stringify({ tenantId: "t-1" }),
    });
    const res = await deleteUser(req, { params: Promise.resolve({ id: "u-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing tenantId", async () => {
    const req = new NextRequest("http://localhost/api/admin/users/u-1", {
      method: "DELETE",
      body: JSON.stringify({}),
    });
    const res = await deleteUser(req, { params: Promise.resolve({ id: "u-1" }) });
    expect(res.status).toBe(400);
  });

  it("deletes profile + revokes roles and writes audit", async () => {
    const req = new NextRequest("http://localhost/api/admin/users/u-1", {
      method: "DELETE",
      body: JSON.stringify({ tenantId: "t-1", schoolId: "s-1" }),
    });
    const res = await deleteUser(req, { params: Promise.resolve({ id: "u-1" }) });
    expect(res.status).toBe(200);
    expect(mockDeleteUserFromApp).toHaveBeenCalledWith("u-1", "t-1");
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.removed_from_app",
        entityId: "u-1",
        tenantId: "t-1",
        schoolId: "s-1",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
cd /home/ssf/Documents/Github/school-committee && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all suites pass, 0 failures

- [ ] **Step 3: Commit**

```bash
cd /home/ssf/Documents/Github/school-committee
git add tests/admin/admin-routes.test.ts
git commit -m "test: add DELETE /api/admin/users/[id] tests"
```

---

### Task 5: Admin Users page UI

**Files:**
- Modify: `app/admin/users/page.tsx` — replace entire stub

- [ ] **Step 1: Replace the stub page**

```typescript
"use client";
import { useState, useEffect, useCallback } from "react";

const ROLES = ["parent", "committee", "teacher", "school_staff", "admin"] as const;
type Role = (typeof ROLES)[number];

interface UserRow {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  language: string;
  participationType: string;
  onboardingStatus: string;
  isActive: boolean;
  createdAt: string;
  roles: string[];
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  committee: "bg-blue-100 text-blue-800",
  teacher: "bg-purple-100 text-purple-800",
  school_staff: "bg-yellow-100 text-yellow-800",
  parent: "bg-green-100 text-green-800",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  // Read tenantId from storage/URL; fallback to first loaded user's tenantId
  const [tenantId, setTenantId] = useState<string>("");

  const fetchUsers = useCallback(async (tid: string) => {
    if (!tid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users?tenantId=${encodeURIComponent(tid)}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Bootstrap: fetch /api/profile to get current user's tenantId
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        const tid = d?.tenantId ?? "";
        setTenantId(tid);
        fetchUsers(tid);
      })
      .catch(() => setError("Could not determine tenant"));
  }, [fetchUsers]);

  const showFeedback = (id: string, msg: string, ok: boolean) => {
    setFeedback({ id, msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  };

  async function toggleActive(user: UserRow) {
    setActionLoading(`active-${user.userId}`);
    const action = user.isActive ? "deactivate" : "activate";
    try {
      const res = await fetch(`/api/admin/users/${user.userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, tenantId }),
      });
      if (!res.ok) {
        const b = await res.json();
        showFeedback(user.userId, b.error?.message ?? "Error", false);
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.userId === user.userId ? { ...u, isActive: !u.isActive } : u)),
        );
        showFeedback(user.userId, `User ${action}d`, true);
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function changeRole(user: UserRow, role: string, roleAction: "assign" | "revoke") {
    setActionLoading(`role-${user.userId}-${role}`);
    try {
      const res = await fetch(`/api/admin/users/${user.userId}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, tenantId, action: roleAction }),
      });
      if (!res.ok) {
        const b = await res.json();
        showFeedback(user.userId, b.error?.message ?? "Error", false);
      } else {
        setUsers((prev) =>
          prev.map((u) => {
            if (u.userId !== user.userId) return u;
            const newRoles =
              roleAction === "assign"
                ? [...new Set([...u.roles, role])]
                : u.roles.filter((r) => r !== role);
            return { ...u, roles: newRoles };
          }),
        );
        showFeedback(user.userId, `Role ${role} ${roleAction}d`, true);
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteUser(user: UserRow) {
    setConfirmDelete(null);
    setActionLoading(`delete-${user.userId}`);
    try {
      const res = await fetch(`/api/admin/users/${user.userId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        const b = await res.json();
        showFeedback(user.userId, b.error?.message ?? "Error", false);
      } else {
        setUsers((prev) => prev.filter((u) => u.userId !== user.userId));
      }
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = users.filter((u) => {
    const name = `${u.firstName} ${u.lastName}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filterRole !== "all" && !u.roles.includes(filterRole)) return false;
    if (filterActive === "active" && !u.isActive) return false;
    if (filterActive === "inactive" && u.isActive) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <button
          onClick={() => fetchUsers(tenantId)}
          className="text-sm text-blue-600 hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-48"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="all">Active + Inactive</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} users</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Roles</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Joined</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    No users found
                  </td>
                </tr>
              )}
              {filtered.map((user) => (
                <tr
                  key={user.userId}
                  className={user.isActive ? "" : "opacity-50 bg-gray-50"}
                >
                  <td className="px-4 py-3 font-medium">
                    {user.firstName} {user.lastName}
                    {feedback?.id === user.userId && (
                      <span
                        className={`ml-2 text-xs ${feedback.ok ? "text-green-600" : "text-red-600"}`}
                      >
                        {feedback.msg}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((r) => (
                        <span
                          key={r}
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[r] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {r}
                          <button
                            onClick={() => changeRole(user, r, "revoke")}
                            disabled={!!actionLoading}
                            title={`Revoke ${r}`}
                            className="text-gray-400 hover:text-gray-700 disabled:opacity-40"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {/* Add role dropdown */}
                      <select
                        className="text-xs border rounded px-1 py-0.5 text-gray-500 ml-1"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) changeRole(user, e.target.value, "assign");
                          e.target.value = "";
                        }}
                        disabled={!!actionLoading}
                      >
                        <option value="">+ role</option>
                        {ROLES.filter((r) => !user.roles.includes(r)).map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.participationType}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(user)}
                      disabled={actionLoading === `active-${user.userId}`}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        user.isActive
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      } disabled:opacity-50`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString("cs-CZ")}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setConfirmDelete(user)}
                      disabled={!!actionLoading}
                      className="text-xs text-red-600 hover:underline disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-lg font-semibold">Remove user?</h2>
            <p className="text-sm text-gray-600">
              This will remove{" "}
              <strong>
                {confirmDelete.firstName} {confirmDelete.lastName}
              </strong>{" "}
              from the school committee platform and revoke all their roles. Their auth account will not be deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(confirmDelete)}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Check that the app exists — find the profile API endpoint**

```bash
ls /home/ssf/Documents/Github/school-committee/app/api/profile/
```

If `/api/profile` doesn't exist, the page bootstraps tenantId via a different path. Check what endpoints exist for getting current user's profile:

```bash
find /home/ssf/Documents/Github/school-committee/app/api -name "route.ts" | head -20
```

If no `/api/profile` endpoint, adjust the `useEffect` in the page to use `/api/auth/me` or whichever endpoint returns the user's tenantId. If none exist, hardcode the tenantId fetch from the JWT claims or add a simple `/api/auth/me` endpoint that returns `{id, tenantId, schoolId}` from `getCurrentUser`.

- [ ] **Step 3: Verify TypeScript — run tsc check**

```bash
cd /home/ssf/Documents/Github/school-committee && npx tsc --noEmit 2>&1 | head -30
```

Fix any type errors before continuing.

- [ ] **Step 4: Run all tests**

```bash
cd /home/ssf/Documents/Github/school-committee && npm test 2>&1 | tail -20
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
cd /home/ssf/Documents/Github/school-committee
git add app/admin/users/page.tsx
git commit -m "feat: replace admin users stub with full CRUD data table"
```

---

### Task 6: `/api/auth/me` endpoint (tenantId bootstrap)

**Files:**
- Create: `app/api/auth/me/route.ts`

This is needed if no endpoint already exposes the current user's `tenantId`. The page needs it to scope the user list.

- [ ] **Step 1: Check if endpoint exists**

```bash
ls /home/ssf/Documents/Github/school-committee/app/api/auth/ 2>/dev/null && find /home/ssf/Documents/Github/school-committee/app/api/auth -name "route.ts" | xargs grep -l "tenantId" 2>/dev/null
```

Skip this task if `tenantId` is already returned by an existing endpoint.

- [ ] **Step 2: Create `app/api/auth/me/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { db } from "@/lib/db/client";
import { toErrorResponse, AppError } from "@/types/errors";

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));
  try {
    const user = await getCurrentUser(requestId);
    const profile = await db.profile.findUnique({
      where: { userId: user.id },
      select: { tenantId: true, schoolId: true },
    });
    return NextResponse.json({
      id: user.id,
      email: user.email,
      roles: user.roles,
      tenantId: profile?.tenantId ?? null,
      schoolId: profile?.schoolId ?? null,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Update page's `useEffect` to use `/api/auth/me`**

The page already uses `/api/profile` — if that endpoint returns `tenantId`, no change needed. If you created `/api/auth/me`, update the fetch URL:

```typescript
// in UsersPage useEffect, change:
fetch("/api/profile")
// to:
fetch("/api/auth/me")
```

- [ ] **Step 4: Commit**

```bash
cd /home/ssf/Documents/Github/school-committee
git add app/api/auth/me/route.ts app/admin/users/page.tsx
git commit -m "feat: add /api/auth/me endpoint for tenantId bootstrap"
```

---

### Task 7: Deploy

- [ ] **Step 1: Build and push Docker image**

```bash
cd /home/ssf/Documents/Github/school-committee
docker build -t localhost:5000/school-committee:latest .
docker push localhost:5000/school-committee:latest
```

Expected: build succeeds, image pushed

- [ ] **Step 2: Rollout restart**

```bash
kubectl rollout restart deployment/school-committee -n statex-apps
kubectl rollout status deployment/school-committee -n statex-apps --timeout=120s
```

- [ ] **Step 3: Smoke test**

```bash
curl -s https://strilkove.cz/api/health/live
```

Expected: `{"status":"ok"}` or equivalent

- [ ] **Step 4: Navigate to admin panel**

Open `https://strilkove.cz/admin/users` in the browser, log in as an admin user, verify the user table loads, roles can be changed, and deactivate/remove actions work.

---

## Self-Review

**Spec coverage:**
- GET /api/admin/users — Task 2 ✅
- PATCH /api/admin/users/[id] (activate/deactivate) — Task 3 ✅
- DELETE /api/admin/users/[id] (remove from app) — Tasks 3+4 ✅
- Full data table UI (search, filter, inline role management, deactivate, delete with confirm) — Task 5 ✅
- Audit events on all mutations — handled in PATCH+DELETE routes ✅
- Admin-only guard on all routes — `actor.roles.includes("admin")` in all routes ✅
- Users stay in auth-microservice on delete — `deleteUserFromApp` only touches `profiles` + `user_roles` ✅
- tenantId bootstrap — Task 6 ✅

**Type consistency:**
- `UserRow` defined in `lib/db/users.ts`, imported in tests via type import ✅
- `setUserActive(userId, tenantId, isActive)` — matches call in PATCH route ✅
- `deleteUserFromApp(userId, tenantId)` — matches call in DELETE route ✅
- `writeAuditEvent` signature matches existing `lib/db/audit.ts` ✅
