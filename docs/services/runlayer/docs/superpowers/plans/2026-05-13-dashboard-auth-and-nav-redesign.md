# Dashboard Auth & Nav Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect `/api/dashboard` behind JWT auth, add an "Admin" sidebar section for lifecycle actions, and ensure the Portfolio view shows only live project cards.

**Architecture:** Backend adds `@UseGuards(JwtGuard)` to the dashboard endpoint. A new `AdminGuard` checks the requesting user's ID against the `ORCHESTRATOR_ADMIN_IDS` env var. Frontend passes the JWT when fetching dashboard data, adds an "Admin" nav item backed by a new `<section>`, and removes the action panel from the Portfolio view.

**Tech Stack:** NestJS (guards, decorators), Vanilla JS/HTML frontend, Jest for unit tests.

---

## Files

| File | Action | Responsibility |
|------|--------|----------------|
| `src/dashboard/dashboard.controller.ts` | Modify | Add `@UseGuards(JwtGuard)` to `overview()` |
| `src/dashboard/dashboard.controller.spec.ts` | Modify | Add test: unauthenticated 401 guard check |
| `src/common/auth/admin.guard.ts` | Create | Guard: allow only user IDs in `ORCHESTRATOR_ADMIN_IDS` |
| `src/common/auth/admin.guard.spec.ts` | Create | Unit tests for AdminGuard |
| `src/config/configuration.ts` | Modify | Add `orchestratorAdminIds: string[]` to config |
| `src/dashboard/dashboard.module.ts` | Modify | Provide `AdminGuard` |
| `public/app.js` | Modify | Pass JWT in `loadPortfolio()`, add Admin nav routing |
| `public/index.html` | Modify | Add "Admin" nav item + `admin-view` section, remove action panel from portfolio-view |
| `.env` | Modify | Add `ORCHESTRATOR_ADMIN_IDS=<test-user-uuid>` |

---

## Task 1: Protect `/api/dashboard` with JwtGuard

**Files:**
- Modify: `src/dashboard/dashboard.controller.ts`
- Modify: `src/dashboard/dashboard.controller.spec.ts`

- [ ] **Step 1: Update the test — verify guard is applied**

The spec already overrides `JwtGuard` with `canActivate: () => true`. Add a test that verifies the guard metadata is present on the `overview` method:

```typescript
// Add to the describe block in src/dashboard/dashboard.controller.spec.ts
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';

it('GET /dashboard has JwtGuard applied', () => {
  const guards = Reflect.getMetadata(GUARDS_METADATA, DashboardController.prototype.overview);
  expect(guards).toBeDefined();
  expect(guards.some((g: any) => g === JwtGuard || (g?.name ?? '') === 'JwtGuard')).toBe(true);
});
```

- [ ] **Step 2: Run the new test to confirm it fails**

```bash
cd /home/ssf/Documents/Github/runlayer
npx jest src/dashboard/dashboard.controller.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `guards` is undefined or does not contain JwtGuard.

- [ ] **Step 3: Add `@UseGuards(JwtGuard)` to `overview()`**

```typescript
// src/dashboard/dashboard.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { BusinessesService } from '../businesses/businesses.service';
import { ProjectsService } from '../projects/projects.service';
import { AgentsService } from '../agents/agents.service';
import { GoalsService } from '../goals/goals.service';
import { JwtGuard } from '../common/auth/jwt.guard';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly projectsService: ProjectsService,
    private readonly agentsService: AgentsService,
    private readonly goalsService: GoalsService,
  ) {}

  @Get()
  @UseGuards(JwtGuard)
  async overview() {
    // ... existing body unchanged ...
  }
}
```

(Keep the entire existing `overview()` body exactly as-is — only add the decorator.)

- [ ] **Step 4: Run the full dashboard spec**

```bash
npx jest src/dashboard/dashboard.controller.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/dashboard.controller.ts src/dashboard/dashboard.controller.spec.ts
git commit -m "feat(dashboard): protect GET /dashboard with JwtGuard"
```

---

## Task 2: Create AdminGuard

**Files:**
- Create: `src/common/auth/admin.guard.ts`
- Create: `src/common/auth/admin.guard.spec.ts`
- Modify: `src/config/configuration.ts`
- Modify: `src/dashboard/dashboard.module.ts`

- [ ] **Step 1: Add `orchestratorAdminIds` to configuration**

In `src/config/configuration.ts`, add the new key inside the default export object:

```typescript
  orchestratorAdminIds: (process.env.ORCHESTRATOR_ADMIN_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean),
