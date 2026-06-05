# Deployment Fix Instructions - Route File Not in Production Build

**Date:** 2026-01-26  
**Issue:** API route `/api/users/[userId]/submissions/route.ts` returning HTML 404 instead of JSON  
**Root Cause:** Route file not included in production build  
**Status:** 🔧 **FIX IN PROGRESS**

---

## Problem Summary

The route file exists in source code but is **not being matched by Next.js** in production, causing it to return a 404 HTML page instead of executing the route handler.

**Error:**
```
🔴 [UserService] Step 5: HTML response detected (error page)
Response: HTML (starts with <!DOCTYPE html>)
Expected: JSON response from API route
```

---

## Solution: Rebuild and Redeploy

### Step 1: Verify Route File Has Required Configuration

The route file should have:
```typescript
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // ✅ Added to ensure Node.js runtime
```

**File:** `src/app/api/users/[userId]/submissions/route.ts`

**Status:** ✅ **ALREADY ADDED** - `export const runtime = 'nodejs';` has been added

---

### Step 2: Commit and Push Changes

```bash
# On local machine
cd /Users/sergiystashok/Documents/GitHub/statex/statex-website/frontend

# Verify route file has the fix
grep -A 2 "export const dynamic" src/app/api/users/\[userId\]/submissions/route.ts

# Commit changes
git add src/app/api/users/\[userId\]/submissions/route.ts
git commit -m "Fix: Add runtime='nodejs' to submissions route to ensure proper route matching"

# Push to repository
git push origin main
```

---

### Step 3: Pull and Rebuild on Production

```bash
# SSH to production
ssh alfares

# Navigate to project
cd ~/statex/statex-website/frontend

# Pull latest changes
git pull origin main

# Verify route file exists and has the fix
cat src/app/api/users/\[userId\]/submissions/route.ts | head -5
# Should show:
# export const dynamic = 'force-dynamic';
# export const runtime = 'nodejs';
```

---

### Step 4: Rebuild Frontend Container

The deployment uses **blue-green deployment** via `nginx-microservice`. The build happens inside Docker during deployment.

**Option A: Use Deployment Script (Recommended)**

```bash
# From statex directory
cd ~/statex

# Run deployment script (this will rebuild the container)
./scripts/deploy.sh
```

This script:
1. Validates docker-compose files
2. Calls `nginx-microservice/scripts/blue-green/deploy-smart.sh statex`
3. Rebuilds the frontend container with fresh build
4. Switches traffic to the new container

**Option B: Manual Rebuild (If deployment script fails)**

```bash
# Navigate to project root
cd ~/statex

# Rebuild frontend container (green environment)
docker compose -f docker-compose.green.yml build --no-cache frontend

# Restart container
docker compose -f docker-compose.green.yml up -d frontend

# Check logs
docker logs statex-frontend-green --tail 50
```

---

### Step 5: Verify Route File in Production Container

After rebuild, verify the route file exists in the built container:

```bash
# Check if route file exists in build
docker exec statex-frontend-green find /app/.next/server/app/api/users -name "*submissions*" -type f

# Check source file exists
docker exec statex-frontend-green ls -la /app/src/app/api/users/\[userId\]/submissions/

# Verify route file contents
docker exec statex-frontend-green cat /app/src/app/api/users/\[userId\]/submissions/route.ts | head -10
```

**Expected Output:**
- Route file should exist in `.next/server/app/api/users/[userId]/submissions/route.js` (compiled)
- Source file should exist in `src/app/api/users/[userId]/submissions/route.ts`

---

### Step 6: Test Route Directly

Test the route from inside the container:

```bash
# Test route from inside container
docker exec statex-frontend-green curl -X POST http://localhost:3000/api/users/test-user/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "submission_id": "test-123",
    "user_id": "test-user",
    "page_type": "homepage",
    "description": "Test submission",
    "status": "pending"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "submission_id": "test-123",
  "message": "Submission created successfully"
}
```

