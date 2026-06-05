# User Onboarding & Approval Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual approval gate so every new user (parent, teacher, school_staff) must be approved by school_staff before they can perform any mutating actions in the app.

**Architecture:** Extend the Profile model with an `approvalStatus` field (`pending | approved | rejected`). Insert a new Children step into the onboarding wizard. Add an `/admin/approvals` dashboard page with approve/reject actions. Guard all mutating API routes with an approval check. Add a role-upgrade request flow for approved parents who want a teacher/staff role.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma ORM, PostgreSQL, shadcn/ui (existing), TanStack Query not used — plain fetch calls follow existing onboarding pattern.

---

## File Map

**New files:**
- `prisma/migrations/<timestamp>_add_approval_workflow/migration.sql`
- `app/api/onboarding/children/route.ts` — save children during onboarding
- `app/api/public/classes/route.ts` — public class list for dropdown
- `app/(onboarding)/children/page.tsx` — children form step
- `app/api/admin/approvals/route.ts` — list pending approvals
- `app/api/admin/approvals/[userId]/approve/route.ts` — approve user
- `app/api/admin/approvals/[userId]/reject/route.ts` — reject user
- `app/admin/approvals/page.tsx` — admin approval dashboard
- `app/api/profile/role-upgrade-request/route.ts` — submit role upgrade request
- `app/api/admin/role-requests/route.ts` — list role upgrade requests
- `app/api/admin/role-requests/[id]/approve/route.ts` — approve role upgrade
- `app/api/admin/role-requests/[id]/reject/route.ts` — reject role upgrade
- `lib/auth/require-approved.ts` — shared approval guard helper

**Modified files:**
- `prisma/schema.prisma` — add approval fields to Profile; add firstName/lastName to Child; add RoleUpgradeRequest model
- `lib/db/profiles.ts` — add approval query helpers; update upsertProfile signature
- `lib/db/users.ts` — update UserRow to include approvalStatus
- `lib/auth/get-current-user.ts` — include approvalStatus + rejectionReason in CurrentUser
- `types/auth.ts` — add approvalStatus + rejectionReason to CurrentUser
- `types/errors.ts` — add ACCOUNT_PENDING_APPROVAL error code
- `types/onboarding.ts` — add ChildInput type; remove childrenCount from OnboardingProfileRequest
- `app/api/onboarding/consent/route.ts` — set approvalStatus=pending; fire notification
- `app/api/onboarding/profile/route.ts` — remove childrenCount; update redirect hint
- `app/(onboarding)/profile/page.tsx` — remove childrenCount field; change next step to /onboarding/children
- `app/api/auth/me/route.ts` — include approvalStatus + rejectionReason in response
- `app/admin/layout.tsx` — add Approvals nav link with pending badge
- `app/api/tasks/[id]/claim/route.ts` — add approval guard
- `app/api/tasks/[id]/complete/route.ts` — add approval guard
- `app/api/tasks/[id]/verify/route.ts` — add approval guard
- `app/api/tasks/draft/route.ts` — add approval guard
- `app/api/feedback/route.ts` — add approval guard on named (non-anonymous) POST
- `app/api/payments/qr/route.ts` — add approval guard
- `app/api/account/delete-request/route.ts` — add approval guard

---

## Task 1: Schema — Profile approval fields + Child names + RoleUpgradeRequest

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_approval_workflow/migration.sql`

- [ ] **Step 1: Add approval fields to Profile model in schema.prisma**

In `prisma/schema.prisma`, replace the Profile model with:

```prisma
model Profile {
  userId             String    @id @map("user_id") @db.Uuid
  tenantId           String    @map("tenant_id") @db.Uuid
  schoolId           String    @map("school_id") @db.Uuid
  firstName          String    @map("first_name")
  lastName           String    @map("last_name")
  phone              String?
  language           String    @default("cs")
  participationType  String    @map("participation_type")
  onboardingStatus   String    @default("incomplete") @map("onboarding_status")
  approvalStatus     String    @default("pending") @map("approval_status")
  approvedBy         String?   @map("approved_by") @db.Uuid
  approvedAt         DateTime? @map("approved_at")
  rejectionReason    String?   @map("rejection_reason")
  isActive           Boolean   @default(true) @map("is_active")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @default(now()) @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])
  school School @relation(fields: [schoolId], references: [id])

  @@map("profiles")
}
```

- [ ] **Step 2: Update Child model to add firstName + lastName**

Replace the Child model in `prisma/schema.prisma`:

```prisma
model Child {
  id            String   @id @default(uuid()) @db.Uuid
  parentUserId  String   @map("parent_user_id") @db.Uuid
  schoolId      String   @map("school_id") @db.Uuid
  classId       String   @map("class_id") @db.Uuid
  firstName     String   @map("first_name")
  lastName      String   @map("last_name")
  notes         String?
  displayLabel  String?  @map("display_label")
  birthYear     Int?     @map("birth_year")
  parentConsent Boolean  @default(true) @map("parent_consent")
  createdAt     DateTime @default(now()) @map("created_at")

  school School @relation(fields: [schoolId], references: [id])
  class  Class  @relation(fields: [classId], references: [id])

  @@map("children")
}
```

- [ ] **Step 3: Add RoleUpgradeRequest model to schema.prisma**

Add after the Child model:

```prisma
model RoleUpgradeRequest {
  id              String    @id @default(uuid()) @db.Uuid
  userId          String    @map("user_id") @db.Uuid
  requestedRole   String    @map("requested_role")
  reason          String?
  status          String    @default("pending")
  reviewedBy      String?   @map("reviewed_by") @db.Uuid
  reviewedAt      DateTime? @map("reviewed_at")
  rejectionReason String?   @map("rejection_reason")
  createdAt       DateTime  @default(now()) @map("created_at")

  @@map("role_upgrade_requests")
}
```

- [ ] **Step 4: Run Prisma migration**

```bash
cd /home/ssf/Documents/Github/school-committee
npx prisma migrate dev --name add_approval_workflow
```

Expected output: migration created and applied, Prisma Client regenerated.

- [ ] **Step 5: Verify Prisma Client has the new fields**

```bash
cd /home/ssf/Documents/Github/school-committee
npx prisma studio --browser none &
# or just check the generated client
grep -n "approvalStatus\|approval_status" node_modules/.prisma/client/index.d.ts | head -10
```

Expected: `approvalStatus` field appears in the Profile type.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add approval workflow schema — Profile approval fields, Child names, RoleUpgradeRequest"
```

---

## Task 2: Types — ErrorCode, CurrentUser, ChildInput

**Files:**
- Modify: `types/errors.ts`
- Modify: `types/auth.ts`
- Modify: `types/onboarding.ts`

- [ ] **Step 1: Add ACCOUNT_PENDING_APPROVAL to ErrorCode in types/errors.ts**

In `types/errors.ts`, update the ErrorCode union (add after `"FORBIDDEN"`):

```typescript
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "EMAIL_NOT_VERIFIED"
  | "FORBIDDEN"
  | "ACCOUNT_PENDING_APPROVAL"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TASK_ALREADY_CLAIMED"
  | "PAYMENT_ALREADY_CONFIRMED"
  | "AI_DRAFT_FAILED"
  | "RATE_LIMITED"
  | "UPSTREAM_TIMEOUT"
  | "INTERNAL_ERROR";
```