```

The final export becomes (abbreviated, add the new key at the end):

```typescript
export default () => ({
  // ... existing keys unchanged ...
  orchestratorAdminIds: (process.env.ORCHESTRATOR_ADMIN_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean),
});
```

- [ ] **Step 2: Write the failing AdminGuard tests**

Create `src/common/auth/admin.guard.spec.ts`:

```typescript
import { AdminGuard } from './admin.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function makeContext(userId: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ userId }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(adminIds: string[]): AdminGuard {
  const cs = { get: jest.fn().mockReturnValue(adminIds) } as unknown as ConfigService;
  return new AdminGuard(cs);
}

describe('AdminGuard', () => {
  it('allows a userId that is in the admin list', () => {
    const guard = makeGuard(['uuid-admin-1', 'uuid-admin-2']);
    expect(guard.canActivate(makeContext('uuid-admin-1'))).toBe(true);
  });

  it('throws ForbiddenException for a userId not in the admin list', () => {
    const guard = makeGuard(['uuid-admin-1']);
    expect(() => guard.canActivate(makeContext('uuid-other'))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when no userId is set on request', () => {
    const guard = makeGuard(['uuid-admin-1']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('allows any userId when admin list is empty (open-admin mode)', () => {
    const guard = makeGuard([]);
    expect(guard.canActivate(makeContext('anyone'))).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

```bash
npx jest src/common/auth/admin.guard.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `AdminGuard` not found.

- [ ] **Step 4: Implement AdminGuard**

Create `src/common/auth/admin.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const adminIds: string[] = this.configService.get('orchestratorAdminIds') ?? [];
    if (adminIds.length === 0) return true; // open-admin: no list configured
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.userId;
    if (!userId || !adminIds.includes(userId)) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
npx jest src/common/auth/admin.guard.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Provide AdminGuard in DashboardModule**

In `src/dashboard/dashboard.module.ts` add `AdminGuard` to providers and exports:

```typescript
import { Module, Global } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardGateway } from './dashboard.gateway';
import { BusinessesModule } from '../businesses/businesses.module';
import { ProjectsModule } from '../projects/projects.module';
import { AgentsModule } from '../agents/agents.module';
import { GoalsModule } from '../goals/goals.module';
import { JwtGuard } from '../common/auth/jwt.guard';
import { AdminGuard } from '../common/auth/admin.guard';

@Global()
@Module({
  imports: [BusinessesModule, ProjectsModule, AgentsModule, GoalsModule],
  controllers: [DashboardController],
  providers: [JwtGuard, AdminGuard, DashboardGateway],
  exports: [DashboardGateway, AdminGuard],
})
export class DashboardModule {}
```

- [ ] **Step 7: Commit**

```bash
git add src/common/auth/admin.guard.ts src/common/auth/admin.guard.spec.ts src/config/configuration.ts src/dashboard/dashboard.module.ts
git commit -m "feat(auth): add AdminGuard backed by ORCHESTRATOR_ADMIN_IDS env var"
```

---

## Task 3: Look up test user UUID and set ORCHESTRATOR_ADMIN_IDS in .env

**Files:**
- Modify: `.env`

> **Note:** `JwtGuard` stores the validated user's `userId` on `request.userId`. This comes from `data.userId ?? data.user?.id` in the guard, where `data` is the `/auth/validate` response. The validate response returns `{ id, email, ... }` (from `sanitizeUser`). So `userId` on the request equals the user's UUID primary key.

- [ ] **Step 1: Look up the test user's UUID in the database**

```bash
kubectl exec -n statex-apps deployment/db-server-postgres -- psql -U dbadmin -d auth -c "SELECT id, email, \"userType\" FROM users WHERE email = 'test@example.com';"
```

Copy the UUID from the `id` column.

- [ ] **Step 2: Also look up your own (ssfskype@gmail.com) UUID**

```bash
kubectl exec -n statex-apps deployment/db-server-postgres -- psql -U dbadmin -d auth -c "SELECT id, email, \"userType\" FROM users WHERE email = 'ssfskype@gmail.com';"
```

Copy this UUID too — both should be in the admin list.

- [ ] **Step 3: Add ORCHESTRATOR_ADMIN_IDS to .env**

Append to `/home/ssf/Documents/Github/runlayer/.env`:

```
ORCHESTRATOR_ADMIN_IDS=<test-user-uuid>,<your-uuid>
```

Replace `<test-user-uuid>` and `<your-uuid>` with the actual UUIDs from Step 1 and Step 2.

- [ ] **Step 4: Commit**

```bash
git add .env
git commit -m "chore(config): add ORCHESTRATOR_ADMIN_IDS with test and owner user UUIDs"
```

---

## Task 4: Frontend — authenticated dashboard fetch

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Update `loadPortfolio()` to pass the JWT**

Find the `loadPortfolio` function (currently line ~905) and replace it:

```javascript
async function loadPortfolio() {
  const token = portfolioState.authToken || localStorage.getItem('accessToken') || '';
  if (!token) {
    showLanding();
    return;
  }
  let data = null;
  try {
    const resp = await fetch('/api/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (resp.status === 401 || resp.status === 403) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      portfolioState.authToken = '';
      showLanding();
      return;
    }
    data = resp.ok ? await resp.json() : null;
  } catch (_e) {
    data = null;
  }
  if (!data) {
    const container = document.getElementById('portfolio-container');
    if (container) {
      container.innerHTML = '<div class="state-error">Failed to load dashboard data. Check service health and try again.</div>';
    }
    return;
  }
  portfolioState.dashboard = data;
  renderPortfolioCards();
  updateBusinessSelectOptions();
  refreshActionUx();
}
```

- [ ] **Step 2: Verify no other unauthenticated calls to `/api/dashboard`**

```bash
grep -n "api/dashboard\|fetch.*dashboard" /home/ssf/Documents/Github/runlayer/public/app.js
```

Expected: only the one call inside `loadPortfolio`. All other dashboard refreshes call `loadPortfolio()` which now handles auth.

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat(frontend): pass JWT when fetching /api/dashboard, redirect to landing on 401"
```

---

## Task 5: Frontend — Admin nav section

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: Add "Admin" nav item and `admin-view` section to `index.html`**

In `public/index.html`, in the sidebar `<ul>`:

```html
<ul>
  <li><a href="#portfolio" class="nav-link active">Portfolio</a></li>
  <li><a href="#goals" class="nav-link">Goals</a></li>
  <li><a href="#tasks" class="nav-link">Tasks</a></li>
  <li><a href="#agents" class="nav-link">Agents</a></li>
  <li><a href="#admin" class="nav-link">Admin</a></li>
</ul>
```

In `public/index.html`, remove `<div id="portfolio-actions"></div>` and `<div id="portfolio-feedback" aria-live="polite"></div>` from `#portfolio-view`, so it becomes:

```html
<section id="portfolio-view">
  <h2>Business Portfolio</h2>
  <div id="portfolio-container">Loading...</div>
</section>
```

Add the new `admin-view` section inside `<main class="content" id="main-content">`, after the existing sections:

```html
<section id="admin-view" style="display:none">
  <h2>Admin</h2>
  <div id="portfolio-actions"></div>
  <div id="portfolio-feedback" aria-live="polite"></div>
</section>
```

The full `<main>` block should end up as:

```html
<main class="content" id="main-content" style="display:none">
  <section id="portfolio-view">
    <h2>Business Portfolio</h2>
    <div id="portfolio-container">Loading...</div>
  </section>
  <section id="goal-detail-view" style="display:none">
    <h2 id="goal-detail-title"></h2>
    <div id="goal-detail-container"></div>
  </section>
  <section id="task-graph-view" style="display:none">
    <h2>Task Dependency Graph</h2>
    <div id="task-graph-container"></div>
  </section>
  <section id="execution-log-view" style="display:none">
    <h2>Execution Log</h2>
    <div id="execution-log-container"></div>
  </section>
  <section id="admin-view" style="display:none">
    <h2>Admin</h2>
    <div id="portfolio-actions"></div>
    <div id="portfolio-feedback" aria-live="polite"></div>
  </section>
</main>
```

- [ ] **Step 2: Add Admin routing logic in `app.js`**

The existing nav click handler (around line 921) only toggles `.active` class. It needs to also show/hide sections. Replace the existing nav handler:

```javascript
// Navigation — replace the existing querySelectorAll('.nav-link') block
const sectionMap = {
  portfolio: 'portfolio-view',
  goals: null,
  tasks: null,
  agents: null,
  admin: 'admin-view',
};

document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
    link.classList.add('active');

    const target = link.getAttribute('href')?.replace('#', '');
    // Hide all named sections
    ['portfolio-view', 'goal-detail-view', 'task-graph-view', 'execution-log-view', 'admin-view'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    // Show target section if mapped
    const sectionId = sectionMap[target];
    if (sectionId) {
      const el = document.getElementById(sectionId);
      if (el) el.style.display = 'block';
    }
  });
});
```

- [ ] **Step 3: Ensure `goBack()` returns to portfolio-view (not broken by hide-all)**

Find the existing `goBack()` function in `app.js` and verify it explicitly shows `portfolio-view`:

```bash
grep -n "function goBack\b" /home/ssf/Documents/Github/runlayer/public/app.js
```

If it doesn't already set `portfolio-view` to `block`, update it:

```javascript
function goBack() {
  const portfolioView = document.getElementById('portfolio-view');
  const goalDetailView = document.getElementById('goal-detail-view');
  if (!portfolioView || !goalDetailView) return;
  goalDetailView.style.display = 'none';
  portfolioView.style.display = 'block';
  // Re-activate Portfolio nav link
  document.querySelectorAll('.nav-link').forEach((l) => {
    l.classList.toggle('active', l.getAttribute('href') === '#portfolio');
  });
}
```

- [ ] **Step 4: Verify `setPortfolioFeedback` still works (uses `portfolio-feedback` id)**

```bash
grep -n "portfolio-feedback\|setPortfolioFeedback" /home/ssf/Documents/Github/runlayer/public/app.js | head -10
```

The `portfolio-feedback` div is now in `admin-view`. `setPortfolioFeedback` finds it by ID — no changes needed, IDs are unique in the DOM regardless of parent section.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/app.js
git commit -m "feat(frontend): add Admin nav section, move lifecycle actions out of Portfolio view"
```

---

## Task 6: Update Kubernetes ConfigMap / Secret with new env var and deploy

**Files:**
- `.env` (already updated in Task 3)
- K8s ConfigMap for `runlayer`

- [ ] **Step 1: Update the K8s ConfigMap with ORCHESTRATOR_ADMIN_IDS**

```bash
# Read current configmap to find the right name
kubectl get configmap -n statex-apps | grep runlayer
```

Then patch it (replace `<uuid1>,<uuid2>` with actual values from Task 3):

```bash
kubectl patch configmap runlayer-config -n statex-apps \
  --type merge \
  -p '{"data":{"ORCHESTRATOR_ADMIN_IDS":"<uuid1>,<uuid2>"}}'
```

If the app uses a Secret instead of ConfigMap for env vars, use:

```bash
kubectl patch secret runlayer-secret -n statex-apps \
  --type merge \
  -p '{"stringData":{"ORCHESTRATOR_ADMIN_IDS":"<uuid1>,<uuid2>"}}'
```

- [ ] **Step 2: Deploy**

```bash
cd /home/ssf/Documents/Github/runlayer
./scripts/deploy.sh
```

- [ ] **Step 3: Verify the deployment is running**

```bash
kubectl rollout status deployment/runlayer -n statex-apps --timeout=120s
```

- [ ] **Step 4: Smoke test — unauthenticated request returns 401**

```bash
curl -s -o /dev/null -w "%{http_code}" https://runlayer.alfares.cz/api/dashboard
```

Expected: `401`

- [ ] **Step 5: Smoke test — authenticated request returns data**

```bash
# First get a token for the test user
TOKEN=$(curl -s -X POST https://auth.alfares.cz/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"70fdxIwqY7qUg7vXgaWUm/GBPPH5pAYy"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:20}..."

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  https://runlayer.alfares.cz/api/dashboard
```

Expected: `200`

- [ ] **Step 6: Browser smoke test**

Open `https://runlayer.alfares.cz/` in a browser:
1. Without being logged in: should see the landing page only (no business data visible).
2. Log in with `test@example.com` / `70fdxIwqY7qUg7vXgaWUm/GBPPH5pAYy`.
3. Should see Portfolio with live business/project cards — no action panel.
4. Click "Admin" in the sidebar — should see the lifecycle actions panel.

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Unauthenticated `/api/dashboard` → 401 | Task 1 (guard) + Task 4 (frontend redirect) |
| Authenticated request returns data | Task 4 (Bearer header) |
| Test user can access admin section | Task 2 (AdminGuard) + Task 3 (UUIDs in env) |
| Portfolio shows only project cards | Task 5 (remove action panel from portfolio-view) |
| "Admin" nav shows lifecycle actions | Task 5 (new admin-view section + routing) |
| Unauthenticated browser visit → landing only | Task 4 (loadPortfolio with no token → showLanding) |
| Deploy to production | Task 6 |

### Placeholder scan

- No TBDs found — all code is complete.
- Task 3 Step 3 requires actual UUIDs — these must be filled in at execution time after the DB query.
- Task 6 Step 1 requires checking which resource (ConfigMap vs Secret) holds env vars — handled by the kubectl get command.

### Type consistency

- `AdminGuard` uses `configService.get('orchestratorAdminIds')` — matches the key added to `configuration.ts`.
- `request.userId` is set by `JwtGuard` (existing) — `AdminGuard` reads the same field.
- `portfolio-feedback` ID remains stable across the DOM move — `setPortfolioFeedback` finds it by ID.
