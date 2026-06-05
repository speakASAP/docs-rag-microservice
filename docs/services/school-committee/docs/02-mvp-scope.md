# MVP Scope

## MVP objective

Launch a first version that can be used by one real school or one parent committee with minimal operational risk.

The MVP must prove:

- parents can self-register
- parents can choose financial or volunteer participation
- school/committee can publish tasks
- parents can claim tasks
- committee can track QR payments
- parents can send feedback
- public transparency page increases trust
- admin can manage everything manually if automation is incomplete

## MUST HAVE

### 1. Registration and onboarding

Included:

- self-registration
- external auth service integration
- email verification handled by auth service
- parent profile
- class selection
- number of children
- participation type:
  - financial
  - labor
  - mixed
- GDPR consent
- language selection

Excluded:

- social login
- child login
- identity document verification

### 2. Role model

Included roles:

- parent
- committee
- teacher
- school_staff
- admin

Child role is designed but not active in MVP unless explicitly enabled.

### 3. Contributions

Included:

- contribution plans
- one-time contribution
- monthly suggested amount
- half-year suggested amount
- QR payment generation
- payment status
- manual payment confirmation
- CSV bank import placeholder
- payment history
- public aggregated reports

Excluded:

- card payments
- recurring card payments
- Stripe
- automatic bank API integration unless available
- tax donation receipts

### 4. Volunteer tasks

Included:

- create task
- task photo
- description
- deadline
- priority
- claim task
- task lock after claim
- comments
- completion proof
- verification by committee/school
- task status history

Excluded:

- marketplace matching
- complex scheduling
- geolocation
- legal liability workflow

### 5. Feedback

Included:

- QR-accessible form
- category
- class
- type
- anonymous or named
- text feedback
- moderation queue
- status tracking

Excluded:

- voice messages
- speech-to-text
- sentiment analysis
- public comments

### 6. Public transparency

Included:

- total collected
- total spent
- list of expenses
- completed tasks
- realized ideas placeholder
- committee news

Excluded:

- fully automated accounting reports
- donor-level public payment listing
- transparent bank account integration

### 7. Admin panel

Included:

- users
- roles
- classes
- tasks
- feedback moderation
- contributions
- payments
- expenses
- reports
- CSV export

Excluded:

- complex BI
- external accounting integration

### 8. Security and GDPR baseline

Included:

- consent tracking
- audit log
- RBAC
- data minimization
- account deletion request
- privacy page
- terms page
- secure file storage assumptions
- no unnecessary child personal data

Excluded:

- formal DPIA automation
- automated data subject export
- advanced DLP

## SHOULD HAVE

These can be built after MVP if time allows:

- push notifications
- email notification templates
- event calendar
- registration for parent lectures
- child ideas module
- voting
- voice feedback
- speech-to-text
- automatic CSV bank reconciliation
- iCal export
- moderation rules

## FUTURE FEATURES

- multi-school SaaS
- grants module
- sponsorship module
- AI summaries
- AI moderation assistance
- annual reports PDF
- donation matching
- school equipment wishlists
- volunteer skill profiles
- advanced analytics
- integration with Czech payment gateways
- accounting exports
- child-safe idea board

## Explicit MVP cuts

Do not build in MVP:

- direct child accounts
- public discussion threads
- social feeds
- group chat
- private messaging between parents
- full accounting system
- official school communication replacement
- health/special-needs data
- disciplinary data
- exact birth dates of children
- full names of children unless legally reviewed
