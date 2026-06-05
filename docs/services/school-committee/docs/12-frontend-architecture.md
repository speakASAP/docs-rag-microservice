# Frontend Architecture

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod
- next-intl or equivalent i18n library

## Folder structure

```text
apps/web/
  app/
    page.tsx
    login/
    register/
    onboarding/
    app/
      dashboard/
      tasks/
      contributions/
      feedback/
      ideas/
      events/
      reports/
      profile/
    admin/
      users/
      tasks/
      payments/
      expenses/
      feedback/
      reports/
  components/
    layout/
    ui/
    forms/
  features/
    auth/
    onboarding/
    tasks/
    contributions/
    feedback/
    reports/
    admin/
  lib/
    api-client/
    auth/
    permissions/
    validation/
    i18n/
  types/
```

## Feature module standard

Each feature must contain:

```text
features/<feature>/
  api.ts
  components/
  hooks.ts
  schemas.ts
  types.ts
  utils.ts
```

## State management

Use server state through TanStack Query.

Avoid global state except:

- current user context
- selected language
- UI preferences

## Forms

All forms use:

- React Hook Form
- Zod schemas
- server validation mirrored client-side

## Error handling

Frontend displays normalized errors from API.

Error object:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "fields": {
      "email": "Invalid email"
    },
    "requestId": "req_123"
  }
}
```

## Internationalization

All user-facing text must use translation keys.

Recommended namespaces:

- common
- auth
- onboarding
- tasks
- contributions
- feedback
- reports
- admin

## PWA

MVP PWA requirements:

- installable
- mobile viewport
- app manifest
- icons
- basic offline fallback page

Push notifications are optional for MVP.

## Performance

Targets:

- initial mobile load under 3 seconds on average 4G
- dashboard API response under 500ms from BFF excluding external dependencies
- images lazy-loaded
- task photos resized on upload or served via thumbnails

## Accessibility

- semantic HTML
- keyboard navigation
- aria labels
- error messages linked to inputs
- visible focus states
