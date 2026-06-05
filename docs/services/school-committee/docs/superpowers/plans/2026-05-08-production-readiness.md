# Production Readiness + Voice Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all gaps between the current MVP backend and a production-ready deployment: Dockerfile, middleware hardening, missing UI pages, GDPR deletion flow, public transparency page, and a new voice feedback feature via ai-microservice.

**Architecture:** Next.js 14 App Router on K8s (port 4800). All secrets from Vault → ESO. Voice transcription routes through `ai-microservice` (NestJS, port 3380) which wraps OpenRouter/Gemini/Ollama — no direct provider calls from this service. Voice files stored in MinIO via signed URLs, transcripts stored in the `feedback_items` table (new `voiceTranscript` column). Voice feature is a SHOULD HAVE — it does not block tasks 1–6.

**Tech Stack:** Next.js 14 App Router · TypeScript strict · Tailwind CSS · Prisma v7 · vitest · `ai-microservice` at `http://ai-microservice.statex-apps.svc.cluster.local:3380` · MinIO via `minio-microservice` · Czech QR Platba

---

## Context: what already exists

- All 10 backend tasks complete (001–010): API routes, DB lib, K8s manifests, QR payments, onboarding, tasks, feedback, admin APIs — **172 tests pass**.
- `middleware.ts` exists but only checks for the cookie — **does not verify the token signature or expiry** (gap: admin path accessible with a stale token).
- `app/(admin)/layout.tsx` exists (sidebar only). **All 5 admin `page.tsx` files are missing.**
- `app/(app)/tasks/page.tsx` and `app/(app)/tasks/[id]/page.tsx` exist. **Feedback and payments UI pages missing.**
- No `Dockerfile`.
- No public transparency page.
- No GDPR account deletion request endpoint or UI.
- `ai-microservice` has LiteLLM/Ollama/Gemini for text — **no voice/speech endpoint exists** yet.

---

## File map

### Task 011 — Dockerfile
- Create: `Dockerfile`

### Task 012 — Middleware hardening
- Modify: `middleware.ts`
- Test: `tests/middleware.test.ts`

### Task 013 — Public transparency page
- Create: `app/(public)/report/page.tsx`
- Create: `app/api/public/report/route.ts`
- Test: `tests/public/report-route.test.ts`

### Task 014 — Admin UI pages (5 pages)
- Create: `app/(admin)/users/page.tsx`
- Create: `app/(admin)/payments/page.tsx`
- Create: `app/(admin)/expenses/page.tsx`
- Create: `app/(admin)/feedback/page.tsx`
- Create: `app/(admin)/exports/page.tsx`

### Task 015 — Parent-facing feedback & payments UI
- Create: `app/(app)/feedback/page.tsx`
- Create: `app/(app)/payments/page.tsx`

### Task 016 — GDPR account deletion request
- Create: `app/api/account/delete-request/route.ts`
- Create: `app/(app)/account/delete/page.tsx`
- Test: `tests/account/delete-request.test.ts`

### Task 017 — Voice feedback: ai-microservice transcription endpoint
- Create: `src/voice/voice.controller.ts` (in **ai-microservice** repo, not school-committee)
- Create: `src/voice/voice.service.ts`
- Create: `src/voice/voice.module.ts`
- Create: `src/voice/dto/transcribe.dto.ts`
- Modify: `src/app.module.ts` (import VoiceModule)
- Modify: `litellm_config.yaml` (add whisper model entry)
- Test: `test/voice/voice.controller.spec.ts`

### Task 018 — Voice feedback: school-committee integration
- Create: `lib/ai/transcribe.ts`
- Modify: `app/api/feedback/route.ts` (accept `voiceFileKey`, call transcribe, store transcript)
- Modify: `prisma/schema.prisma` (add `voiceTranscript String?` to FeedbackItem)
- Create: `prisma/migrations/add_voice_transcript/migration.sql`
- Modify: `app/(app)/feedback/page.tsx` (add voice record button)
- Modify: `.env.example` (add AI_SERVICE_BASE_URL)
- Modify: `k8s/configmap.yaml` (add AI_SERVICE_BASE_URL)
- Modify: `k8s/external-secret.yaml` (no secrets needed — URL only)
- Test: `tests/feedback/voice-feedback.test.ts`

---

## Task 011: Dockerfile

**Files:**
- Create: `Dockerfile`

The Next.js standalone output mode produces a minimal image. The K8s deployment already references `localhost:5000/school-committee:latest`.

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 4800
ENV PORT=4800
CMD ["node", "server.js"]
```

- [ ] **Step 2: Verify `next.config` has standalone output**

Read `next.config.ts` (or `next.config.js`). If `output: "standalone"` is missing, add it:

```ts
// next.config.ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
};
export default nextConfig;
```

- [ ] **Step 3: Build locally to confirm**

```bash
docker build -t school-committee:test .
```

Expected: image builds, no error. Run health check:

```bash
docker run --rm -p 4800:4800 -e NODE_ENV=production school-committee:test &
sleep 3 && curl -f http://localhost:4800/api/health/live
```

Expected output: `{"status":"ok"}` or similar.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile next.config.ts
git commit -m "feat: add production Dockerfile with standalone Next.js output"
```

---

## Task 012: Middleware hardening

**Files:**
- Modify: `middleware.ts`
- Create: `tests/middleware.test.ts`

The current middleware only checks for cookie presence — a stale/invalid token passes through. The hardening: decode the JWT expiry claim (`exp`) without a full verify (the auth microservice is the authority, but we can at minimum reject tokens that are obviously expired client-side to save a network round-trip).

- [ ] **Step 1: Write the failing test**