**If HTML is returned:** Route is still not matching - check build logs

---

### Step 7: Check Build Logs

If route still doesn't work, check build logs for route registration:

```bash
# Check container logs for route registration
docker logs statex-frontend-green 2>&1 | grep -i "route\|api/users" | tail -50

# Check for build errors
docker logs statex-frontend-green 2>&1 | grep -i "error\|warn" | tail -50
```

---

## Troubleshooting

### Issue: Route File Not Found in Build

**Symptom:**
```bash
docker exec statex-frontend-green find /app/.next/server/app/api/users -name "*submissions*" -type f
# Returns nothing
```

**Solution:**
1. Verify source file exists:
   ```bash
   docker exec statex-frontend-green ls -la /app/src/app/api/users/\[userId\]/submissions/route.ts
   ```

2. If source file missing, check COPY command in Dockerfile:
   ```dockerfile
   COPY --chown=node:node statex-website/frontend/src ./src
   ```

3. Rebuild with `--no-cache`:
   ```bash
   docker compose -f docker-compose.green.yml build --no-cache frontend
   ```

### Issue: Route Returns HTML 404

**Symptom:** Route exists but returns HTML instead of JSON

**Possible Causes:**
1. **Catch-all route interference** - Check `src/app/[...slug]/page.tsx`
2. **Route not registered** - Check Next.js build logs
3. **Static optimization** - Ensure `export const dynamic = 'force-dynamic'`

**Solution:**
1. Verify route has `export const dynamic = 'force-dynamic'`
2. Verify route has `export const runtime = 'nodejs'`
3. Check catch-all route doesn't interfere:
   ```typescript
   // In [...slug]/page.tsx
   if (slugPath.startsWith('api/')) {
     notFound(); // This should NOT interfere with API routes
   }
   ```

### Issue: Build Fails

**Symptom:** `npm run build` or `next build` fails

**Solution:**
1. Check Node.js version matches (should be 23.11.0)
2. Clear `.next` directory:
   ```bash
   rm -rf .next
   ```
3. Rebuild with verbose logging:
   ```bash
   NODE_ENV=production npx next build --turbo --debug
   ```

---

## Deployment Process Summary

1. ✅ **Local:** Add `export const runtime = 'nodejs';` to route file
2. ✅ **Local:** Commit and push changes
3. ✅ **Production:** Pull latest changes
4. ✅ **Production:** Run `./scripts/deploy.sh` (rebuilds container)
5. ✅ **Production:** Verify route file in container
6. ✅ **Production:** Test route directly
7. ✅ **Production:** Monitor logs for errors

---

## Expected Results After Fix

**Before:**
```
Request: POST /api/users/{userId}/submissions
Response: HTML 404 page (<!DOCTYPE html>...)
Error: "Service configuration error. Please contact support."
```

**After:**
```
Request: POST /api/users/{userId}/submissions
Response: JSON
{
  "success": true,
  "submission_id": "...",
  "message": "Submission created successfully"
}
```

---

## Related Files

- **Route File:** `src/app/api/users/[userId]/submissions/route.ts`
- **Dockerfile:** `statex-website/frontend/Dockerfile`
- **Deploy Script:** `scripts/deploy.sh`
- **Kubernetes:** `docker-compose.green.yml`
- **Process Flow:** `src/docs/form-submission-process-flow.md`
- **Error Analysis:** `src/docs/error-analysis-html-response.md`

---

## Notes

- The deployment uses **blue-green deployment** to avoid downtime
- The build happens **inside Docker** during container build
- Route files are compiled to `.next/server/app/api/...` during build
- Source files remain in `src/app/api/...` for reference
- Next.js must recognize the route during build for it to work in production

---

## Changelog

- **2026-01-26:** Deployment fix instructions created
  - Added `export const runtime = 'nodejs';` to route file
  - Documented deployment process
  - Added troubleshooting steps
  - Verified Dockerfile build process
