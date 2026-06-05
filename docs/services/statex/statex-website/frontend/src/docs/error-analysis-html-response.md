# Error Analysis: HTML Response Instead of JSON

**Date:** 2026-01-26  
**Error Type:** API Route Returning HTML (404 Page)  
**Status:** ❌ **STUCK AT PHASE 3**

---

## Error Summary

**Error Message:**
```
🔴 [UserService] Step 5: HTML response detected (error page)
Error: "Service configuration error. Please contact support."
```

**Request Details:**
- **URL:** `/api/users/84e70a37-a528-486f-a1ba-6026be36c746/submissions`
- **Method:** POST
- **Response:** HTML (starts with `<!DOCTYPE html>`)
- **Expected:** JSON response from API route

---

## Where It's Stuck

### According to Process Flow Document

**Phase:** Phase 3 - Create Submission Record  
**Step:** Step 2 - Call `userService.createSubmission()`  
**Location:** `userService.ts` → Line 523-531

**Flow Breakdown:**

```
✅ Phase 1: Form submission - WORKING
✅ Phase 2: Contact collection - WORKING (user_id obtained: 84e70a37-a528-486f-a1ba-6026be36c746)
❌ Phase 3: Create submission - STUCK HERE
    │
    ├─ URL constructed: "/api/users/84e70a37-a528-486f-a1ba-6026be36c746/submissions"
    ├─ Browser sends POST request
    ├─ Nginx routes to frontend container ✅
    │
    └─ ❌ PROBLEM: Next.js returns HTML (404 page) instead of API route handler
       │
       └─ Next.js API Route → /api/users/[userId]/submissions/route.ts
          └─ ❌ NOT MATCHED - Returns HTML 404 page instead
```

---

## Detailed Error Flow

### Step-by-Step Execution

1. **✅ Step 0: URL Preparation** (Line 404)
   ```typescript
   const url = `${this.baseUrl}/${userId}/submissions`;
   // Results in: "/api/users/84e70a37-a528-486f-a1ba-6026be36c746/submissions"
   ```

2. **✅ Step 1: Fetch Request Initiated** (Line 438)
   ```typescript
   const response = await fetch(url, { method: 'POST', ... });
   ```