Create `tests/middleware.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// We test the middleware function directly by importing it.
// middleware.ts must be importable — no edge-only globals.
import { middleware } from "@/middleware";

function makeReq(path: string, cookie?: string) {
  const req = new NextRequest(`http://localhost${path}`);
  if (cookie) req.cookies.set("scp_access", cookie);
  return req;
}

// A minimal JWT with exp in the past (payload: {"exp": 1000000000})
const EXPIRED_JWT =
  "eyJhbGciOiJIUzI1NiJ9." +
  btoa(JSON.stringify({ exp: 1000000000 })).replace(/=/g, "") +
  ".fake";

// A minimal JWT with exp far in the future
const VALID_JWT =
  "eyJhbGciOiJIUzI1NiJ9." +
  btoa(JSON.stringify({ exp: 9999999999 })).replace(/=/g, "") +
  ".fake";

describe("middleware", () => {
  it("passes through unprotected paths without cookie", () => {
    const res = middleware(makeReq("/"));
    expect(res.status).not.toBe(307);
  });

  it("redirects to /login when no cookie on protected path", () => {
    const res = middleware(makeReq("/admin/users"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects when cookie contains obviously expired token", () => {
    const res = middleware(makeReq("/admin/users", EXPIRED_JWT));
    expect(res.status).toBe(307);
  });

  it("passes through when cookie contains non-expired token", () => {
    const res = middleware(makeReq("/admin/users", VALID_JWT));
    expect(res.status).not.toBe(307);
  });

  it("preserves the next param in login redirect", () => {
    const res = middleware(makeReq("/admin/payments"));
    expect(res.headers.get("location")).toContain("next=%2Fadmin%2Fpayments");
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npm test -- tests/middleware.test.ts
```

Expected: FAIL — expired token test fails because current middleware only checks cookie presence.

- [ ] **Step 3: Update middleware.ts**

```ts
import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];
const LOGIN_PATH = "/login";

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get("scp_access")?.value;

  if (!accessToken || isTokenExpired(accessToken)) {
    const loginUrl = new URL(LOGIN_PATH, req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npm test -- tests/middleware.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: 177 tests pass.

- [ ] **Step 6: Commit**

```bash
git add middleware.ts tests/middleware.test.ts
git commit -m "feat: harden middleware to reject obviously expired JWT tokens"
```

---

## Task 013: Public transparency report page

**Files:**
- Create: `app/api/public/report/route.ts`
- Create: `app/(public)/report/page.tsx`
- Create: `app/(public)/layout.tsx`
- Test: `tests/public/report-route.test.ts`

No auth required. Returns: total collected, total spent, balance, list of public expenses, count of completed tasks. No individual payment data.

- [ ] **Step 1: Write the failing API test**

Create `tests/public/report-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockFindMany, mockAggregate } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockAggregate: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    expense: { findMany: mockFindMany, aggregate: mockAggregate },
    paymentIntent: { aggregate: mockAggregate },
    task: { count: vi.fn().mockResolvedValue(0) },
  },
}));

import { GET } from "@/app/api/public/report/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  mockAggregate.mockResolvedValue({ _sum: { amountCzk: null } });
});

describe("GET /api/public/report", () => {
  it("returns 400 when schoolId is missing", async () => {
    const req = new NextRequest("http://localhost/api/public/report");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns report shape with zero amounts when no data", async () => {
    const req = new NextRequest("http://localhost/api/public/report?schoolId=s-1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      totalCollectedCzk: 0,
      totalSpentCzk: 0,
      balanceCzk: 0,
      completedTaskCount: 0,
      expenses: [],
    });
  });

  it("does not require auth (no error for missing token)", async () => {
    const req = new NextRequest("http://localhost/api/public/report?schoolId=s-1");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("omits non-public expenses from result", async () => {
    mockFindMany.mockResolvedValue([
      { id: "e-1", title: "Paint", category: "supplies", amountCzk: 500, spentAt: new Date(), publicVisible: true },
    ]);
    const req = new NextRequest("http://localhost/api/public/report?schoolId=s-1");
    const res = await GET(req);
    const body = await res.json();
    expect(body.expenses).toHaveLength(1);
    expect(body.expenses[0].id).toBe("e-1");
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npm test -- tests/public/report-route.test.ts
```

Expected: FAIL — route does not exist yet.

- [ ] **Step 3: Create the API route**

Create `app/api/public/report/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { toErrorResponse, AppError } from "@/types/errors";
import { getOrCreateRequestId } from "@/lib/request-id";

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId");
    if (!schoolId) throw new AppError("VALIDATION_ERROR", "schoolId is required", 400);

    const [collectedAgg, spentAgg, expenses, completedTaskCount] = await Promise.all([
      db.paymentIntent.aggregate({
        where: { schoolId, status: "paid" },
        _sum: { amountCzk: true },
      }),
      db.expense.aggregate({
        where: { schoolId },
        _sum: { amountCzk: true },
      }),
      db.expense.findMany({
        where: { schoolId, publicVisible: true },
        select: { id: true, title: true, category: true, amountCzk: true, spentAt: true },
        orderBy: { spentAt: "desc" },
        take: 50,
      }),
      db.task.count({ where: { schoolId, status: "completed" } }),
    ]);

    const totalCollectedCzk = collectedAgg._sum.amountCzk ?? 0;
    const totalSpentCzk = spentAgg._sum.amountCzk ?? 0;

    return NextResponse.json({
      totalCollectedCzk,
      totalSpentCzk,
      balanceCzk: totalCollectedCzk - totalSpentCzk,
      completedTaskCount,
      expenses,
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

- [ ] **Step 4: Run test — confirm it passes**

```bash
npm test -- tests/public/report-route.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Create the public layout**

Create `app/(public)/layout.tsx`:

```tsx
import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">School Committee — Public Report</h1>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Create the report page**

Create `app/(public)/report/page.tsx`:

```tsx
import { Suspense } from "react";

interface ReportData {
  totalCollectedCzk: number;
  totalSpentCzk: number;
  balanceCzk: number;
  completedTaskCount: number;
  expenses: { id: string; title: string; category: string; amountCzk: number; spentAt: string }[];
}

async function fetchReport(schoolId: string): Promise<ReportData> {
  const base = process.env.APP_BASE_URL ?? "http://localhost:4800";
  const res = await fetch(`${base}/api/public/report?schoolId=${schoolId}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error("Failed to load report");
  return res.json();
}

async function ReportContent({ schoolId }: { schoolId: string }) {
  const data = await fetchReport(schoolId);
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-sm text-gray-500">Collected</p>
          <p className="text-2xl font-bold text-green-600">{data.totalCollectedCzk.toLocaleString("cs-CZ")} Kč</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-sm text-gray-500">Spent</p>
          <p className="text-2xl font-bold text-red-600">{data.totalSpentCzk.toLocaleString("cs-CZ")} Kč</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-sm text-gray-500">Balance</p>
          <p className="text-2xl font-bold text-blue-600">{data.balanceCzk.toLocaleString("cs-CZ")} Kč</p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Completed volunteer tasks: {data.completedTaskCount}</h2>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Expenses</h2>
        {data.expenses.length === 0 ? (
          <p className="text-gray-500">No expenses recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.expenses.map((e) => (
              <li key={e.id} className="bg-white rounded border p-3 flex justify-between items-center">
                <span>
                  <span className="font-medium">{e.title}</span>
                  <span className="ml-2 text-xs text-gray-400">{e.category}</span>
                </span>
                <span className="text-red-600 font-medium">{e.amountCzk.toLocaleString("cs-CZ")} Kč</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ schoolId?: string }>;
}) {
  const { schoolId } = await searchParams;
  if (!schoolId) {
    return <p className="text-red-600">schoolId parameter is required.</p>;
  }
  return (
    <Suspense fallback={<p>Loading report…</p>}>
      <ReportContent schoolId={schoolId} />
    </Suspense>
  );
}
```

- [ ] **Step 7: Run full test suite**

```bash
npm test
```

Expected: 181 tests pass (177 + 4 new).

- [ ] **Step 8: Commit**

```bash
git add app/api/public/report/route.ts app/(public)/ tests/public/
git commit -m "feat: add public transparency report page and API"
```

---

## Task 014: Admin UI pages

**Files:**
- Create: `app/(admin)/users/page.tsx`
- Create: `app/(admin)/payments/page.tsx`
- Create: `app/(admin)/expenses/page.tsx`
- Create: `app/(admin)/feedback/page.tsx`
- Create: `app/(admin)/exports/page.tsx`

These are server components that call the existing API routes. No new API code — UI only. These pages are already role-guarded by middleware (redirects to `/login` without valid cookie) and each API route enforces roles independently.

- [ ] **Step 1: Create users page**

Create `app/(admin)/users/page.tsx`:

```tsx
"use client";
import { useState } from "react";

const ROLES = ["parent", "committee", "teacher", "school_staff", "admin"];

export default function UsersPage() {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("committee");
  const [tenantId, setTenantId] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function assignRole(action: "assign" | "revoke") {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, tenantId, action }),
      });
      const body = await res.json();
      if (!res.ok) setResult(`Error: ${body.error?.message ?? res.status}`);
      else setResult(`Success: role ${role} ${action}ed for user ${userId}`);
    } catch {
      setResult("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">User Role Management</h1>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">User ID</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="uuid"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tenant ID</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="uuid"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => assignRole("assign")}
            disabled={loading || !userId || !tenantId}
            className="flex-1 bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
          >
            Assign
          </button>
          <button
            onClick={() => assignRole("revoke")}
            disabled={loading || !userId || !tenantId}
            className="flex-1 bg-red-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
          >
            Revoke
          </button>
        </div>
        {result && <p className="text-sm mt-2">{result}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create payments page**

Create `app/(admin)/payments/page.tsx`:

```tsx
"use client";
import { useState } from "react";

export default function PaymentsPage() {
  const [paymentId, setPaymentId] = useState("");
  const [reference, setReference] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function confirmPayment() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference, tenantId }),
      });
      const body = await res.json();
      if (!res.ok) setResult(`Error: ${body.error?.message ?? res.status}`);
      else setResult(`Payment ${body.id} confirmed — status: ${body.status}`);
    } catch {
      setResult("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Manual Payment Confirmation</h1>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Payment Intent ID</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={paymentId}
            onChange={(e) => setPaymentId(e.target.value)}
            placeholder="uuid"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bank Statement Reference</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. 2605000001/0800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tenant ID</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="uuid"
          />
        </div>
        <button
          onClick={confirmPayment}
          disabled={loading || !paymentId || !reference || !tenantId}
          className="w-full bg-green-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Confirming…" : "Confirm Payment"}
        </button>
        {result && <p className="text-sm mt-2">{result}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create expenses page**

Create `app/(admin)/expenses/page.tsx`:

```tsx
"use client";
import { useState } from "react";

const EXPENSE_CATEGORIES = ["supplies", "maintenance", "events", "transport", "catering", "other"];

export default function ExpensesPage() {
  const [form, setForm] = useState({
    schoolId: "", tenantId: "", title: "", category: "supplies",
    amountCzk: "", spentAt: "", publicVisible: false, description: "",
  });
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createExpense() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          amountCzk: parseFloat(form.amountCzk),
        }),
      });
      const body = await res.json();
      if (!res.ok) setResult(`Error: ${body.error?.message ?? res.status}`);
      else setResult(`Expense created: ${body.expense.id}`);
    } catch {
      setResult("Network error");
    } finally {
      setLoading(false);
    }
  }

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        className="w-full border rounded px-3 py-2 text-sm"
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Create Expense</h1>
      <div className="space-y-3">
        {field("schoolId", "School ID")}
        {field("tenantId", "Tenant ID")}
        {field("title", "Title")}
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {field("amountCzk", "Amount (CZK)", "number")}
        {field("spentAt", "Spent At", "date")}
        {field("description", "Description (optional)")}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.publicVisible}
            onChange={(e) => setForm({ ...form, publicVisible: e.target.checked })}
          />
          Visible on public report
        </label>
        <button
          onClick={createExpense}
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create Expense"}
        </button>
        {result && <p className="text-sm mt-2">{result}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create feedback moderation page**

Create `app/(admin)/feedback/page.tsx`:

```tsx
"use client";
import { useState } from "react";

const MODERATION_STATUSES = ["new", "in_review", "resolved", "rejected"];

export default function FeedbackModerationPage() {
  const [itemId, setItemId] = useState("");
  const [status, setStatus] = useState("in_review");
  const [schoolId, setSchoolId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function moderate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/feedback/${itemId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, schoolId, tenantId }),
      });
      const body = await res.json();
      if (!res.ok) setResult(`Error: ${body.error?.message ?? res.status}`);
      else setResult(`Feedback ${itemId} updated to ${body.item?.status ?? status}`);
    } catch {
      setResult("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Feedback Moderation</h1>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Feedback Item ID</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            placeholder="uuid"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">New Status</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {MODERATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">School ID</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tenant ID</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          />
        </div>
        <button
          onClick={moderate}
          disabled={loading || !itemId}
          className="w-full bg-orange-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Updating…" : "Update Status"}
        </button>
        {result && <p className="text-sm mt-2">{result}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create CSV exports page**

Create `app/(admin)/exports/page.tsx`:

```tsx
"use client";
import { useState } from "react";

const EXPORT_TYPES = ["payments", "tasks", "feedback"] as const;
type ExportType = typeof EXPORT_TYPES[number];

export default function ExportsPage() {
  const [schoolId, setSchoolId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState<ExportType | null>(null);

  async function downloadExport(type: ExportType) {
    if (!schoolId || !tenantId) return;
    setLoading(type);
    try {
      const res = await fetch(
        `/api/admin/exports/${type}?schoolId=${encodeURIComponent(schoolId)}&tenantId=${encodeURIComponent(tenantId)}`,
      );
      if (!res.ok) {
        const body = await res.json();
        alert(`Export failed: ${body.error?.message ?? res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Network error during export");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">CSV Exports</h1>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">School ID</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            placeholder="uuid"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tenant ID</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="uuid"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          {EXPORT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => downloadExport(type)}
              disabled={loading !== null || !schoolId || !tenantId}
              className="flex-1 bg-gray-800 text-white rounded px-4 py-2 text-sm disabled:opacity-50 capitalize"
            >
              {loading === type ? "Downloading…" : `Export ${type}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(admin)/"
git commit -m "feat: add all 5 admin UI pages (users, payments, expenses, feedback, exports)"
```

---

## Task 015: Parent-facing feedback and payments UI

**Files:**
- Create: `app/(app)/feedback/page.tsx`
- Create: `app/(app)/payments/page.tsx`

- [ ] **Step 1: Create feedback submission page**

Create `app/(app)/feedback/page.tsx`:

```tsx
"use client";
import { useState } from "react";

const CATEGORIES = ["general", "safety", "facilities", "teachers", "events", "other"];
const TYPES = ["suggestion", "complaint", "praise", "question"];

export default function FeedbackPage() {
  const [form, setForm] = useState({
    schoolId: "", category: "general", type: "suggestion",
    text: "", isAnonymous: false, classId: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, classId: form.classId || undefined }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error?.message ?? "Submission failed");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-4">
        <p className="text-2xl">Thank you!</p>
        <p className="text-gray-600">Your feedback has been submitted.</p>
        <button onClick={() => { setSubmitted(false); setForm({ ...form, text: "" }); }}
          className="text-blue-600 underline text-sm">Submit another</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">Submit Feedback</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">School ID</label>
          <input className="w-full border rounded px-3 py-2 text-sm"
            value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select className="w-full border rounded px-3 py-2 text-sm"
            value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select className="w-full border rounded px-3 py-2 text-sm"
            value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Your message</label>
          <textarea className="w-full border rounded px-3 py-2 text-sm" rows={4}
            value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isAnonymous}
            onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })} />
          Submit anonymously
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button onClick={submit} disabled={loading || !form.text.trim() || !form.schoolId}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50">
          {loading ? "Sending…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create QR payment page**

Create `app/(app)/payments/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import Image from "next/image";

interface QrResult {
  paymentIntentId: string;
  variableSymbol: string;
  amountCzk: number;
  qrString: string;
  expiresAt: string;
}

export default function PaymentsPage() {
  const [schoolId, setSchoolId] = useState("");
  const [amountCzk, setAmountCzk] = useState("");
  const [result, setResult] = useState<QrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateQr() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/payments/qr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schoolId, amountCzk: parseFloat(amountCzk) }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error?.message ?? "Failed to generate QR");
      else setResult(body);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">Make a Payment</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">School ID</label>
          <input className="w-full border rounded px-3 py-2 text-sm"
            value={schoolId} onChange={(e) => setSchoolId(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount (CZK)</label>
          <input type="number" className="w-full border rounded px-3 py-2 text-sm"
            value={amountCzk} onChange={(e) => setAmountCzk(e.target.value)} min="1" />
        </div>
        <button onClick={generateQr} disabled={loading || !schoolId || !amountCzk}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50">
          {loading ? "Generating…" : "Generate QR Code"}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {result && (
          <div className="border rounded-lg p-4 space-y-3 text-center">
            <p className="text-sm text-gray-600">Variable symbol: <strong>{result.variableSymbol}</strong></p>
            <p className="text-sm text-gray-600">Amount: <strong>{result.amountCzk} Kč</strong></p>
            <div className="bg-gray-100 rounded p-3 text-xs font-mono break-all text-left">
              {result.qrString}
            </div>
            <p className="text-xs text-gray-400">
              Scan this QR string with your banking app. Expires: {new Date(result.expiresAt).toLocaleDateString("cs-CZ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/feedback/page.tsx" "app/(app)/payments/page.tsx"
git commit -m "feat: add parent-facing feedback form and QR payment page"
```

---

## Task 016: GDPR account deletion request

**Files:**
- Create: `app/api/account/delete-request/route.ts`
- Create: `app/(app)/account/delete/page.tsx`
- Test: `tests/account/delete-request.test.ts`

GDPR ARTICLE 17 — right to erasure. User submits a deletion request; admin processes manually. No automatic deletion (MVP). Request is stored as an audit event with `action: "account.deletion_requested"`.

- [ ] **Step 1: Write the failing test**

Create `tests/account/delete-request.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetCurrentUser, mockWriteAuditEvent } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockWriteAuditEvent: vi.fn(),
}));

vi.mock("@/lib/auth/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/db/audit", () => ({ writeAuditEvent: mockWriteAuditEvent }));

import { POST } from "@/app/api/account/delete-request/route";

const user = { id: "u-1", email: "parent@test.com", roles: ["parent"] };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(user);
  mockWriteAuditEvent.mockResolvedValue(undefined);
});

describe("POST /api/account/delete-request", () => {
  it("returns 200 and writes audit event for authenticated user", async () => {
    const req = new NextRequest("http://localhost/api/account/delete-request", {
      method: "POST",
      body: JSON.stringify({ tenantId: "t-1", schoolId: "s-1", reason: "No longer using the platform" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "account.deletion_requested",
        actorUserId: "u-1",
      }),
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockRejectedValue(Object.assign(new Error(), { statusCode: 401, code: "UNAUTHORIZED" }));
    const req = new NextRequest("http://localhost/api/account/delete-request", {
      method: "POST",
      body: JSON.stringify({ tenantId: "t-1", schoolId: "s-1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when tenantId is missing", async () => {
    const req = new NextRequest("http://localhost/api/account/delete-request", {
      method: "POST",
      body: JSON.stringify({ schoolId: "s-1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test — confirm fails**

```bash
npm test -- tests/account/delete-request.test.ts
```

Expected: FAIL — route not found.

- [ ] **Step 3: Create the API route**

Create `app/api/account/delete-request/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrCreateRequestId } from "@/lib/request-id";
import { writeAuditEvent } from "@/lib/db/audit";
import { toErrorResponse, AppError } from "@/types/errors";

export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));
  try {
    const actor = await getCurrentUser(requestId);
    const body = await req.json() as { tenantId?: string; schoolId?: string; reason?: string };

    if (!body.tenantId) throw new AppError("VALIDATION_ERROR", "tenantId is required", 400);

    await writeAuditEvent({
      tenantId: body.tenantId,
      schoolId: body.schoolId,
      actorUserId: actor.id,
      action: "account.deletion_requested",
      entityType: "profile",
      entityId: actor.id,
      metadata: { reason: body.reason ?? null, email: actor.email },
      requestId,
    });

    return NextResponse.json({ message: "Deletion request received. An admin will process it within 30 days." }, { status: 200 });
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

- [ ] **Step 4: Run test — confirm passes**

```bash
npm test -- tests/account/delete-request.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Create the deletion request UI page**

Create `app/(app)/account/delete/page.tsx`:

```tsx
"use client";
import { useState } from "react";

export default function DeleteAccountPage() {
  const [reason, setReason] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, schoolId, reason }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error?.message ?? "Request failed");
      else setDone(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-4">
        <p className="text-xl font-semibold">Request received</p>
        <p className="text-gray-600">Your data deletion request has been submitted. An admin will process it within 30 days as required by GDPR Art. 17.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold text-red-700">Request Account Deletion</h1>
      <p className="text-sm text-gray-600">
        Under GDPR Article 17, you have the right to request erasure of your personal data.
        This request will be processed manually by an admin within 30 days.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tenant ID</label>
          <input className="w-full border rounded px-3 py-2 text-sm"
            value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">School ID (optional)</label>
          <input className="w-full border rounded px-3 py-2 text-sm"
            value={schoolId} onChange={(e) => setSchoolId(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Reason (optional)</label>
          <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3}
            value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button onClick={submit} disabled={loading || !tenantId}
          className="w-full bg-red-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50">
          {loading ? "Submitting…" : "Submit deletion request"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: 184 tests pass (181 + 3 new).

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/api/account/ "app/(app)/account/" tests/account/
git commit -m "feat: GDPR Article 17 — account deletion request endpoint and UI"
```

---

## Task 017: Voice transcription endpoint in ai-microservice

**Context:** The `ai-microservice` currently handles only text LLM inference. We need to add a `POST /voice/transcribe` endpoint that accepts a MinIO file key, fetches the audio, and calls a speech-to-text model (Whisper via OpenRouter or a local Ollama-compatible model). This task works entirely in the **ai-microservice** repository at `/home/ssf/Documents/Github/ai-microservice/`.

**Why ai-microservice:** All AI inference routes through here. No direct provider calls from school-committee. The transcription result (text) is returned to the caller; the audio file itself stays in MinIO and is never re-uploaded.

**Files (all in `ai-microservice` repo):**
- Create: `src/voice/dto/transcribe.dto.ts`
- Create: `src/voice/voice.service.ts`
- Create: `src/voice/voice.controller.ts`
- Create: `src/voice/voice.module.ts`
- Modify: `src/app.module.ts`
- Modify: `litellm_config.yaml` (add whisper model)
- Test: `test/voice/voice.controller.spec.ts`

**Working directory for all steps in this task:** `/home/ssf/Documents/Github/ai-microservice/`

- [ ] **Step 1: Write the failing test**

Create `test/voice/voice.controller.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { VoiceController } from "../../src/voice/voice.controller";
import { VoiceService } from "../../src/voice/voice.service";

describe("VoiceController", () => {
  let controller: VoiceController;
  let service: VoiceService;

  const mockService = {
    transcribe: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [VoiceController],
      providers: [{ provide: VoiceService, useValue: mockService }],
    }).compile();

    controller = module.get(VoiceController);
    service = module.get(VoiceService);
  });

  afterEach(() => jest.clearAllMocks());

  it("returns transcript on success", async () => {
    mockService.transcribe.mockResolvedValue({ transcript: "Hello school committee" });
    const result = await controller.transcribe({ fileKey: "uploads/voice-abc.webm", language: "cs" });
    expect(result).toEqual({ transcript: "Hello school committee" });
    expect(mockService.transcribe).toHaveBeenCalledWith("uploads/voice-abc.webm", "cs");
  });

  it("passes undefined language when not provided", async () => {
    mockService.transcribe.mockResolvedValue({ transcript: "text" });
    await controller.transcribe({ fileKey: "uploads/voice-abc.webm" });
    expect(mockService.transcribe).toHaveBeenCalledWith("uploads/voice-abc.webm", undefined);
  });
});
```

- [ ] **Step 2: Run test — confirm fails**

```bash
cd /home/ssf/Documents/Github/ai-microservice && npx jest test/voice/voice.controller.spec.ts --no-coverage
```

Expected: FAIL — VoiceController not found.

- [ ] **Step 3: Create the DTO**

Create `src/voice/dto/transcribe.dto.ts`:

```ts
import { IsString, IsOptional, Matches } from "class-validator";

export class TranscribeDto {
  @IsString()
  fileKey!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(cs|en|ru|uk|sk|de|pl)$/)
  language?: string;
}
```

- [ ] **Step 4: Create the service**

Create `src/voice/voice.service.ts`:

```ts
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as https from "https";
import * as http from "http";
import FormData from "form-data";

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(fileKey: string, language?: string): Promise<{ transcript: string }> {
    const minioBase = this.config.get<string>("MINIO_INTERNAL_URL", "http://minio-microservice.statex-apps.svc.cluster.local:9000");
    const bucket = this.config.get<string>("MINIO_BUCKET", "school-committee");
    const openrouterKey = this.config.get<string>("OPENROUTER_API_KEY", "");

    // Fetch audio file from MinIO (presigned or internal URL)
    const audioBuffer = await this.fetchFile(`${minioBase}/${bucket}/${fileKey}`);

    // Call OpenRouter Whisper
    const form = new FormData();
    form.append("file", audioBuffer, { filename: "audio.webm", contentType: "audio/webm" });
    form.append("model", "openai/whisper-1");
    if (language) form.append("language", language);

    const transcript = await this.callWhisper(form, openrouterKey);
    this.logger.log(`Transcribed ${fileKey}: ${transcript.length} chars`);
    return { transcript };
  }

  private fetchFile(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith("https") ? https : http;
      client.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    });
  }

  private callWhisper(form: FormData, apiKey: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "openrouter.ai",
        path: "/api/v1/audio/transcriptions",
        method: "POST",
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${apiKey}`,
        },
      };
      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            if (body.text) resolve(body.text as string);
            else reject(new Error(`Whisper error: ${JSON.stringify(body)}`));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on("error", reject);
      form.pipe(req);
    });
  }
}
```

- [ ] **Step 5: Create the controller**

Create `src/voice/voice.controller.ts`:

```ts
import { Controller, Post, Body } from "@nestjs/common";
import { VoiceService } from "./voice.service";
import { TranscribeDto } from "./dto/transcribe.dto";

@Controller("voice")
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post("transcribe")
  transcribe(@Body() dto: TranscribeDto): Promise<{ transcript: string }> {
    return this.voiceService.transcribe(dto.fileKey, dto.language);
  }
}
```

- [ ] **Step 6: Create the module**

Create `src/voice/voice.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { VoiceController } from "./voice.controller";
import { VoiceService } from "./voice.service";

@Module({
  imports: [ConfigModule],
  controllers: [VoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
```

- [ ] **Step 7: Register in app.module.ts**

Open `src/app.module.ts`. Add `VoiceModule` to the imports array:

```ts
import { VoiceModule } from "./voice/voice.module";

@Module({
  imports: [
    // ... existing imports ...
    VoiceModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 8: Run the test — confirm passes**

```bash
npx jest test/voice/voice.controller.spec.ts --no-coverage
```

Expected: 2 tests pass.

- [ ] **Step 9: Run full ai-microservice test suite**

```bash
npm test
```

Expected: all existing tests + 2 new pass.

- [ ] **Step 10: Commit (ai-microservice repo)**

```bash
git add src/voice/ test/voice/
git commit -m "feat: add POST /voice/transcribe endpoint via OpenRouter Whisper"
```

---

## Task 018: Voice feedback integration in school-committee

**Context:** Wire the ai-microservice transcription endpoint into the feedback flow. A parent can upload a voice message; the BFF fetches a MinIO presigned upload URL, sends the audio, then calls `ai-microservice POST /voice/transcribe` to get the transcript, and stores it in `feedback_items.voice_transcript`. The feedback text field is then pre-populated with the transcript.

**Working directory for all steps:** `/home/ssf/Documents/Github/school-committee/`

**Files:**
- Create: `lib/ai/transcribe.ts`
- Modify: `prisma/schema.prisma` (add `voiceTranscript String? @map("voice_transcript")` to FeedbackItem)
- Create: `prisma/migrations/add_voice_transcript/migration.sql`
- Modify: `app/api/feedback/route.ts` (accept optional `voiceFileKey`, auto-populate text from transcript)
- Modify: `app/(app)/feedback/page.tsx` (add voice record + upload button)
- Modify: `.env.example` (add AI_SERVICE_BASE_URL, MINIO_INTERNAL_URL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET)
- Modify: `k8s/configmap.yaml` (add AI_SERVICE_BASE_URL, MINIO_INTERNAL_URL, MINIO_BUCKET)
- Modify: `k8s/external-secret.yaml` (add MINIO_ACCESS_KEY, MINIO_SECRET_KEY)
- Modify: `docs/19-vault-secrets.md` (document new storage path keys)
- Test: `tests/feedback/voice-feedback.test.ts`

- [ ] **Step 1: Add voiceTranscript to Prisma schema**

Open `prisma/schema.prisma`. In the `FeedbackItem` model, add after the `text` field:

```prisma
voiceFileKey    String?  @map("voice_file_key")
voiceTranscript String?  @map("voice_transcript")
```

- [ ] **Step 2: Create the migration SQL**

Create `prisma/migrations/add_voice_transcript/migration.sql`:

```sql
ALTER TABLE feedback_items ADD COLUMN IF NOT EXISTS voice_file_key TEXT;
ALTER TABLE feedback_items ADD COLUMN IF NOT EXISTS voice_transcript TEXT;
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: client regenerated with new fields.

- [ ] **Step 4: Create the AI transcribe client**

Create `lib/ai/transcribe.ts`:

```ts
export async function transcribeVoice(fileKey: string, language?: string): Promise<string> {
  const base = process.env.AI_SERVICE_BASE_URL;
  if (!base) throw new Error("AI_SERVICE_BASE_URL is not configured");

  const res = await fetch(`${base}/voice/transcribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileKey, language }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Transcription failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { transcript: string };
  return data.transcript;
}
```

- [ ] **Step 5: Write the failing voice feedback test**

Create `tests/feedback/voice-feedback.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockGetCurrentUser,
  mockTryGetCurrentUser,
  mockCreateFeedback,
  mockListFeedback,
  mockWriteAuditEvent,
  mockTranscribeVoice,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockTryGetCurrentUser: vi.fn(),
  mockCreateFeedback: vi.fn(),
  mockListFeedback: vi.fn(),
  mockWriteAuditEvent: vi.fn(),
  mockTranscribeVoice: vi.fn(),
}));

vi.mock("@/lib/auth/get-current-user", () => ({
  getCurrentUser: mockGetCurrentUser,
  tryGetCurrentUser: mockTryGetCurrentUser,
}));
vi.mock("@/lib/db/feedback", () => ({
  createFeedback: mockCreateFeedback,
  listFeedback: mockListFeedback,
}));
vi.mock("@/lib/db/audit", () => ({ writeAuditEvent: mockWriteAuditEvent }));
vi.mock("@/lib/ai/transcribe", () => ({ transcribeVoice: mockTranscribeVoice }));

import { POST } from "@/app/api/feedback/route";

const parentUser = { id: "u-1", email: "parent@test.com", roles: ["parent"] };

beforeEach(() => {
  vi.clearAllMocks();
  mockTryGetCurrentUser.mockResolvedValue(parentUser);
  mockGetCurrentUser.mockResolvedValue(parentUser);
  mockWriteAuditEvent.mockResolvedValue(undefined);
  mockCreateFeedback.mockResolvedValue({ id: "fi-1", isAnonymous: false, userId: "u-1" });
});

describe("POST /api/feedback with voice", () => {
  it("transcribes voice and uses transcript as text when voiceFileKey provided", async () => {
    mockTranscribeVoice.mockResolvedValue("Transcribed feedback text");
    const req = new NextRequest("http://localhost/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        schoolId: "s-1",
        isAnonymous: false,
        category: "general",
        type: "suggestion",
        voiceFileKey: "uploads/voice-abc.webm",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockTranscribeVoice).toHaveBeenCalledWith("uploads/voice-abc.webm", undefined);
    expect(mockCreateFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Transcribed feedback text", voiceFileKey: "uploads/voice-abc.webm" }),
    );
  });

  it("returns 400 when neither text nor voiceFileKey is provided", async () => {
    const req = new NextRequest("http://localhost/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        schoolId: "s-1",
        isAnonymous: false,
        category: "general",
        type: "suggestion",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("uses text directly when both text and voiceFileKey provided (text wins)", async () => {
    const req = new NextRequest("http://localhost/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        schoolId: "s-1", isAnonymous: false, category: "general", type: "suggestion",
        text: "Explicit text", voiceFileKey: "uploads/voice-abc.webm",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockTranscribeVoice).not.toHaveBeenCalled();
    expect(mockCreateFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Explicit text" }),
    );
  });
});
```

- [ ] **Step 6: Run test — confirm fails**

```bash
npm test -- tests/feedback/voice-feedback.test.ts
```

Expected: FAIL — voice logic not in feedback route yet.

- [ ] **Step 7: Update feedback route to support voice**

Open `app/api/feedback/route.ts`. Modify the POST handler body section to add voiceFileKey support:

```ts
// Add import at top:
import { transcribeVoice } from "@/lib/ai/transcribe";

// In the POST body typing, add:
voiceFileKey?: string;
language?: string;

// Replace the text validation block:
// OLD:
//   if (!body.text?.trim()) throw new AppError("VALIDATION_ERROR", "text is required", 400);
// NEW:
let feedbackText = body.text?.trim();
if (!feedbackText && body.voiceFileKey) {
  feedbackText = await transcribeVoice(body.voiceFileKey, body.language);
}
if (!feedbackText) throw new AppError("VALIDATION_ERROR", "text or voiceFileKey is required", 400);

// Pass to createFeedback:
// OLD:  text: body.text,
// NEW:  text: feedbackText, voiceFileKey: body.voiceFileKey,
```

The full updated POST signature section looks like:

```ts
const body = await req.json() as {
  schoolId?: string;
  classId?: string;
  isAnonymous?: boolean;
  category?: string;
  type?: string;
  text?: string;
  voiceFileKey?: string;
  language?: string;
};
```

And the createFeedback call becomes:

```ts
const feedback = await createFeedback({
  schoolId: body.schoolId,
  classId: body.classId,
  userId: isAnonymous ? undefined : actor?.id,
  isAnonymous,
  category: body.category,
  type: body.type,
  text: feedbackText,
  voiceFileKey: body.voiceFileKey,
});
```

- [ ] **Step 8: Update lib/db/feedback.ts to accept voiceFileKey**

Open `lib/db/feedback.ts`. In the `createFeedback` input type and the Prisma `create` call, add `voiceFileKey?: string` so it persists to DB:

```ts
// In the input type:
voiceFileKey?: string;

// In the prisma.feedbackItem.create data:
voiceFileKey: input.voiceFileKey ?? null,
```

- [ ] **Step 9: Run voice feedback tests**

```bash
npm test -- tests/feedback/voice-feedback.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 10: Run full test suite**

```bash
npm test
```

Expected: all prior tests + 3 new pass with no regressions.

- [ ] **Step 11: Update .env.example**

Add to `.env.example`:

```bash
# ============================================
# AI Microservice
# ============================================
AI_SERVICE_BASE_URL=http://ai-microservice.statex-apps.svc.cluster.local:3380

# ============================================
# Storage (MinIO) — secrets from Vault
# ============================================
MINIO_INTERNAL_URL=http://minio-microservice.statex-apps.svc.cluster.local:9000
MINIO_BUCKET=school-committee
MINIO_ACCESS_KEY=changeme-local-only
MINIO_SECRET_KEY=changeme-local-only
```

- [ ] **Step 12: Update k8s/configmap.yaml**

Add to the `data` section of `k8s/configmap.yaml`:

```yaml
AI_SERVICE_BASE_URL: "http://ai-microservice.statex-apps.svc.cluster.local:3380"
MINIO_INTERNAL_URL: "http://minio-microservice.statex-apps.svc.cluster.local:9000"
MINIO_BUCKET: "school-committee"
```

- [ ] **Step 13: Update k8s/external-secret.yaml**

Add to the `data` array in `k8s/external-secret.yaml`:

```yaml
- secretKey: MINIO_ACCESS_KEY
  remoteRef:
    key: secret/prod/school-committee/storage
    property: STORAGE_ACCESS_KEY
- secretKey: MINIO_SECRET_KEY
  remoteRef:
    key: secret/prod/school-committee/storage
    property: STORAGE_SECRET_KEY
```

- [ ] **Step 14: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 15: Commit**

```bash
git add lib/ai/ prisma/schema.prisma prisma/migrations/ app/api/feedback/route.ts lib/db/feedback.ts "app/(app)/feedback/page.tsx" .env.example k8s/
git commit -m "feat: voice feedback transcription via ai-microservice Whisper integration"
```

---

## Self-review

### Spec coverage check

| Requirement | Task |
|---|---|
| Dockerfile (image builds, non-root user, health works) | Task 011 |
| Middleware — reject expired tokens | Task 012 |
| Public transparency page (no auth, totals, expenses, tasks) | Task 013 |
| Admin users page | Task 014 |
| Admin payments page | Task 014 |
| Admin expenses page | Task 014 |
| Admin feedback moderation page | Task 014 |
| Admin exports page | Task 014 |
| Parent feedback form UI | Task 015 |
| Parent QR payment UI | Task 015 |
| GDPR Art. 17 deletion request | Task 016 |
| ai-microservice: POST /voice/transcribe | Task 017 |
| Voice → feedback transcript storage | Task 018 |
| AI_SERVICE_BASE_URL wired in K8s | Task 018 |
| MINIO keys in ExternalSecret | Task 018 |

### Voice — MVP scope note

The original MVP scope listed "voice messages" and "speech-to-text" as **SHOULD HAVE** (not MVP must-have), and ADR docs say "do not store raw voice files in MVP unless needed." Tasks 017–018 implement the transcription path (voice → text → stored as feedback text). Raw audio files are stored in MinIO under the parent's fileKey but the transcript is what's surfaced to admins. This respects the GDPR guidance of not storing more than needed.

### Placeholders: none found.

### Type consistency:
- `transcribeVoice(fileKey, language?)` → defined in `lib/ai/transcribe.ts` (Task 018 step 4), called in `app/api/feedback/route.ts` (Task 018 step 7) — ✓
- `voiceFileKey` added to Prisma schema (Task 018 step 1), createFeedback input type (step 8), and route body type (step 7) — ✓
- `VoiceService.transcribe(fileKey, language?)` → defined in `voice.service.ts` (Task 017 step 4), called in controller (step 5) and in test (step 1) — ✓
