# UX/UI Specification

## Design principles

1. Mobile first.
2. One primary action per screen.
3. Avoid complex dashboards for parents.
4. Use clear status labels.
5. Avoid shame-based contribution UX.
6. Support older parents.
7. Support multilingual interface.
8. Make transparency visible from home screen.

## Main navigation

Mobile bottom navigation:

- Home
- Tasks
- Payments
- Feedback
- More

Admin uses sidebar navigation.

## Parent dashboard

### Sections

1. Greeting and class context
2. Participation status
3. Quick actions
4. Active tasks
5. Payment status
6. Latest report
7. Events/announcements

### Primary actions

- Pay contribution
- Help with a task
- Send feedback
- View report

## Task list screen

### Filters

- open
- my tasks
- completed
- urgent
- by class

### Task card

Fields:

- title
- priority
- deadline
- class/scope
- status
- photo thumbnail
- CTA:
  - view
  - claim
  - continue

## Task detail screen

Sections:

- title
- photo
- description
- deadline
- priority
- status
- creator
- assignee visibility controlled by role
- comments
- action button

## Contribution screen

Sections:

- suggested contribution
- QR payment button
- payment history
- explanation: money or time are both valid
- public report link

### Important UX rule

Do not label non-paying parents as debtors. Use neutral labels:

- participation pending
- financial contribution pending
- labor contribution selected
- mixed participation

## Feedback form

### Mobile form layout

Step 1:
- category
- class
- type

Step 2:
- message
- anonymous toggle

Step 3:
- review and submit

## Admin panel UX

Admin must be dense but safe.

Required:

- tables with filters
- clear status badges
- audit trail link
- destructive action confirmation
- role change confirmation
- CSV export

## Accessibility

Target:

- WCAG 2.1 AA
- large touch targets
- high contrast
- keyboard support
- aria labels
- form errors near fields
- never rely on color only

## Older parent support

Requirements:

- minimum font size 16px
- no hidden swipe-only actions
- avoid icons without text
- short forms
- persistent save
- phone-friendly QR flow
- clear help text

## Empty states

Examples:

No tasks:

> There are currently no open school tasks.

No payments:

> No contributions recorded yet. You can contribute financially or help with a task.

No feedback:

> No feedback submitted yet.

## Tone

Neutral, non-judgmental, community-oriented.

Avoid:

- debt language
- public ranking of parents
- pressure wording
- public naming of unpaid parents
