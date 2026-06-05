# Form Submission Process Flow & Error Analysis

**Document Created:** 2026-01-26  
**Last Updated:** 2026-01-26  
**Status:** Active Investigation

---

## Table of Contents

1. [Complete Process Flow](#complete-process-flow)
2. [Error Analysis](#error-analysis)
3. [Working vs Broken Components](#working-vs-broken-components)
4. [Root Cause Analysis](#root-cause-analysis)
5. [Solution Steps](#solution-steps)
6. [Technical Details](#technical-details)

---

## Complete Process Flow

### Overview

This document details the complete flow of form submission from the moment a user clicks "✅ Submit & Continue" button until the submission is fully processed, including all API calls, service interactions, and error points.

---

### Phase 1: User Clicks "Submit & Continue" Button

**Location:** `FormSection.tsx` → `handleSubmit()` (line 167)

**Steps:**

1. Prevent default form submission (`e.preventDefault()`)
2. Set `isSubmitting = true` (disables button, shows loading state)
3. **If recording is active:**
   - Stop recording via `voiceRecordingService.stopRecording()`
   - Get audio blob
   - Create voice recording metadata object
   - Store in `finalVoiceRecordingFile`
4. **Prepare form data object:**

   ```typescript
   {
     description: string,
     name?: string,
     contactType: string,
     contactValue: string,
     hasRecording: boolean,
     recordingTime: number,
     files: File[],
     voiceRecording?: object
   }
   ```

**Status:** ✅ **WORKING**

---

### Phase 2: User Registration and Contact Collection

**Location:** `FormSection.tsx` → `handleUserRegistrationAndSubmission()` (line 280)

**Two Possible Paths:**

#### Path A: Contact Fields Visible (`showContactFields = true`)

1. **Register user immediately:**
   - Call `userService.registerUser(registrationData)`
   - Gets `user_id` and `session_id`
   - Stores in localStorage
   - Updates React state

**Flow:**

```
Browser → /api/users/register (relative URL)
  ↓
Nginx → Routes to statex-frontend-green container
  ↓
Next.js API Route → /api/users/register/route.ts (if exists)
  ↓
Next.js → Forwards to http://user-portal:8000/api/users/register
  ↓
User-portal FastAPI → register_user() endpoint
  ↓
Returns: { user_id, session_id, success: true }
```

#### Path B: No Contact Fields (`showContactFields = false`)

1. **Show contact collection modal** (`ContactCollectionModal`)
2. User fills contact info in modal
3. **On modal submit** → `handleContactCollection()` (line 494)

**In `handleContactCollection()`:**

1. Ensure session ID exists (generate if missing)
2. **Call `userService.collectContactInfo()`:**

   ```
   Browser → /api/users/collect-contact (relative URL)
     ↓
   Nginx → Routes to statex-frontend-green container
     ↓
   Next.js API Route → /api/users/collect-contact/route.ts
     ↓
   Next.js → Forwards to http://user-portal:8000/api/users/collect-contact
     ↓
   User-portal FastAPI → collect_contact_info() endpoint
     ↓
   Returns: { success: true, user_id: "...", message: "..." }
   ```

3. Store `user_id` in localStorage
4. Create submission record (if pending form data exists)

**Status:** ✅ **WORKING**

---

### Phase 3: Create Submission Record

**Location:** `FormSection.tsx` → `handleUserRegistrationAndSubmission()` (line 319)  
**OR:** `FormSection.tsx` → `handleContactCollection()` (line 604)

**Flow:**

1. **Prepare submission data:**

   ```typescript
   {
     user_id: string,
     page_type: string,
     description: string,
     files: File[],
     voice_recording?: object,
     status: 'pending'
   }
   ```

2. **Call `userService.createSubmission(userId, submissionData)`:**

   ```
   Browser → /api/users/[userId]/submissions (relative URL)
     ↓
   Nginx → Routes to statex-frontend-green container
     ↓
   Next.js API Route → /api/users/[userId]/submissions/route.ts
     ↓
   Next.js → Forwards to http://user-portal:8000/api/users/{userId}/submissions
     ↓
   User-portal FastAPI → create_submission() endpoint
     ↓
   Creates submission in in-memory database
     ↓
   Returns: { success: true, submission_id: "...", message: "..." }
   ```

**Status:** ❌ **BROKEN** - Returns 404 error

**Error Details:**

```
Failed to load resource: the server responded with a status of 404 () (submissions, line 0)
Error: "Not found. Use /api/users/[userId]/submissions or /api/users/collect-contact"
```

---

### Phase 4: Disk Persistence (Submission-Service)

**Location:** `FormSection.tsx` → `handleUserRegistrationAndSubmission()` (line 334)

**Flow:**

1. **Create `FormData` object with:**
   - `user_email`, `user_name`, `request_type`, `description`
   - `priority`, `contact_type`, `contact_value`
   - `recording_time`
   - `voice_file` (if present)
   - `files[]` (all uploaded files)

2. **POST to submission-service:**

   ```
   Browser → ${env.API_URL}/submissions/ (direct fetch, not via Next.js API)
     ↓
   Submission-service FastAPI → /api/submissions/ endpoint
     ↓
   Saves files to disk: {base_dir}/{user_id}/{session_id}/files/
     ↓
   Writes form markdown: {base_dir}/{user_id}/{session_id}/form.md
     ↓
   Stores submission in memory database
     ↓
   Returns: { ai_submission_id: "...", ... }
   ```

3. Store `ai_submission_id` for status polling

**Status:** ✅ **WORKING**

---

### Phase 5: Show Processing Feedback

**Location:** `FormSection.tsx` → `handleUserRegistrationAndSubmission()` (line 404)

**Action:**

- `setShowProcessingFeedback(true)`
- Shows `ProcessingFeedback` component
- Starts polling submission status using `ai_submission_id`

**Status:** ⚠️ **PARTIAL** - Depends on Phase 3 success

---

### Phase 6: Send Notification

**Location:** `FormSection.tsx` → `handleUserRegistrationAndSubmission()` (line 407)

**Flow:**

1. **Prepare notification data:**

   ```typescript
   {
     name, contactType, contactValue, description,
     hasRecording, recordingTime, files,
     voiceRecording, userId, submissionId, diskResult
   }
   ```

2. **Call `platformNotificationService.sendPrototypeRequest()`:**

   ```
   Browser → /api/notifications/prototype-request (relative URL)
     ↓
   Nginx → Routes to statex-frontend-green container
     ↓
   Next.js API Route → /api/notifications/prototype-request/route.ts
     ↓
   Next.js → Forwards to platform-management service
     ↓
   Platform-management → Formats and sends notification (Telegram/Email/etc.)
     ↓
   Returns: { success: true, notificationId: "..." }
   ```

**Status:** ✅ **WORKING**

---

### Phase 7: Success Handling

**Location:** `FormSection.tsx` → `handleUserRegistrationAndSubmission()` (line 444)

**Actions:**

1. Clear form state (files, voice recording, etc.)
2. Generate prototype ID: `proto_{timestamp}`
3. Set prototype ID in state
4. **(Optional) Send user confirmation:**
   - If production mode and contact info available
   - Calls `userService.sendConfirmation(userId, contactType)`
5. Show success message
6. Display action buttons (View Dashboard, View Prototype, etc.)

**Status:** ⚠️ **PARTIAL** - Depends on Phase 3 success

---

## Complete Request Flow Diagram

```
User clicks "Submit & Continue"
    ↓
[FormSection.tsx] handleSubmit()
    ├─ Stop recording (if active)
    ├─ Prepare formData
    └─ handleUserRegistrationAndSubmission()
        │
        ├─ [Path A: showContactFields = true]
        │   └─ userService.registerUser()
        │       └─ Browser → /api/users/register
        │           └─ Next.js → user-portal:8000/api/users/register
        │
        └─ [Path B: showContactFields = false]
            └─ Show ContactCollectionModal
                └─ User submits contact → handleContactCollection()
                    └─ userService.collectContactInfo()
                        └─ Browser → /api/users/collect-contact
                            └─ Next.js → user-portal:8000/api/users/collect-contact
                                └─ Returns: { user_id, session_id }
        
        ↓ (After user_id obtained)
        
        userService.createSubmission() ❌ FAILING HERE
            └─ Browser → /api/users/[userId]/submissions
                └─ Next.js → user-portal:8000/api/users/{userId}/submissions
                    └─ ❌ Returns 404: "Not found. Use /api/users/[userId]/submissions..."
        
        ↓
        
        Save to disk (submission-service) ✅
            └─ Browser → {API_URL}/submissions/
                └─ submission-service FastAPI
                    ├─ Save files to disk
                    ├─ Write form.md
                    └─ Returns: { ai_submission_id }
        
        ↓
        
        Show ProcessingFeedback modal
            └─ Starts polling status using ai_submission_id
        
        ↓
        
        Send notification ✅
            └─ platformNotificationService.sendPrototypeRequest()
                └─ Browser → /api/notifications/prototype-request
                    └─ Next.js → platform-management service
                        └─ Sends Telegram/Email notification
        
        ↓
        
        Success! (if Phase 3 succeeds)
            ├─ Clear form state
            ├─ Generate prototype ID
            └─ Show success message + action buttons
```

---

## Error Analysis

### Error Location

**Phase:** Phase 3 - Create Submission Record  
**Component:** `userService.createSubmission()`  
**File:** `frontend/src/services/userService.ts` (line 404-438)  
**Error:** HTTP 404 with message: "Not found. Use /api/users/[userId]/submissions or /api/users/collect-contact"

### Error Details

**Error Message:**

```
[Error] Failed to load resource: the server responded with a status of 404 () (submissions, line 0)
[Error] 🔴 [UserService] Step 6: Error response parsed – {
  requestId: "req_1769419965755_jxtyvm8qy",
  status: 404,
  error: "Not found. Use /api/users/[userId]/submissions or /api/users/collect-contact"
}
```

**Request Details:**

- **URL:** `/api/users/39a85d74-0029-4320-b23b-6b87b5f9a77e/submissions`
- **Method:** POST
- **User ID:** `39a85d74-0029-4320-b23b-6b87b5f9a77e`
- **Duration:** ~460ms

### What's Happening

1. **URL Construction:**

   ```typescript
   const url = `${this.baseUrl}/${userId}/submissions`.replace(/\/+/g, '/');
   // Results in: "/api/users/39a85d74-0029-4320-b23b-6b87b5f9a77e/submissions"
   ```

2. **Fetch Request:**

   ```typescript
   const response = await fetch(url, { method: 'POST', ... });
   ```

3. **Error Response:**
   - Status: 404
   - Message: "Not found. Use /api/users/[userId]/submissions or /api/users/collect-contact"

### Root Cause

**The error message "Not found. Use /api/users/[userId]/submissions or /api/users/collect-contact" is NOT in the current codebase.**

This indicates:

1. **Production has stale code:** The deleted `/api/users/route.ts` file is still present in the production build
2. **Next.js routing conflict:** Next.js may be matching `/api/users` as a static route before the dynamic `[userId]` route
3. **Route file not deployed:** The route file exists locally but wasn't deployed to production

**Evidence:**

- The error message matches the deleted `/api/users/route.ts` file that was created to prevent Next.js prerendering
- This file was later deleted because it caused routing conflicts
- Production still has the old code that returns this error message

---

## Working vs Broken Components

| Phase | Component | Status | Notes |
| ----- | --------- | ------ | ----- |
| **1** | Form submission | ✅ **Working** | Button click, form data prep, recording stop |
| **2** | Contact collection | ✅ **Working** | Modal, API call, user_id returned successfully |
| **3** | Create submission | ❌ **Broken** | 404 error, old route handler active in production |
| **4** | Disk persistence | ✅ **Working** | Files saved successfully to submission-service |
| **5** | Processing feedback | ⚠️ **Partial** | Depends on Phase 3 success |
| **6** | Notification | ✅ **Working** | Sends successfully via platform-management |
| **7** | Success handling | ⚠️ **Partial** | Depends on Phase 3 success |

### Summary

- **Working:** Phases 1, 2, 4, 6
- **Broken:** Phase 3 (critical - blocks submission completion)
- **Partial:** Phases 5, 7 (depend on Phase 3)

---

## Root Cause Analysis

### Problem Point

**Phase 3: `createSubmission()`** is failing with a 404 error.

### Technical Analysis

1. **URL Being Requested:**
   - `/api/users/39a85d74-0029-4320-b23b-6b87b5f9a77e/submissions`
   - Should match: `/api/users/[userId]/submissions/route.ts`

2. **Expected Route:**
   - File: `frontend/src/app/api/users/[userId]/submissions/route.ts`
   - Status: ✅ Exists locally

3. **Error Source:**
   - Error message suggests old `/api/users/route.ts` handler is active
   - This file was deleted but production build still has it

4. **Next.js Routing:**
   - Next.js may be matching `/api/users` as a static route
   - Dynamic route `[userId]` should take precedence but isn't

### Possible Causes

1. **Stale Production Build:**
   - Old code still in production container
   - Route file not updated after deletion

2. **Next.js Route Matching Priority:**
   - Static routes may take precedence over dynamic routes
   - Need to verify route priority

3. **Build Cache:**
   - Next.js build cache may have old route
   - Requires clean rebuild

---

## Solution Steps

### Step 1: Verify Production Routes

```bash
# SSH to production server
ssh alfares

# Check if old route file exists
docker exec statex-frontend-green ls -la /app/.next/server/app/api/users/

# Check route files in source
docker exec statex-frontend-green find /app/src/app/api/users -name "*.ts" -type f
```

### Step 2: Verify Route File Exists

```bash
# On local machine
cd /Users/sergiystashok/Documents/GitHub/statex/statex-website/frontend
ls -la src/app/api/users/[userId]/submissions/route.ts
```

**Expected:** File should exist and contain `export const dynamic = 'force-dynamic'`

### Step 3: Rebuild and Redeploy

```bash
# On production server
cd ~/statex-website/frontend

# Pull latest code
git pull origin main

# Rebuild frontend container
docker-compose -f docker-compose.yml build frontend

# Restart container
docker-compose -f docker-compose.yml restart frontend
```

### Step 4: Verify Next.js Route Configuration

Ensure `/api/users/[userId]/submissions/route.ts` has:

```typescript
export const dynamic = 'force-dynamic';
```

This prevents Next.js from trying to prerender the route as a static page.

### Step 5: Check Nginx Routing

Verify Nginx correctly routes `/api/users/*` to the frontend:

```nginx
location /api/users {
    set $FRONTEND_UPSTREAM statex-frontend-green;
    proxy_pass http://$FRONTEND_UPSTREAM/api/users;
    include /etc/nginx/includes/common-proxy-settings.conf;
    limit_req zone=api burst=20 nodelay;
}
```

**Note:** No trailing slash in `location` or `proxy_pass` to avoid redirect loops.

### Step 6: Test After Deployment

1. Submit form with contact fields
2. Check browser console for errors
3. Verify submission is created in user-portal
4. Check logs:

   ```bash
   docker logs statex-frontend-green | grep "createSubmission"
   docker logs statex-user-portal-green | grep "create_submission"
   ```

---

## Technical Details

### Key Services Involved

1. **User-Portal (FastAPI)**
   - User registration and submission storage
   - Endpoints: `/api/users/collect-contact`, `/api/users/{userId}/submissions`
   - Location: `user-portal/app/main.py`

2. **Submission-Service (FastAPI)**
   - Disk persistence and file storage
   - Endpoint: `/api/submissions/`
   - Location: `services/submission-service/main.py`

3. **Platform-Management**
   - Notification delivery
   - Endpoint: `/api/notifications/prototype-request`
   - Location: `statex-platform/services/platform-management/main.py`

4. **Next.js API Routes**
   - Proxy layer between browser and services
   - Routes:
     - `/api/users/collect-contact/route.ts`
     - `/api/users/[userId]/submissions/route.ts`
     - `/api/notifications/prototype-request/route.ts`

### Data Flow Summary

1. **Browser → Next.js API Route → User-Portal**
   - Contact collection
   - Submission creation

2. **Browser → Submission-Service (Direct)**
   - Disk persistence
   - File storage

3. **Browser → Next.js API Route → Platform-Management**
   - Notification delivery

### Environment Variables

**User-Portal Communication:**

- `USER_PORTAL_HOST` - Service name for Docker networking (default: `user-portal`)
- `USER_PORTAL_INTERNAL_PORT` - Internal port (default: `8000`)

**Submission-Service:**

- `API_URL` - Base URL for submission-service (from `env.ts`)

**Platform-Management:**

- `NEXT_PUBLIC_PLATFORM_API_URL` - Platform API URL (optional)
- `NEXT_PUBLIC_PLATFORM_API_KEY` - API key for authentication

### Logging

All requests are extensively logged at each step:

- **Client-side:** `userService.ts` logs with `🔵`, `✅`, `🔴` emojis
- **Next.js API Routes:** Logs with `🟢`, `🔵`, `🔴` emojis
- **User-Portal:** Python logging with structured data
- **Request IDs:** Generated for each request to track flow

### Error Handling

- **Network errors:** Detected via `response.status === 0`
- **Redirect loops:** Detected and logged with warnings
- **HTML error pages:** Detected by checking if response starts with `<`
- **JSON parsing errors:** Caught and logged with full context

---

## Related Files

### Frontend Components

- `frontend/src/components/sections/FormSection.tsx` - Main form component
- `frontend/src/services/userService.ts` - User and submission service
- `frontend/src/services/platformNotificationService.ts` - Notification service

### API Routes

- `frontend/src/app/api/users/collect-contact/route.ts` - Contact collection proxy
- `frontend/src/app/api/users/[userId]/submissions/route.ts` - Submission creation proxy
- `frontend/src/app/api/notifications/prototype-request/route.ts` - Notification proxy

### Backend Services

- `user-portal/app/main.py` - User-portal FastAPI service
- `services/submission-service/main.py` - Submission-service FastAPI
- `statex-platform/services/platform-management/main.py` - Platform management

---

## Changelog

- **2026-01-26:** Initial documentation created
  - Complete process flow documented
  - Error analysis added
  - Solution steps outlined

---

## Notes

- All requests are sequential (no parallel execution)
- Extensive logging at each step for debugging
- Error messages are user-friendly but detailed in logs
- Production deployment requires container rebuild for route changes
