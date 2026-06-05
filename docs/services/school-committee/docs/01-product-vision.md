# Product Vision

## Problem

Primary schools often depend on parent committees for small but important improvements:

- classroom equipment
- repairs
- events
- cultural activities
- communication between school and parents
- occasional financial contributions
- voluntary work

The current process is usually fragmented:

- WhatsApp groups
- emails
- informal cash collection
- unclear ownership
- repeated questions
- low transparency
- low participation
- overloaded parent representatives

The platform solves this by creating a structured operating system for school-parent cooperation.

## Product goal

Build a mobile-first web platform that simplifies collaboration between:

- school
- parents
- children
- parent committee
- teachers
- school staff

The platform is not only about money. It allows parents to contribute in three ways:

1. Financial contribution
2. Volunteering time/work
3. Proposing and supporting ideas

## Core product promise

> Every parent can participate in a way that is realistic for them, while the school and committee get transparency, accountability and faster execution.

## Key outcomes

### For parents

- understand what is needed
- see where money goes
- contribute without social pressure
- help with tasks instead of paying
- submit feedback easily
- see results

### For the school

- publish practical needs
- receive structured feedback
- get help from parents
- reduce informal communication overhead
- increase parent engagement

### For the parent committee

- manage contributions
- coordinate volunteers
- publish reports
- reduce manual tracking
- create trust

### For children

- safely submit ideas
- participate in school improvement
- see that ideas can become real tasks or funded projects

## Non-goals for MVP

The MVP is not:

- a full school information system
- a replacement for official school communication
- a gradebook
- a student attendance system
- a social network
- a public discussion forum
- a high-risk payment processor
- a system for storing sensitive child data

## Product principles

1. Mobile first.
2. Minimal data collection.
3. Transparent by default.
4. Simple enough for non-technical parents.
5. Safe for children.
6. Designed for legal separation between school and parent committee.
7. Useful even if only 30 percent of parents register.
8. Usable without Stripe.
9. No personal bank account for committee funds.
10. Every operational action should be auditable.

## Languages

Initial supported languages:

- Czech
- English
- Russian
- Ukrainian

Language must be selected during onboarding and changeable later in profile settings.

## Czech context assumptions

- Parents are familiar with QR bank payments.
- Some schools may have informal parent committees.
- A formal legal entity, usually a `zapsaný spolek`, is likely needed for clean ownership of bank account and accounting.
- School cannot hand over parent personal data to the committee.
- Therefore registration is self-service and consent-based.