- [ ] **Step 2: Add approvalStatus + rejectionReason to CurrentUser in types/auth.ts**

Replace the CurrentUser interface:

```typescript
export interface CurrentUser {
  id: string;
  email: string;
  roles: Role[];
  approvalStatus: string;
  rejectionReason: string | null;
}
```

- [ ] **Step 3: Add ChildInput type; remove childrenCount from OnboardingProfileRequest in types/onboarding.ts**

Replace the entire file content:

```typescript
export type Language = "cs" | "en" | "ru" | "uk";
export type ParticipationType = "financial" | "labor" | "mixed";

export interface OnboardingProfileRequest {
  tenantId: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  language: Language;
  participationType: ParticipationType;
}

export interface ChildInput {
  firstName: string;
  lastName: string;
  classId: string;
  notes?: string;
}

export interface OnboardingChildrenRequest {
  tenantId: string;
  schoolId: string;
  children: ChildInput[];
}

export interface ConsentRecord {
  termsAccepted: boolean;
  privacyPolicyAccepted: boolean;
  parentCommitteeParticipation: boolean;
  version: string;
  timestamp: string;
}

export interface RecordConsentRequest {
  tenantId: string;
  schoolId: string;
  consent: ConsentRecord;
}
```

- [ ] **Step 4: Commit**

```bash
git add types/errors.ts types/auth.ts types/onboarding.ts
git commit -m "feat: add approval types — ACCOUNT_PENDING_APPROVAL error code, CurrentUser approval fields, ChildInput"
```

---

## Task 3: getCurrentUser — include approvalStatus in CurrentUser

**Files:**
- Modify: `lib/auth/get-current-user.ts`

- [ ] **Step 1: Update getCurrentUser to fetch approvalStatus from Profile**

Replace the entire file:

```typescript
import { getAccessToken } from "@/lib/auth/session";
import { validateToken } from "@/lib/auth/validate-token";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db/client";
import type { CurrentUser, Role } from "@/types/auth";
import { UnauthenticatedError } from "@/types/errors";

const PLATFORM_ROLES = new Set<string>([
  "parent",
  "committee",
  "teacher",
  "school_staff",
  "admin",
]);

export async function getCurrentUser(requestId?: string): Promise<CurrentUser> {
  const token = await getAccessToken();
  if (!token) {
    throw new UnauthenticatedError("No session");
  }
  const validated = await validateToken(token, requestId);

  const [dbRoles, profile] = await Promise.all([
    db.userRole.findMany({
      where: { userId: validated.id, revokedAt: null },
      select: { role: true },
    }),
    db.profile.findUnique({
      where: { userId: validated.id },
      select: { approvalStatus: true, rejectionReason: true },
    }),
  ]);

  const roles = dbRoles
    .map((r) => r.role)
    .filter((r): r is Role => PLATFORM_ROLES.has(r));

  return {
    id: validated.id,
    email: validated.email,
    roles,
    approvalStatus: profile?.approvalStatus ?? "pending",
    rejectionReason: profile?.rejectionReason ?? null,
  };
}

export async function tryGetCurrentUser(
  requestId?: string,
): Promise<CurrentUser | null> {
  try {
    return await getCurrentUser(requestId);
  } catch (err) {
    if (!(err instanceof UnauthenticatedError)) {
      logger.error("tryGetCurrentUser: unexpected error during auth check", {
        request_id: requestId,
        error_code: "AUTH_CHECK_ERROR",
        error_message: err instanceof Error ? err.message : String(err),
        error_name: err instanceof Error ? err.name : undefined,
      });
    }
    return null;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors (or only pre-existing unrelated errors — fix any related to CurrentUser shape).

- [ ] **Step 3: Commit**

```bash
git add lib/auth/get-current-user.ts
git commit -m "feat: include approvalStatus and rejectionReason in getCurrentUser"
```

---

## Task 4: Approval guard helper + profiles db helpers

**Files:**
- Create: `lib/auth/require-approved.ts`
- Modify: `lib/db/profiles.ts`
- Modify: `lib/db/users.ts`

- [ ] **Step 1: Create lib/auth/require-approved.ts**

```typescript
import type { CurrentUser } from "@/types/auth";
import { AppError } from "@/types/errors";

export function requireApproved(user: CurrentUser): void {
  if (user.approvalStatus !== "approved") {
    throw new AppError(
      "ACCOUNT_PENDING_APPROVAL",
      "Your account is awaiting approval by school staff.",
      403,
    );
  }
}
```

- [ ] **Step 2: Update lib/db/profiles.ts — add approval helpers**

Replace the entire file:

```typescript
import type { Profile } from "@prisma/client";
import { db } from "@/lib/db/client";
import { NotFoundError } from "@/types/errors";

export async function getProfile(userId: string): Promise<Profile> {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError("Profile not found");
  return profile;
}

export async function upsertProfile(
  userId: string,
  data: Partial<Omit<Profile, "userId" | "createdAt" | "updatedAt">>,
): Promise<Profile> {
  return db.profile.upsert({
    where: { userId },
    create: {
      userId,
      tenantId: data.tenantId!,
      schoolId: data.schoolId!,
      firstName: data.firstName!,
      lastName: data.lastName!,
      phone: data.phone,
      language: data.language ?? "cs",
      participationType: data.participationType!,
      onboardingStatus: data.onboardingStatus ?? "incomplete",
      approvalStatus: data.approvalStatus ?? "pending",
    },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      language: data.language,
      participationType: data.participationType,
      onboardingStatus: data.onboardingStatus,
      approvalStatus: data.approvalStatus,
      approvedBy: data.approvedBy,
      approvedAt: data.approvedAt,
      rejectionReason: data.rejectionReason,
      isActive: data.isActive,
    },
  });
}

