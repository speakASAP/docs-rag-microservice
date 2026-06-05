# Implementation Backlog

## EPIC-001 Repository Bootstrap

### STORY-001 Create Next.js application scaffold

Acceptance criteria:

- Next.js app exists
- TypeScript strict enabled
- Tailwind configured
- shadcn/ui initialized
- app runs locally
- basic health page exists

### STORY-002 Create documentation validation

Acceptance criteria:

- docs folder exists
- OpenAPI file validates
- README points to docs

## EPIC-002 Auth Integration

### STORY-010 Implement auth client

Acceptance criteria:

- auth service base URL configurable
- login redirect or API mode supported
- current user endpoint works
- invalid token handled

### STORY-011 Implement protected route wrapper

Acceptance criteria:

- unauthenticated users redirected
- admin routes require admin role
- email-unverified users blocked if auth service exposes flag

## EPIC-003 Onboarding

### STORY-020 Build language selection screen

Acceptance criteria:

- CS/EN/RU/UK options
- selected language persisted
- translations used

### STORY-021 Build parent onboarding form

Acceptance criteria:

- first name, last name, phone optional
- class selection
- children count
- participation type
- GDPR consent
- validation errors visible

## EPIC-004 Tasks

### STORY-030 Implement task list

Acceptance criteria:

- task cards render
- filter by status
- mobile-friendly
- loading/empty/error states

### STORY-031 Implement task detail

Acceptance criteria:

- shows title, description, deadline, priority, status
- comments visible
- claim button shown only when allowed

### STORY-032 Implement task claim

Acceptance criteria:

- calls POST /tasks/{id}/claim
- handles conflict
- refreshes task state
- audit handled by BFF

### STORY-033 Implement task completion

Acceptance criteria:

- assignee can submit completion
- comment required or optional per config
- proof upload placeholder supported

## EPIC-005 QR Payments

### STORY-040 Implement contribution plans UI

Acceptance criteria:

- plans listed
- custom amount supported if enabled
- neutral wording

### STORY-041 Implement QR payment generation

Acceptance criteria:

- POST /payments/qr called
- QR displayed
- variable symbol shown
- instructions displayed

### STORY-042 Implement payment history

Acceptance criteria:

- parent sees only own payments
- status badges
- pending/paid states

### STORY-043 Implement admin manual reconciliation

Acceptance criteria:

- admin can mark pending payment paid
- reason/reference required
- immutable after paid unless correction flow

## EPIC-006 Feedback

### STORY-050 Implement feedback form

Acceptance criteria:

- category required
- class optional/required according to config
- type required
- anonymous toggle
- text required
- success screen

### STORY-051 Implement moderation queue

Acceptance criteria:

- admin/committee can list feedback
- status updates
- assign responsible user
- anonymous display respected

## EPIC-007 Reports

### STORY-060 Implement public report page

Acceptance criteria:

- no auth required
- total collected/spent/balance
- expense list
- completed tasks
- no personal payment data

### STORY-061 Implement expense management

Acceptance criteria:

- committee/admin creates expense
- public visible toggle
- receipt file optional
- audit log event

## EPIC-008 Admin

### STORY-070 Admin layout

Acceptance criteria:

- sidebar navigation
- role protected
- responsive

### STORY-071 User management

Acceptance criteria:

- list users
- filter by role/class
- assign role
- no last admin removal

### STORY-072 CSV exports

Acceptance criteria:

- export payments
- export tasks
- export feedback
- admin only
- audit export event

## EPIC-009 Security and GDPR

### STORY-080 Consent records

Acceptance criteria:

- consent version stored
- timestamp stored
- required before onboarding complete

### STORY-081 Account deletion request

Acceptance criteria:

- user can request deletion
- admin can process manually
- audit log created

### STORY-082 Audit logging middleware

Acceptance criteria:

- mutations create audit events
- request ID included
- metadata minimized

## EPIC-010 Deployment

### STORY-090 Dockerfile

Acceptance criteria:

- production image builds
- non-root user
- health endpoint works

### STORY-091 Kubernetes manifests

Acceptance criteria:

- deployment
- service
- ingress
- configmap
- secret reference
- probes

### STORY-092 Vault integration docs and sample manifests

Acceptance criteria:

- ExternalSecret sample
- secret path documented
- no real secrets

---

## EPIC-011: Landing Page & Lead Capture

**Goal:** Marketing surface at `/` for unauthenticated visitors. Converts curious parents into registered leads.

### STORY-011-01: Bilingual landing page

**As a** visiting parent,
**I want** to see a compelling landing page in Czech (default) or English,
**So that** I understand what the committee does and feel motivated to join.

Acceptance criteria:

- [x] Root `/` shows landing page (not login)
- [x] Language toggle switches between cs and en
- [x] Authenticated users are redirected to `/dashboard`
- [x] Login button visible in nav

### STORY-011-02: Time-or-money contribution section

**As a** parent who cannot contribute financially,
**I want** to see that I can volunteer my time instead,
**So that** I don't feel excluded from the committee.

Acceptance criteria:

- [x] "Money or time" section explains both options
- [x] 6 example volunteer tasks shown with icon, title, description
- [x] Examples include: painting, repairs, events, tutoring, gardening, transport

### STORY-011-03: Lead capture form

**As a** visiting parent,
**I want** to leave my contact details easily,
**So that** the committee can follow up and help me register.

Acceptance criteria:

- [x] Form collects: name, optional message, contact type (email/WhatsApp/Telegram), contact value
- [x] Voice message recording supported (browser MediaRecorder)
- [x] On submit, lead is created in leads-microservice via BFF `/api/leads/submit`
- [x] After submit, shows channel-specific confirmation instructions
- [x] GDPR notice shown

### STORY-011-04: Confirmation sending (FUTURE — notifications-microservice)

**As a** parent who submitted the form,
**I want** to receive a confirmation via my chosen channel,
**So that** I can confirm my interest and complete registration.

Acceptance criteria (FUTURE — Task 014):

- [ ] Email: confirmation link sent, parent clicks to confirm
- [ ] WhatsApp: message sent to parent, parent replies to confirm
- [ ] Telegram: message sent to parent, parent replies to confirm
- [ ] SMS: code sent, parent enters code on landing page

**Note:** The UX confirmation message is shown in STORY-011-03. Actual sending belongs in notifications-microservice + leads-microservice.