3. **✅ Step 2: Fetch Completed** (Line 452)
   - Response received (but it's HTML, not JSON)

4. **✅ Step 3: Network Check** (Line 493)
   - Status is NOT 0 (so not a network error)

5. **✅ Step 4: Read Response Body** (Line 512)
   ```typescript
   const text = await response.text();
   // text starts with "<!DOCTYPE html>" - HTML 404 page
   ```

6. **❌ Step 5: HTML Detection** (Line 524) - **ERROR THROWN HERE**
   ```typescript
   if (text.trim().startsWith('<')) {
     throw new Error('Service configuration error. Please contact support.');
   }
   ```

**Result:** Error thrown, submission creation fails

---

## Root Cause Analysis

### Problem: Next.js Not Matching API Route

The API route `/api/users/[userId]/submissions/route.ts` exists in the codebase but **Next.js is not matching it** in production. Instead, Next.js is serving a **404 HTML page**.

### Possible Causes

1. **Route File Not in Production Build**
   - The route file exists in source but wasn't included in the production build
   - Next.js build process didn't recognize the dynamic route

2. **Next.js Route Matching Issue**
   - Dynamic route `[userId]` not being matched correctly
   - Route priority conflict with catch-all route `[...slug]`

3. **Build Cache Issue**
   - Stale build cache causing old route structure
   - Route file changes not reflected in production build

4. **File System Issue**
   - Route file not accessible in production container
   - Permissions issue preventing route file from being read

5. **Next.js Configuration Issue**
   - `export const dynamic = 'force-dynamic'` not working as expected
   - Route not being registered during build

---

## Evidence

### Error Logs Show:
- ✅ Request reaches Next.js (not a network error)
- ✅ Response is received (not a timeout)
- ❌ Response is HTML (404 page) instead of JSON
- ❌ API route handler never executed (no route logs)

### Expected vs Actual:

**Expected:**
```
🟢 [API Route] POST /api/users/[userId]/submissions START
🟢 [API Route] Parsing request body...
🟢 [API Route] Forwarding to user-portal service...
✅ [API Route] POST /api/users/[userId]/submissions SUCCESS
```

**Actual:**
```
(No route logs - route handler never executed)
Response: HTML 404 page
```

---

## Verification Steps Needed

### 1. Check Production Build

```bash
# SSH to production
ssh alfares

# Check if route file exists in build
docker exec statex-frontend-green find /app/.next/server/app/api/users -name "*.js" -type f

# Check route structure
docker exec statex-frontend-green ls -la /app/.next/server/app/api/users/
```

### 2. Check Source Files in Container

```bash
# Check if source route file exists
docker exec statex-frontend-green ls -la /app/src/app/api/users/[userId]/submissions/

# Verify file contents
docker exec statex-frontend-green cat /app/src/app/api/users/[userId]/submissions/route.ts | head -50
```

### 3. Check Next.js Build Logs

```bash
# Check build logs for route registration
docker logs statex-frontend-green | grep -i "route\|api/users" | tail -50
```

### 4. Test Route Directly

```bash
# Test from inside container
docker exec statex-frontend-green curl -X POST http://localhost:3000/api/users/test-user/submissions \
  -H "Content-Type: application/json" \
  -d '{"submission_id":"test","page_type":"test","status":"pending","description":"test"}'
```

---

## Solution Steps

### Step 1: Verify Route File in Production

```bash
ssh alfares
docker exec statex-frontend-green find /app -path "*/api/users/*/submissions/route.*" -type f
```

**Expected:** Should find the route file  
**If not found:** Route file not deployed

### Step 2: Rebuild with Clean Cache

```bash
cd ~/statex/statex-website/frontend

# Remove build cache
rm -rf .next

# Rebuild
npm run build

# Or if using Docker
docker-compose build --no-cache frontend
```

### Step 3: Verify Route Registration

Check Next.js build output for route registration:
```bash
docker logs statex-frontend-green | grep "Route" | grep "api/users"
```

### Step 4: Check Catch-All Route Interference

Verify the catch-all route `[...slug]/page.tsx` is not interfering:
```typescript
// Should skip API routes
if (slugPath.startsWith('api/')) {
  notFound(); // This should not interfere with API routes
}
```

### Step 5: Force Dynamic Route

Ensure route has:
```typescript
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Explicitly set runtime
```

---

## Immediate Workaround

If route is not working, we can temporarily:

1. **Add explicit route handler** at `/api/users/submissions/route.ts` that redirects
2. **Use query parameter** instead of path parameter: `/api/users/submissions?userId=...`
3. **Check if route needs to be in different location**

---

## Related Files

- **Route File:** `src/app/api/users/[userId]/submissions/route.ts`
- **Service:** `src/services/userService.ts` (line 404-531)
- **Process Flow:** `src/docs/form-submission-process-flow.md`
- **Catch-All Route:** `src/app/[...slug]/page.tsx` (may interfere)

---

## Next Steps

1. ✅ **Verify route file exists in production container**
2. ✅ **Check Next.js build logs for route registration**
3. ✅ **Rebuild with clean cache if route missing**
4. ✅ **Test route directly from container**
5. ✅ **Check for catch-all route interference**

---

## Status

**Current Status:** ❌ **STUCK** - API route not matching, returning HTML 404  
**Blocking:** Phase 3 (Create Submission)  
**Impact:** Form submission cannot complete  
**Priority:** 🔴 **CRITICAL**

---

## Changelog

- **2026-01-26:** Error analysis created
  - Identified HTML response issue
  - Traced to Phase 3, Step 5
  - Root cause: Next.js route not matching
  - Solution steps outlined