export async function listPendingApprovals(tenantId: string, schoolId?: string) {
  return db.profile.findMany({
    where: {
      tenantId,
      onboardingStatus: "complete",
      approvalStatus: "pending",
      ...(schoolId ? { schoolId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function countPendingApprovals(tenantId: string): Promise<number> {
  return db.profile.count({
    where: { tenantId, onboardingStatus: "complete", approvalStatus: "pending" },
  });
}
```

- [ ] **Step 3: Update lib/db/users.ts — add approvalStatus to UserRow**

Replace the UserRow interface and listUsers function:

```typescript
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
  approvalStatus: string;
  rejectionReason: string | null;
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
    approvalStatus: p.approvalStatus,
    rejectionReason: p.rejectionReason,
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

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/require-approved.ts lib/db/profiles.ts lib/db/users.ts
git commit -m "feat: add requireApproved guard helper and approval fields to profile/user db helpers"
```

---

## Task 5: Public classes API endpoint

**Files:**
- Create: `app/api/public/classes/route.ts`

- [ ] **Step 1: Create app/api/public/classes/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db/client";
import { toErrorResponse, AppError } from "@/types/errors";

const ROUTE = "/api/public/classes";

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));

  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId");

    if (!schoolId) {
      throw new AppError("VALIDATION_ERROR", "schoolId is required", 400);
    }

    const classes = await db.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, grade: true, schoolYear: true },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ classes }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error("public/classes GET: returning error response", {
        request_id: requestId,
        route: ROUTE,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error("public/classes GET: unexpected error", {
      request_id: requestId,
      route: ROUTE,
      error_code: "UNEXPECTED_ERROR",
      error_message: err instanceof Error ? err.message : String(err),
      error_name: err instanceof Error ? err.name : undefined,
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify the public/classes path is in middleware public list**

Open `middleware.ts`. Check that `/api/public/` is in the list of public paths that skip auth. If not, add it. The file should have a pattern like:

```typescript
const PUBLIC_PATHS = ["/login", "/api/auth/", "/api/public/", "/api/health/", ...];
```

- [ ] **Step 3: Commit**

```bash
git add app/api/public/classes/route.ts
git commit -m "feat: add public classes API endpoint for onboarding dropdown"
```

---

## Task 6: Onboarding children API route

**Files:**
- Create: `app/api/onboarding/children/route.ts`

- [ ] **Step 1: Create app/api/onboarding/children/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/db/audit";
import { toErrorResponse, AppError } from "@/types/errors";
import type { OnboardingChildrenRequest, ChildInput } from "@/types/onboarding";

const ROUTE = "/api/onboarding/children";

export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));

  try {
    const user = await getCurrentUser(requestId);
    const body = (await req.json()) as OnboardingChildrenRequest;

    if (!body.tenantId || !body.schoolId) {
      throw new AppError("VALIDATION_ERROR", "tenantId and schoolId are required", 400);
    }
    if (!Array.isArray(body.children) || body.children.length === 0) {
      throw new AppError("VALIDATION_ERROR", "At least one child is required", 400);
    }

    for (const child of body.children as ChildInput[]) {
      if (!child.firstName?.trim()) {
        throw new AppError("VALIDATION_ERROR", "Each child must have a firstName", 400);
      }
      if (!child.lastName?.trim()) {
        throw new AppError("VALIDATION_ERROR", "Each child must have a lastName", 400);
      }
      if (!child.classId) {
        throw new AppError("VALIDATION_ERROR", "Each child must have a classId", 400);
      }
    }

    // Delete any previously saved children for this parent (idempotent resubmit)
    await db.child.deleteMany({ where: { parentUserId: user.id } });

    const children = await db.$transaction(
      (body.children as ChildInput[]).map((child) =>
        db.child.create({
          data: {
            parentUserId: user.id,
            schoolId: body.schoolId,
            classId: child.classId,
            firstName: child.firstName.trim(),
            lastName: child.lastName.trim(),
            notes: child.notes?.trim() ?? null,
            parentConsent: true,
          },
        }),
      ),
    );

    await writeAuditEvent({
      tenantId: body.tenantId,
      schoolId: body.schoolId,
      actorUserId: user.id,
      action: "onboarding.children_saved",
      entityType: "child",
      entityId: user.id,
      metadata: { count: children.length },
      requestId,
    });

    logger.info("onboarding/children: children saved", {
      request_id: requestId,
      route: ROUTE,
      user_id: user.id,
      count: children.length,
    });

    return NextResponse.json({ children: children.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName })) }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error("onboarding/children: returning error response", {
        request_id: requestId,
        route: ROUTE,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error("onboarding/children: unexpected error", {
      request_id: requestId,
      route: ROUTE,
      error_code: "UNEXPECTED_ERROR",
      error_message: err instanceof Error ? err.message : String(err),
      error_name: err instanceof Error ? err.name : undefined,
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/onboarding/children/route.ts
git commit -m "feat: add onboarding children API route"
```

---

## Task 7: Onboarding children page (UI)

**Files:**
- Create: `app/(onboarding)/children/page.tsx`

- [ ] **Step 1: Create app/(onboarding)/children/page.tsx**

```typescript
"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";

interface ChildForm {
  firstName: string;
  lastName: string;
  classId: string;
  notes: string;
}

interface ClassOption {
  id: string;
  name: string;
  grade: string;
}

function ChildrenForm() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildForm[]>([
    { firstName: "", lastName: "", classId: "", notes: "" },
  ]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load school info from session via /api/auth/me
  const [schoolId, setSchoolId] = useState("");
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        const sid = data.user?.schoolId ?? "";
        const tid = data.user?.tenantId ?? "";
        setSchoolId(sid);
        setTenantId(tid);
        if (sid) {
          fetch(`/api/public/classes?schoolId=${sid}`)
            .then((r) => r.json())
            .then((d) => setClasses(d.classes ?? []));
        }
      });
  }, []);

  function addChild() {
    setChildren((c) => [...c, { firstName: "", lastName: "", classId: "", notes: "" }]);
  }

  function removeChild(index: number) {
    setChildren((c) => c.filter((_, i) => i !== index));
  }

  function setField(index: number, field: keyof ChildForm, value: string) {
    setChildren((c) => c.map((child, i) => (i === index ? { ...child, [field]: value } : child)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/children", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, schoolId, children }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to save children");
        return;
      }
      router.replace("/onboarding/consent");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Your children</h1>
      <p className="text-sm text-gray-500 mb-6">
        Add each child who attends the school. School staff will verify this information.
      </p>
      <form onSubmit={submit} className="space-y-6">
        {children.map((child, i) => (
          <div key={i} className="border rounded-xl p-4 space-y-3 relative">
            <p className="text-sm font-medium text-gray-700">Child {i + 1}</p>
            {children.length > 1 && (
              <button
                type="button"
                onClick={() => removeChild(i)}
                className="absolute top-3 right-3 text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">First name *</label>
                <input
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={child.firstName}
                  onChange={(e) => setField(i, "firstName", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last name *</label>
                <input
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={child.lastName}
                  onChange={(e) => setField(i, "lastName", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Class *</label>
              <select
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={child.classId}
                onChange={(e) => setField(i, "classId", e.target.value)}
              >
                <option value="">Select a class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.grade} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes (optional)</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. teacher Nováková, class 2B"
                value={child.notes}
                onChange={(e) => setField(i, "notes", e.target.value)}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addChild}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
        >
          + Add another child
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

export default function ChildrenPage() {
  return (
    <Suspense>
      <ChildrenForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(onboarding)/children/page.tsx"
git commit -m "feat: add onboarding children step UI"
```

---

## Task 8: Update onboarding profile page + profile API route

**Files:**
- Modify: `app/(onboarding)/profile/page.tsx`
- Modify: `app/api/onboarding/profile/route.ts`

- [ ] **Step 1: Update profile page — remove childrenCount, change next step to /onboarding/children**

Replace `app/(onboarding)/profile/page.tsx`:

```typescript
"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const PARTICIPATION_TYPES = [
  { value: "financial", label: "Financial contribution" },
  { value: "labor", label: "Volunteering / labour" },
  { value: "mixed", label: "Both (financial + volunteering)" },
];

function ProfileForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lang = searchParams.get("lang") ?? "cs";

  const [form, setForm] = useState({
    tenantId: "",
    schoolId: "",
    firstName: "",
    lastName: "",
    phone: "",
    participationType: "financial",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, language: lang }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error?.message ?? "Failed to save profile"); return; }
      router.replace("/onboarding/children");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Complete your profile</h1>
      <p className="text-sm text-gray-500 mb-6">Fields marked * are required.</p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">First name *</label>
            <input required className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last name *</label>
            <input required className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone (optional)</label>
          <input type="tel" className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Participation *</label>
          <select required className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.participationType} onChange={(e) => set("participationType", e.target.value)}>
            {PARTICIPATION_TYPES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="border-t pt-4 space-y-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">School info</p>
          <div>
            <label className="block text-sm font-medium mb-1">Tenant ID *</label>
            <input required className="w-full border rounded-lg px-3 py-2 text-sm font-mono text-xs"
              placeholder="uuid — provided by your school" value={form.tenantId} onChange={(e) => set("tenantId", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">School ID *</label>
            <input required className="w-full border rounded-lg px-3 py-2 text-sm font-mono text-xs"
              placeholder="uuid — provided by your school" value={form.schoolId} onChange={(e) => set("schoolId", e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-white font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Update app/api/onboarding/profile/route.ts — remove childrenCount validation**

Remove these lines from the POST handler (they reference `childrenCount` which no longer exists):

```typescript
// Remove: classId validation (classId is now set per child)
if (!body.classId) {
  throw new AppError("VALIDATION_ERROR", "classId is required", 400);
}
// Remove: childrenCount validation
if (typeof body.childrenCount !== "number" || body.childrenCount < 0) {
  throw new AppError("VALIDATION_ERROR", "childrenCount must be a non-negative number", 400);
}
```

The updated validation block should be:

```typescript
if (!body.tenantId || !body.schoolId || !body.firstName || !body.lastName) {
  throw new AppError("VALIDATION_ERROR", "firstName, lastName, tenantId, schoolId are required", 400);
}
if (!body.participationType) {
  throw new AppError("VALIDATION_ERROR", "participationType is required", 400);
}
if (!["financial", "labor", "mixed"].includes(body.participationType)) {
  throw new AppError("VALIDATION_ERROR", "participationType must be financial, labor, or mixed", 400);
}
if (!body.language) {
  throw new AppError("VALIDATION_ERROR", "language is required", 400);
}
if (!["cs", "en", "ru", "uk"].includes(body.language)) {
  throw new AppError("VALIDATION_ERROR", "language must be cs, en, ru, or uk", 400);
}
```

Also update the `upsertProfile` call — remove `classId` (no longer in profile):

```typescript
const profile = await upsertProfile(user.id, {
  tenantId: body.tenantId,
  schoolId: body.schoolId,
  firstName: body.firstName,
  lastName: body.lastName,
  phone: body.phone,
  language: body.language,
  participationType: body.participationType,
  onboardingStatus: "profile_complete",
});
```

- [ ] **Step 3: Add /onboarding/children to middleware allowed onboarding paths**

Open `middleware.ts`. Find the list of allowed onboarding paths and add `/onboarding/children`:

```typescript
const ONBOARDING_PATHS = [
  "/onboarding/profile",
  "/onboarding/children",
  "/onboarding/consent",
  "/onboarding/language",
  "/onboarding/set-password",
];
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(onboarding)/profile/page.tsx" app/api/onboarding/profile/route.ts middleware.ts
git commit -m "feat: update onboarding profile — remove childrenCount, redirect to children step"
```

---

## Task 9: Update consent route — set approvalStatus=pending, fire notification

**Files:**
- Modify: `app/api/onboarding/consent/route.ts`

- [ ] **Step 1: Update consent route to set approvalStatus=pending and notify staff**

Replace `app/api/onboarding/consent/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { upsertProfile } from "@/lib/db/profiles";
import { writeAuditEvent } from "@/lib/db/audit";
import { toErrorResponse, AppError } from "@/types/errors";
import type { RecordConsentRequest } from "@/types/onboarding";

const ROUTE = "/api/onboarding/consent";

async function notifyStaffPendingApproval(
  userId: string,
  name: string,
  email: string,
  requestId: string,
): Promise<void> {
  const notificationUrl = process.env.NOTIFICATION_SERVICE_BASE_URL;
  if (!notificationUrl) return;

  try {
    await fetch(`${notificationUrl}/api/notifications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "new_user_pending_approval",
        recipientRole: "school_staff",
        payload: { userId, name, email },
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.error("onboarding/consent: failed to notify staff", {
      request_id: requestId,
      route: ROUTE,
      error_message: err instanceof Error ? err.message : String(err),
    });
    // Non-fatal — approval can still happen manually
  }
}

export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));

  try {
    const user = await getCurrentUser(requestId);

    const body = (await req.json()) as RecordConsentRequest;

    if (!body.tenantId || !body.schoolId) {
      throw new AppError("VALIDATION_ERROR", "tenantId and schoolId are required", 400);
    }

    const { consent } = body;

    if (!consent) {
      throw new AppError("VALIDATION_ERROR", "consent is required", 400);
    }
    if (!consent.termsAccepted) {
      throw new AppError("VALIDATION_ERROR", "Terms must be accepted", 400);
    }
    if (!consent.privacyPolicyAccepted) {
      throw new AppError("VALIDATION_ERROR", "Privacy policy must be accepted", 400);
    }
    if (!consent.parentCommitteeParticipation) {
      throw new AppError("VALIDATION_ERROR", "Parent committee participation consent is required", 400);
    }
    if (!consent.version) {
      throw new AppError("VALIDATION_ERROR", "Consent version is required", 400);
    }

    const timestamp = new Date().toISOString();

    await writeAuditEvent({
      tenantId: body.tenantId,
      schoolId: body.schoolId,
      actorUserId: user.id,
      action: "onboarding.consent_recorded",
      entityType: "profile",
      entityId: user.id,
      metadata: {
        termsAccepted: consent.termsAccepted,
        privacyPolicyAccepted: consent.privacyPolicyAccepted,
        parentCommitteeParticipation: consent.parentCommitteeParticipation,
        version: consent.version,
        timestamp,
      },
      requestId,
    });

    await upsertProfile(user.id, {
      tenantId: body.tenantId,
      schoolId: body.schoolId,
      onboardingStatus: "complete",
      approvalStatus: "pending",
    });

    // Fire-and-forget notification to school_staff
    void notifyStaffPendingApproval(
      user.id,
      user.email,
      user.email,
      requestId,
    );

    logger.info("onboarding/consent: consent recorded, approval pending", {
      request_id: requestId,
      route: ROUTE,
      user_id: user.id,
    });

    return NextResponse.json({ recorded: true, timestamp, approvalStatus: "pending" }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error("onboarding/consent: returning error response", {
        request_id: requestId,
        route: ROUTE,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error("onboarding/consent: unexpected error", {
      request_id: requestId,
      route: ROUTE,
      error_code: "UNEXPECTED_ERROR",
      error_message: err instanceof Error ? err.message : String(err),
      error_name: err instanceof Error ? err.name : undefined,
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add app/api/onboarding/consent/route.ts
git commit -m "feat: set approvalStatus=pending on consent completion, notify school_staff"
```

---

## Task 10: Update /api/auth/me to include approvalStatus

**Files:**
- Modify: `app/api/auth/me/route.ts`

- [ ] **Step 1: Update /api/auth/me to return approvalStatus and rejectionReason**

Replace `app/api/auth/me/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db/client";
import { toErrorResponse, AppError } from "@/types/errors";

const ROUTE = "/api/auth/me";

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));

  try {
    const user = await getCurrentUser(requestId);
    const profile = await db.profile.findUnique({
      where: { userId: user.id },
      select: { tenantId: true, schoolId: true, approvalStatus: true, rejectionReason: true },
    });
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        tenantId: profile?.tenantId ?? null,
        schoolId: profile?.schoolId ?? null,
        approvalStatus: profile?.approvalStatus ?? "pending",
        rejectionReason: profile?.rejectionReason ?? null,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error("me: returning error response", {
        request_id: requestId,
        route: ROUTE,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error("me: unexpected error", {
      request_id: requestId,
      route: ROUTE,
      error_code: "UNEXPECTED_ERROR",
      error_message: err instanceof Error ? err.message : String(err),
      error_name: err instanceof Error ? err.name : undefined,
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/auth/me/route.ts
git commit -m "feat: include approvalStatus and rejectionReason in /api/auth/me response"
```

---

## Task 11: Admin approvals API routes

**Files:**
- Create: `app/api/admin/approvals/route.ts`
- Create: `app/api/admin/approvals/[userId]/approve/route.ts`
- Create: `app/api/admin/approvals/[userId]/reject/route.ts`

- [ ] **Step 1: Create app/api/admin/approvals/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db/client";
import { toErrorResponse, AppError } from "@/types/errors";
import { requireRole } from "@/lib/auth/require-role";

const ROUTE = "/api/admin/approvals";

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));

  try {
    const actor = await getCurrentUser(requestId);
    requireRole(actor, ["school_staff", "admin"]);

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId");
    const schoolId = searchParams.get("schoolId") ?? undefined;
    const statusFilter = searchParams.get("status") ?? "pending";

    if (!tenantId) {
      throw new AppError("VALIDATION_ERROR", "tenantId is required", 400);
    }

    const profiles = await db.profile.findMany({
      where: {
        tenantId,
        onboardingStatus: "complete",
        approvalStatus: statusFilter,
        ...(schoolId ? { schoolId } : {}),
      },
      orderBy: { createdAt: "asc" },
    });

    const userIds = profiles.map((p) => p.userId);

    const childrenByUser = await db.child.findMany({
      where: { parentUserId: { in: userIds } },
      include: { class: { select: { name: true, grade: true } } },
    });

    const childrenMap = new Map<string, typeof childrenByUser>();
    for (const child of childrenByUser) {
      const existing = childrenMap.get(child.parentUserId) ?? [];
      existing.push(child);
      childrenMap.set(child.parentUserId, existing);
    }

    const users = profiles.map((p) => ({
      userId: p.userId,
      firstName: p.firstName,
      lastName: p.lastName,
      schoolId: p.schoolId,
      approvalStatus: p.approvalStatus,
      rejectionReason: p.rejectionReason,
      approvedBy: p.approvedBy,
      approvedAt: p.approvedAt,
      createdAt: p.createdAt,
      children: (childrenMap.get(p.userId) ?? []).map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        className: c.class.name,
        grade: c.class.grade,
        notes: c.notes,
      })),
    }));

    return NextResponse.json({ users }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error("admin/approvals GET: error", {
        request_id: requestId,
        route: ROUTE,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error("admin/approvals GET: unexpected error", {
      request_id: requestId,
      route: ROUTE,
      error_code: "UNEXPECTED_ERROR",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Create app/api/admin/approvals/[userId]/approve/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/db/audit";
import { toErrorResponse, AppError } from "@/types/errors";
import { requireRole } from "@/lib/auth/require-role";

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));
  const { userId: targetUserId } = await params;
  const ROUTE = `/api/admin/approvals/${targetUserId}/approve`;

  try {
    const actor = await getCurrentUser(requestId);
    requireRole(actor, ["school_staff", "admin"]);

    const body = await req.json() as { tenantId?: string; schoolId?: string };
    if (!body.tenantId) {
      throw new AppError("VALIDATION_ERROR", "tenantId is required", 400);
    }

    const profile = await db.profile.findUnique({ where: { userId: targetUserId } });
    if (!profile) {
      throw new AppError("NOT_FOUND", "User profile not found", 404);
    }
    if (profile.approvalStatus === "approved") {
      throw new AppError("CONFLICT", "User is already approved", 409);
    }

    await db.$transaction(async (tx) => {
      await tx.profile.update({
        where: { userId: targetUserId },
        data: {
          approvalStatus: "approved",
          approvedBy: actor.id,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });

      // Assign parent role if not already assigned
      const existingRole = await tx.userRole.findFirst({
        where: { userId: targetUserId, tenantId: body.tenantId!, role: "parent", revokedAt: null },
      });
      if (!existingRole) {
        await tx.userRole.create({
          data: {
            userId: targetUserId,
            tenantId: body.tenantId!,
            schoolId: body.schoolId ?? profile.schoolId,
            role: "parent",
            assignedBy: actor.id,
          },
        });
      }

      await writeAuditEvent(
        {
          tenantId: body.tenantId!,
          schoolId: body.schoolId ?? profile.schoolId,
          actorUserId: actor.id,
          action: "user_approved",
          entityType: "profile",
          entityId: targetUserId,
          requestId,
        },
        tx,
      );
    });

    // Notify user (fire-and-forget)
    const notificationUrl = process.env.NOTIFICATION_SERVICE_BASE_URL;
    if (notificationUrl) {
      fetch(`${notificationUrl}/api/notifications`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "user_approval_approved",
          recipientUserId: targetUserId,
          payload: {},
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined);
    }

    logger.info("admin/approvals/approve: user approved", {
      request_id: requestId,
      route: ROUTE,
      target_user_id: targetUserId,
      actor_id: actor.id,
    });

    return NextResponse.json({ success: true, approvalStatus: "approved" }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error("admin/approvals/approve: error", {
        request_id: requestId,
        route: ROUTE,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error("admin/approvals/approve: unexpected error", {
      request_id: requestId,
      route: ROUTE,
      error_code: "UNEXPECTED_ERROR",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Create app/api/admin/approvals/[userId]/reject/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/db/audit";
import { toErrorResponse, AppError } from "@/types/errors";
import { requireRole } from "@/lib/auth/require-role";

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));
  const { userId: targetUserId } = await params;
  const ROUTE = `/api/admin/approvals/${targetUserId}/reject`;

  try {
    const actor = await getCurrentUser(requestId);
    requireRole(actor, ["school_staff", "admin"]);

    const body = await req.json() as { tenantId?: string; schoolId?: string; reason?: string };
    if (!body.tenantId) {
      throw new AppError("VALIDATION_ERROR", "tenantId is required", 400);
    }
    if (!body.reason?.trim()) {
      throw new AppError("VALIDATION_ERROR", "A rejection reason is required", 400);
    }

    const profile = await db.profile.findUnique({ where: { userId: targetUserId } });
    if (!profile) {
      throw new AppError("NOT_FOUND", "User profile not found", 404);
    }

    await db.$transaction(async (tx) => {
      await tx.profile.update({
        where: { userId: targetUserId },
        data: {
          approvalStatus: "rejected",
          rejectionReason: body.reason!.trim(),
        },
      });

      await writeAuditEvent(
        {
          tenantId: body.tenantId!,
          schoolId: body.schoolId ?? profile.schoolId,
          actorUserId: actor.id,
          action: "user_rejected",
          entityType: "profile",
          entityId: targetUserId,
          metadata: { reason: body.reason },
          requestId,
        },
        tx,
      );
    });

    // Notify user (fire-and-forget)
    const notificationUrl = process.env.NOTIFICATION_SERVICE_BASE_URL;
    if (notificationUrl) {
      fetch(`${notificationUrl}/api/notifications`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "user_approval_rejected",
          recipientUserId: targetUserId,
          payload: { reason: body.reason },
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined);
    }

    logger.info("admin/approvals/reject: user rejected", {
      request_id: requestId,
      route: ROUTE,
      target_user_id: targetUserId,
      actor_id: actor.id,
    });

    return NextResponse.json({ success: true, approvalStatus: "rejected" }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error("admin/approvals/reject: error", {
        request_id: requestId,
        route: ROUTE,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error("admin/approvals/reject: unexpected error", {
      request_id: requestId,
      route: ROUTE,
      error_code: "UNEXPECTED_ERROR",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/approvals/
git commit -m "feat: add admin approvals API — list, approve, reject"
```

---

## Task 12: Admin approvals UI page + sidebar badge

**Files:**
- Create: `app/admin/approvals/page.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Create app/admin/approvals/page.tsx**

```typescript
"use client";
import { useState, useEffect } from "react";

interface ChildSummary {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  grade: string;
  notes: string | null;
}

interface PendingUser {
  userId: string;
  firstName: string;
  lastName: string;
  schoolId: string;
  approvalStatus: string;
  rejectionReason: string | null;
  createdAt: string;
  children: ChildSummary[];
}

export default function ApprovalsPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PendingUser | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectModal, setRejectModal] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const tid = d.user?.tenantId ?? "";
        setTenantId(tid);
        return tid;
      })
      .then((tid) => {
        if (!tid) return;
        setLoading(true);
        return fetch(`/api/admin/approvals?tenantId=${tid}&status=${tab === "pending" ? "pending" : ""}`)
          .then((r) => r.json())
          .then((d) => setUsers(d.users ?? []))
          .finally(() => setLoading(false));
      });
  }, [tab]);

  async function approve(userId: string) {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/approvals/${userId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error?.message ?? "Failed to approve");
        return;
      }
      setUsers((u) => u.filter((user) => user.userId !== userId));
      setSelected(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function reject(userId: string) {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/approvals/${userId}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, reason: rejectReason }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error?.message ?? "Failed to reject");
        return;
      }
      setUsers((u) => u.filter((user) => user.userId !== userId));
      setSelected(null);
      setRejectModal(false);
      setRejectReason("");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">User Approvals</h1>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "pending" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
        >
          Pending
        </button>
        <button
          onClick={() => setTab("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
        >
          All Users
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-gray-500 text-sm">No users found.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Registered</th>
              <th className="py-2 pr-4">Children</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.userId}
                className="border-b hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelected(u)}
              >
                <td className="py-2 pr-4 font-medium">{u.firstName} {u.lastName}</td>
                <td className="py-2 pr-4 text-gray-500">{new Date(u.createdAt).toLocaleDateString("cs-CZ")}</td>
                <td className="py-2 pr-4">{u.children.length}</td>
                <td className="py-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {u.approvalStatus === "pending" && (
                    <>
                      <button
                        onClick={() => approve(u.userId)}
                        disabled={actionLoading}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => { setSelected(u); setRejectModal(true); }}
                        disabled={actionLoading}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {u.approvalStatus !== "pending" && (
                    <span className={`text-xs font-medium ${u.approvalStatus === "approved" ? "text-green-600" : "text-red-600"}`}>
                      {u.approvalStatus}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* Detail panel */}
      {selected && !rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{selected.firstName} {selected.lastName}</h2>
            <p className="text-sm text-gray-500">Registered: {new Date(selected.createdAt).toLocaleDateString("cs-CZ")}</p>
            <div>
              <p className="text-sm font-medium mb-2">Children:</p>
              {selected.children.length === 0 ? (
                <p className="text-sm text-gray-400">No children listed.</p>
              ) : (
                <ul className="space-y-1">
                  {selected.children.map((c) => (
                    <li key={c.id} className="text-sm border rounded p-2">
                      <span className="font-medium">{c.firstName} {c.lastName}</span>{" "}
                      <span className="text-gray-500">— {c.grade} {c.className}</span>
                      {c.notes && <span className="text-gray-400 text-xs block">{c.notes}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selected.approvalStatus === "pending" && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => approve(selected.userId)}
                  disabled={actionLoading}
                  className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => setRejectModal(true)}
                  disabled={actionLoading}
                  className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold">Reject {selected.firstName} {selected.lastName}</h2>
            <p className="text-sm text-gray-500">Please provide a reason that will be shown to the user.</p>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm h-24 resize-none"
              placeholder="e.g. We could not verify your child's enrollment. Please contact the school office."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setRejectModal(false); setRejectReason(""); }}
                className="flex-1 py-2 border rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => reject(selected.userId)}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update app/admin/layout.tsx — add Approvals nav link**

Replace `app/admin/layout.tsx`:

```typescript
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-900 text-white p-4 space-y-2">
        <h2 className="text-lg font-bold mb-4">Admin</h2>
        <nav className="space-y-1">
          <a href="/admin/approvals" className="block rounded px-3 py-2 hover:bg-gray-700">Approvals</a>
          <a href="/admin/users" className="block rounded px-3 py-2 hover:bg-gray-700">Users</a>
          <a href="/admin/tasks" className="block rounded px-3 py-2 hover:bg-gray-700">Tasks</a>
          <a href="/admin/payments" className="block rounded px-3 py-2 hover:bg-gray-700">Payments</a>
          <a href="/admin/expenses" className="block rounded px-3 py-2 hover:bg-gray-700">Expenses</a>
          <a href="/admin/feedback" className="block rounded px-3 py-2 hover:bg-gray-700">Feedback</a>
          <a href="/admin/exports" className="block rounded px-3 py-2 hover:bg-gray-700">Exports</a>
        </nav>
        <div className="pt-4 mt-4 border-t border-gray-700">
          <a href="/dashboard" className="block rounded px-3 py-2 text-gray-400 hover:bg-gray-700 hover:text-white text-sm">← Dashboard</a>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/approvals/page.tsx app/admin/layout.tsx
git commit -m "feat: add admin approvals dashboard and nav link"
```

---

## Task 13: Guard mutating API routes with approval check

**Files:**
- Modify: `app/api/tasks/[id]/claim/route.ts`
- Modify: `app/api/tasks/[id]/complete/route.ts`
- Modify: `app/api/tasks/[id]/verify/route.ts`
- Modify: `app/api/tasks/draft/route.ts`
- Modify: `app/api/payments/qr/route.ts`
- Modify: `app/api/account/delete-request/route.ts`

The pattern is identical for each route: import `requireApproved` and call it right after `getCurrentUser`. The feedback route is intentionally excluded since it supports anonymous public submissions.

- [ ] **Step 1: Add approval guard to app/api/tasks/[id]/claim/route.ts**

Add the import at the top of the file (after existing imports):
```typescript
import { requireApproved } from "@/lib/auth/require-approved";
```

Add after `const user = await getCurrentUser(requestId);`:
```typescript
requireApproved(user);
```

- [ ] **Step 2: Add approval guard to app/api/tasks/[id]/complete/route.ts**

Add the import:
```typescript
import { requireApproved } from "@/lib/auth/require-approved";
```

Add after `const user = await getCurrentUser(requestId);`:
```typescript
requireApproved(user);
```

- [ ] **Step 3: Add approval guard to app/api/tasks/[id]/verify/route.ts**

Add the import:
```typescript
import { requireApproved } from "@/lib/auth/require-approved";
```

Add after `const user = await getCurrentUser(requestId);`:
```typescript
requireApproved(user);
```

- [ ] **Step 4: Add approval guard to app/api/tasks/draft/route.ts**

Add the import:
```typescript
import { requireApproved } from "@/lib/auth/require-approved";
```

Add after `const user = await getCurrentUser(requestId);` in the POST handler:
```typescript
requireApproved(user);
```

- [ ] **Step 5: Add approval guard to app/api/payments/qr/route.ts**

Add the import:
```typescript
import { requireApproved } from "@/lib/auth/require-approved";
```

Add after `const user = await getCurrentUser(requestId);`:
```typescript
requireApproved(user);
```

- [ ] **Step 6: Add approval guard to app/api/account/delete-request/route.ts**

Add the import:
```typescript
import { requireApproved } from "@/lib/auth/require-approved";
```

Add after `const user = await getCurrentUser(requestId);`:
```typescript
requireApproved(user);
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors.

- [ ] **Step 8: Commit**

```bash
git add app/api/tasks/ app/api/payments/qr/route.ts app/api/account/
git commit -m "feat: guard all mutating routes with requireApproved check"
```

---

## Task 14: Role upgrade request API routes

**Files:**
- Create: `app/api/profile/role-upgrade-request/route.ts`
- Create: `app/api/admin/role-requests/route.ts`
- Create: `app/api/admin/role-requests/[id]/approve/route.ts`
- Create: `app/api/admin/role-requests/[id]/reject/route.ts`

- [ ] **Step 1: Create app/api/profile/role-upgrade-request/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/db/audit";
import { toErrorResponse, AppError } from "@/types/errors";
import { requireApproved } from "@/lib/auth/require-approved";

const ROUTE = "/api/profile/role-upgrade-request";
const ALLOWED_UPGRADE_ROLES = ["teacher", "school_staff"];

export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));

  try {
    const user = await getCurrentUser(requestId);
    requireApproved(user);

    const body = await req.json() as { requestedRole?: string; reason?: string; tenantId?: string; schoolId?: string };

    if (!body.requestedRole || !ALLOWED_UPGRADE_ROLES.includes(body.requestedRole)) {
      throw new AppError("VALIDATION_ERROR", `requestedRole must be one of: ${ALLOWED_UPGRADE_ROLES.join(", ")}`, 400);
    }
    if (!body.tenantId) {
      throw new AppError("VALIDATION_ERROR", "tenantId is required", 400);
    }

    // Block duplicate pending request
    const existing = await db.roleUpgradeRequest.findFirst({
      where: { userId: user.id, requestedRole: body.requestedRole, status: "pending" },
    });
    if (existing) {
      throw new AppError("CONFLICT", "A pending request for this role already exists", 409);
    }

    const request = await db.roleUpgradeRequest.create({
      data: {
        userId: user.id,
        requestedRole: body.requestedRole,
        reason: body.reason?.trim() ?? null,
        status: "pending",
      },
    });

    await writeAuditEvent({
      tenantId: body.tenantId,
      schoolId: body.schoolId,
      actorUserId: user.id,
      action: "role_upgrade_requested",
      entityType: "role_upgrade_request",
      entityId: request.id,
      metadata: { requestedRole: body.requestedRole },
      requestId,
    });

    // Notify staff (fire-and-forget)
    const notificationUrl = process.env.NOTIFICATION_SERVICE_BASE_URL;
    if (notificationUrl) {
      fetch(`${notificationUrl}/api/notifications`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "role_upgrade_requested",
          recipientRole: "school_staff",
          payload: { userId: user.id, requestedRole: body.requestedRole },
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined);
    }

    logger.info("profile/role-upgrade-request: request created", {
      request_id: requestId,
      route: ROUTE,
      user_id: user.id,
      requested_role: body.requestedRole,
    });

    return NextResponse.json({ id: request.id, status: "pending" }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error("profile/role-upgrade-request: error", {
        request_id: requestId,
        route: ROUTE,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error("profile/role-upgrade-request: unexpected error", {
      request_id: requestId,
      route: ROUTE,
      error_code: "UNEXPECTED_ERROR",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Create app/api/admin/role-requests/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db/client";
import { toErrorResponse, AppError } from "@/types/errors";
import { requireRole } from "@/lib/auth/require-role";

const ROUTE = "/api/admin/role-requests";

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));

  try {
    const actor = await getCurrentUser(requestId);
    requireRole(actor, ["school_staff", "admin"]);

    const statusFilter = new URL(req.url).searchParams.get("status") ?? "pending";

    const requests = await db.roleUpgradeRequest.findMany({
      where: { status: statusFilter },
      orderBy: { createdAt: "asc" },
    });

    // Enrich with profile names
    const userIds = requests.map((r) => r.userId);
    const profiles = await db.profile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, firstName: true, lastName: true },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    const enriched = requests.map((r) => ({
      ...r,
      firstName: profileMap.get(r.userId)?.firstName ?? "",
      lastName: profileMap.get(r.userId)?.lastName ?? "",
    }));

    return NextResponse.json({ requests: enriched }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error("admin/role-requests GET: error", {
        request_id: requestId,
        route: ROUTE,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error("admin/role-requests GET: unexpected error", {
      request_id: requestId,
      route: ROUTE,
      error_code: "UNEXPECTED_ERROR",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Create app/api/admin/role-requests/[id]/approve/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/db/audit";
import { toErrorResponse, AppError } from "@/types/errors";
import { requireRole } from "@/lib/auth/require-role";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));
  const { id } = await params;
  const ROUTE = `/api/admin/role-requests/${id}/approve`;

  try {
    const actor = await getCurrentUser(requestId);
    requireRole(actor, ["school_staff", "admin"]);

    const body = await req.json() as { tenantId?: string; schoolId?: string };
    if (!body.tenantId) {
      throw new AppError("VALIDATION_ERROR", "tenantId is required", 400);
    }

    const upgradeRequest = await db.roleUpgradeRequest.findUnique({ where: { id } });
    if (!upgradeRequest) {
      throw new AppError("NOT_FOUND", "Role upgrade request not found", 404);
    }
    if (upgradeRequest.status !== "pending") {
      throw new AppError("CONFLICT", "Request is no longer pending", 409);
    }

    await db.$transaction(async (tx) => {
      await tx.roleUpgradeRequest.update({
        where: { id },
        data: { status: "approved", reviewedBy: actor.id, reviewedAt: new Date() },
      });

      const existingRole = await tx.userRole.findFirst({
        where: { userId: upgradeRequest.userId, tenantId: body.tenantId!, role: upgradeRequest.requestedRole, revokedAt: null },
      });
      if (!existingRole) {
        await tx.userRole.create({
          data: {
            userId: upgradeRequest.userId,
            tenantId: body.tenantId!,
            schoolId: body.schoolId ?? null,
            role: upgradeRequest.requestedRole,
            assignedBy: actor.id,
          },
        });
      }

      await writeAuditEvent(
        {
          tenantId: body.tenantId!,
          schoolId: body.schoolId,
          actorUserId: actor.id,
          action: "role_upgrade_approved",
          entityType: "role_upgrade_request",
          entityId: id,
          metadata: { requestedRole: upgradeRequest.requestedRole, targetUserId: upgradeRequest.userId },
          requestId,
        },
        tx,
      );
    });

    logger.info("admin/role-requests/approve: approved", {
      request_id: requestId,
      route: ROUTE,
      request_id_field: id,
      actor_id: actor.id,
    });

    return NextResponse.json({ success: true, status: "approved" }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error("admin/role-requests/approve: error", {
        request_id: requestId,
        route: ROUTE,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error("admin/role-requests/approve: unexpected error", {
      request_id: requestId,
      route: ROUTE,
      error_code: "UNEXPECTED_ERROR",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Create app/api/admin/role-requests/[id]/reject/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/db/audit";
import { toErrorResponse, AppError } from "@/types/errors";
import { requireRole } from "@/lib/auth/require-role";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));
  const { id } = await params;
  const ROUTE = `/api/admin/role-requests/${id}/reject`;

  try {
    const actor = await getCurrentUser(requestId);
    requireRole(actor, ["school_staff", "admin"]);

    const body = await req.json() as { tenantId?: string; schoolId?: string; reason?: string };
    if (!body.tenantId) {
      throw new AppError("VALIDATION_ERROR", "tenantId is required", 400);
    }
    if (!body.reason?.trim()) {
      throw new AppError("VALIDATION_ERROR", "A rejection reason is required", 400);
    }

    const upgradeRequest = await db.roleUpgradeRequest.findUnique({ where: { id } });
    if (!upgradeRequest) {
      throw new AppError("NOT_FOUND", "Role upgrade request not found", 404);
    }
    if (upgradeRequest.status !== "pending") {
      throw new AppError("CONFLICT", "Request is no longer pending", 409);
    }

    await db.$transaction(async (tx) => {
      await tx.roleUpgradeRequest.update({
        where: { id },
        data: {
          status: "rejected",
          reviewedBy: actor.id,
          reviewedAt: new Date(),
          rejectionReason: body.reason!.trim(),
        },
      });

      await writeAuditEvent(
        {
          tenantId: body.tenantId!,
          schoolId: body.schoolId,
          actorUserId: actor.id,
          action: "role_upgrade_rejected",
          entityType: "role_upgrade_request",
          entityId: id,
          metadata: { reason: body.reason, targetUserId: upgradeRequest.userId },
          requestId,
        },
        tx,
      );
    });

    logger.info("admin/role-requests/reject: rejected", {
      request_id: requestId,
      route: ROUTE,
      request_id_field: id,
      actor_id: actor.id,
    });

    return NextResponse.json({ success: true, status: "rejected" }, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      logger.error("admin/role-requests/reject: error", {
        request_id: requestId,
        route: ROUTE,
        error_code: err.code,
        status_code: err.statusCode,
        error_message: err.message,
      });
      return NextResponse.json(toErrorResponse(err, requestId), { status: err.statusCode });
    }
    logger.error("admin/role-requests/reject: unexpected error", {
      request_id: requestId,
      route: ROUTE,
      error_code: "UNEXPECTED_ERROR",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      toErrorResponse(new AppError("INTERNAL_ERROR", "Unexpected error", 500), requestId),
      { status: 500 },
    );
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/profile/role-upgrade-request/ app/api/admin/role-requests/
git commit -m "feat: add role upgrade request API routes — submit, list, approve, reject"
```

---

## Task 15: End-to-end verification

- [ ] **Step 1: Confirm migration applied**

```bash
cd /home/ssf/Documents/Github/school-committee
npx prisma migrate status
```

Expected: all migrations applied, no pending migrations.

- [ ] **Step 2: Full TypeScript build**

```bash
cd /home/ssf/Documents/Github/school-committee
npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 3: Start dev server**

```bash
cd /home/ssf/Documents/Github/school-committee
npm run dev
```

- [ ] **Step 4: Verify onboarding flow**

1. Open `http://localhost:3000` (or appropriate dev port)
2. Login via magic link
3. Complete language → profile → **children step** (new) → consent → set-password
4. Confirm redirect to dashboard

- [ ] **Step 5: Verify approval pending state in DB**

```bash
npx prisma studio
# or run directly:
psql "postgresql://dbadmin:<password>@db-server-postgres.statex-apps.svc.cluster.local:5432/school_committee_platform" \
  -c "SELECT user_id, onboarding_status, approval_status FROM profiles ORDER BY created_at DESC LIMIT 5;"
```

Expected: `onboarding_status = 'complete'`, `approval_status = 'pending'`

- [ ] **Step 6: Verify mutating route is blocked**

```bash
curl -X POST http://localhost:3000/api/tasks/<task-id>/claim \
  -H "Cookie: scp_access=<valid_token_for_pending_user>" \
  -H "content-type: application/json" \
  -d '{"tenantId":"...","schoolId":"..."}'
```

Expected: `403` with `{ "error": { "code": "ACCOUNT_PENDING_APPROVAL", ... } }`

- [ ] **Step 7: Verify admin approvals page**

1. Login as school_staff user
2. Visit `http://localhost:3000/admin/approvals`
3. Confirm pending user appears in the list
4. Click Approve — confirm user disappears from pending list
5. Verify in DB: `approval_status = 'approved'`, `approved_by` is set, `user_roles` has `parent` row

- [ ] **Step 8: Verify approved user can perform actions**

Login as the newly approved user, attempt to claim a task. Expected: 200 OK.

- [ ] **Step 9: Test rejection flow**

1. Create a new user, complete onboarding
2. In admin, reject with a reason
3. Verify in DB: `approval_status = 'rejected'`, `rejection_reason` set
4. Call `GET /api/auth/me` as that user — confirm `rejectionReason` in response

- [ ] **Step 10: Final commit check**

```bash
git log --oneline -15
```

Confirm all tasks have their own commit. No untracked files remaining.

---

## Spec Coverage Self-Review

| Spec Requirement | Task |
|---|---|
| approvalStatus / approvedBy / approvedAt / rejectionReason on Profile | Task 1 |
| Child firstName + lastName fields | Task 1 |
| RoleUpgradeRequest table | Task 1 |
| ACCOUNT_PENDING_APPROVAL error code | Task 2 |
| CurrentUser includes approvalStatus | Tasks 2, 3 |
| requireApproved guard helper | Task 4 |
| Profile helpers for approval queries | Task 4 |
| GET /api/public/classes | Task 5 |
| POST /api/onboarding/children | Task 6 |
| Children UI step in onboarding | Task 7 |
| Profile page removes childrenCount, redirects to /onboarding/children | Task 8 |
| /onboarding/children in middleware allowed paths | Task 8 |
| Consent sets approvalStatus=pending, fires notification | Task 9 |
| /api/auth/me includes approvalStatus + rejectionReason | Task 10 |
| GET /api/admin/approvals (with children enrichment) | Task 11 |
| POST /api/admin/approvals/{userId}/approve (assigns parent role, audit) | Task 11 |
| POST /api/admin/approvals/{userId}/reject (stores reason, audit) | Task 11 |
| Admin approvals dashboard UI | Task 12 |
| Admin sidebar Approvals link | Task 12 |
| Approval guard on: task claim, complete, verify, draft, payments qr, account delete | Task 13 |
| POST /api/profile/role-upgrade-request | Task 14 |
| GET /api/admin/role-requests | Task 14 |
| POST /api/admin/role-requests/{id}/approve | Task 14 |
| POST /api/admin/role-requests/{id}/reject | Task 14 |
| Audit events for all approval/rejection/upgrade actions | Tasks 11, 14 |
| Notifications fired for approval, rejection, role upgrade | Tasks 9, 11, 14 |
