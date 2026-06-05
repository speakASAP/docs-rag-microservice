# StateX Website Localization Fix Plan

## Goal

Ensure all top-menu pages load in every supported language without 404s or stuck loading states.

## Plan

- ✅ Inspect active `frontend/middleware.ts` and routing logic for localized index pages.
- ✅ Patch route normalization for localized top-menu slugs (services, solutions, free-prototype).
- ✅ Fix Arabic slug URL decoding - decode URL-encoded Arabic slugs before mapping to English.
- ✅ Fix content loading for localized pages - use English slug for file lookup (files stored with English names).
- ✅ Add Arabic top-menu route handling (services, solutions, free-prototype) - already supported via URL decoding fix.
- ✅ Logging service URL fixed - Added `LOGGING_SERVICE_URL=http://logging-microservice:3367` to both local and production .env files.
- [ ] Validate localized pages for CS/DE/FR/AR and verify no 404s on top menu routes after redeploy.
- ✅ Update documentation with changes and mark completed items.
