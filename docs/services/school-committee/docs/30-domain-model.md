# Domain Model

## Tenant

Represents organization boundary.

Fields:

- id
- name
- status

MVP may have one tenant.

## School

Represents one school.

Fields:

- id
- tenant_id
- name
- address optional
- contact_email optional
- status

## Class

Represents class/group.

Fields:

- id
- school_id
- school_year
- grade
- name
- teacher_user_id optional

Example:

```text
1.A, 2.B, 3.C
```

## User

Identity is owned by auth service.

Platform stores domain profile only.

## Profile

Fields:

- user_id
- first_name
- last_name
- phone optional
- language
- participation_type
- onboarding_status
- consent status

## Child

MVP should avoid detailed child profiles.

Recommended fields:

- id
- parent_user_id
- class_id
- display_label optional
- birth_year optional

Avoid:

- full name unless necessary
- exact birth date
- sensitive notes

## Contribution Plan

Suggested payment option.

Examples:

- monthly 200 CZK
- half-year 1000 CZK
- one-time custom

## Payment Intent

Represents expected bank payment.

## Payment

Represents confirmed payment event.

Payment intent and payment may be same entity in MVP.

## Expense

Represents committee spending.

## Task

Represents school/community work item.

## Feedback

Structured message from parent/teacher/staff.

## Idea

Suggestion, usually child-originated or parent-submitted on behalf of child.

## Event

School/community event.

## Audit Log

Immutable record of important actions.
