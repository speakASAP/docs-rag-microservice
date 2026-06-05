# Current Error Status - Form Submission

**Date:** 2026-01-26  
**Status:** ❌ **STILL BROKEN** - Route handler not executing  
**Error:** HTML 404 response instead of JSON

---

## Where It's Stuck

### According to Process Flow Document

**Phase:** Phase 3 - Create Submission Record  
**Step:** Step 2 - Call `userService.createSubmission()`  
**Specific Error Point:** Step 5 - HTML response detection

**Flow:**

```
✅ Phase 1: Form submission - WORKING
✅ Phase 2: Contact collection - WORKING
   └─ user_id obtained successfully

❌ Phase 3: Create submission - STUCK HERE
   │
   ├─ URL: "/api/users/{userId}/submissions"
   ├─ Browser → Nginx → Frontend container ✅
   │
   └─ ❌ PROBLEM: Next.js returns HTML (404 page) instead of JSON
      │
      └─ Next.js API Route handler NOT EXECUTED
         └─ Route: /api/users/[userId]/submissions/route.ts
            └─ ❌ Handler never called - no logs appear
```

---

## Verification Results

### ✅ What's Working

1. **Route file exists in source** - `/app/src/app/api/users/[userId]/submissions/route.ts`
2. **Route file is compiled** - `/app/.next/server/app/api/users/[userId]/submissions/route.js`
3. **Route is registered in Next.js:**
   - `routes-manifest.json`: `/api/users/[userId]/submissions` with regex `^/api/users/([^/]+?)/submissions(?:/)?$`
   - `app-paths-manifest.json`: `/api/users/[userId]/submissions/route`
4. **Route has correct configuration:**
   - `export const dynamic = 'force-dynamic';`
   - `export const runtime = 'nodejs';`
5. **No conflicting route files** - No `/api/users/route.ts` file exists
6. **Middleware excludes API routes** - Correctly configured
7. **Catch-all route skips API routes** - Correctly configured

### ❌ What's Broken

1. **Route handler NOT executing** - No logs from route handler appear
2. **Next.js serving HTML 404** - Instead of executing route handler
3. **Route module loads but POST is undefined** - When tested directly

---

## Root Cause Analysis

### The Problem

**Next.js is not executing the route handler** even though:

- Route file exists ✅
- Route is registered ✅
- Route configuration is correct ✅

**Evidence:**

- No route handler logs appear in production
- HTML 404 page is returned instead of JSON
- Route module can be loaded but `POST` export is `undefined`

### Possible Causes

1. **Next.js Route Matching Failure**
   - Dynamic route `[userId]` not matching at runtime
   - Route priority issue (though no conflicting routes exist)
   - Next.js internal routing bug

2. **Turbopack Build Issue**
   - Route compiled with Turbopack but not properly exported
   - Module system incompatibility
   - Build artifact corruption

3. **Runtime Error Preventing Execution**
   - Route handler throws error before logging
   - Next.js catches error and serves 404
   - Error not logged to console

4. **Next.js Version Issue**
   - Next.js 15.5 async params support issue
   - Route handler signature not recognized
   - Turbopack compilation issue

---

## Error Details

**Error Message:**

```
🔴 [UserService] Step 5: HTML response detected (error page)
Response: HTML (starts with <!DOCTYPE html>)
Expected: JSON response from API route
```

**Request:**

- URL: `/api/users/84e70a37-a528-486f-a1ba-6026be36c746/submissions`
- Method: POST
- Status: 200 (but HTML content, not JSON)

**Response:**

- Content-Type: `text/html` (should be `application/json`)
- Body: HTML 404 page
- No route handler logs

---

## Next Steps to Debug

### 1. Check Route Handler Execution

Add immediate logging at the very start of the route handler:

```typescript
export async function POST(request: NextRequest, { params }) {
  console.log('🔴 [ROUTE] HANDLER CALLED - This should appear if route executes');
  // ... rest of handler
}
```

### 2. Check for Runtime Errors

```bash
docker logs statex-frontend-green 2>&1 | grep -E 'Error|Exception|Failed|route' | tail -50
```

### 3. Test Route Directly

```bash
# From production server
curl -X POST https://alfares.cz/api/users/test-user/submissions \
  -H "Content-Type: application/json" \
  -d '{"submission_id":"test","page_type":"test","status":"pending","description":"test"}'
```

### 4. Check Next.js Route Matching

Verify Next.js is actually trying to match the route by checking:

- Next.js internal routing logs
- Route matcher output
- Request path parsing

### 5. Verify Turbopack Build

Check if the issue is with Turbopack compilation:

- Try building without `--turbo` flag
- Check if route exports are correct
- Verify module resolution

---

## Immediate Workaround

If route continues to not work, consider:

1. **Temporary: Use query parameter instead of path parameter**

   ```typescript
   // Change from: /api/users/[userId]/submissions
   // To: /api/users/submissions?userId=...
   ```

2. **Alternative: Create static route that forwards**

   ```typescript
   // /api/users/submissions/route.ts
   // Extracts userId from body and forwards to user-portal
   ```

3. **Debug: Add route at /api/users/test-route to verify routing works**

---

## Status Summary

| Component | Status | Notes |
| --------- | ------ | ----- |
| Route file exists | ✅ | Source and compiled |
| Route registered | ✅ | In Next.js manifests |
| Route configuration | ✅ | `dynamic` and `runtime` set |
| Route handler execution | ❌ | **NOT EXECUTING** |
| Response | ❌ | HTML 404 instead of JSON |

**Critical Issue:** Route handler is never called, even though route is properly registered and configured.

---

## Changelog

- **2026-01-26:** Current error status documented
  - Verified route exists and is registered
  - Confirmed route handler is NOT executing
  - Identified Next.js route matching as likely issue
  - Added debugging steps
