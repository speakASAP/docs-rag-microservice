# ERD and Database Schema

This schema is logical. Physical implementation is owned by the DB microservice.

## Core tables

```sql
create table tenants (
  id uuid primary key,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table schools (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  name text not null,
  address text,
  contact_email text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table classes (
  id uuid primary key,
  school_id uuid not null references schools(id),
  school_year text not null,
  grade text not null,
  name text not null,
  teacher_user_id uuid,
  created_at timestamptz not null default now()
);
```

## Profiles

```sql
create table profiles (
  user_id uuid primary key,
  tenant_id uuid not null references tenants(id),
  school_id uuid not null references schools(id),
  first_name text not null,
  last_name text not null,
  phone text,
  language text not null default 'cs',
  participation_type text not null check (participation_type in ('financial', 'labor', 'mixed')),
  onboarding_status text not null default 'incomplete',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Children

```sql
create table children (
  id uuid primary key,
  parent_user_id uuid not null,
  school_id uuid not null references schools(id),
  class_id uuid not null references classes(id),
  display_label text,
  birth_year integer,
  parent_consent boolean not null default true,
  created_at timestamptz not null default now()
);
```

## Roles

```sql
create table user_roles (
  id uuid primary key,
  user_id uuid not null,
  tenant_id uuid not null references tenants(id),
  school_id uuid references schools(id),
  role text not null check (role in ('parent', 'committee', 'teacher', 'school_staff', 'admin')),
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz
);
```

## Contributions and payments

```sql
create table contribution_plans (
  id uuid primary key,
  school_id uuid not null references schools(id),
  name text not null,
  amount_czk integer not null check (amount_czk > 0),
  period text not null check (period in ('monthly', 'half_year', 'one_time')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table payment_intents (
  id uuid primary key,
  school_id uuid not null references schools(id),
  user_id uuid not null,
  plan_id uuid references contribution_plans(id),
  amount_czk integer not null check (amount_czk > 0),
  currency text not null default 'CZK',
  variable_symbol text not null unique,
  message text,
  status text not null check (status in ('pending', 'paid', 'cancelled', 'expired', 'manually_corrected')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  paid_at timestamptz
);

create table payment_reconciliation_events (
  id uuid primary key,
  payment_intent_id uuid references payment_intents(id),
  source text not null check (source in ('manual', 'csv_import', 'webhook')),
  amount_czk integer not null,
  variable_symbol text,
  bank_transaction_id text,
  raw_reference text,
  matched_by text,
  created_by uuid,
  created_at timestamptz not null default now()
);
```

## Expenses

```sql
create table expenses (
  id uuid primary key,
  school_id uuid not null references schools(id),
  title text not null,
  description text,
  category text not null,
  amount_czk integer not null check (amount_czk > 0),
  spent_at date not null,
  receipt_file_id uuid,
  public_visible boolean not null default false,
  created_by uuid not null,
  approved_by uuid,
  created_at timestamptz not null default now()
);
```

## Tasks

```sql
create table tasks (
  id uuid primary key,
  school_id uuid not null references schools(id),
  class_id uuid references classes(id),
  title text not null,
  description text not null,
  photo_file_id uuid,
  deadline date,
  priority text not null check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null check (status in ('open', 'reserved', 'in_progress', 'done', 'verified', 'cancelled')),
  created_by uuid not null,
  assigned_to uuid,
  verified_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_comments (
  id uuid primary key,
  task_id uuid not null references tasks(id),
  user_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table task_status_events (
  id uuid primary key,
  task_id uuid not null references tasks(id),
  old_status text,
  new_status text not null,
  actor_user_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);
```

## Feedback

```sql
create table feedback_items (
  id uuid primary key,
  school_id uuid not null references schools(id),
  class_id uuid references classes(id),
  user_id uuid,
  is_anonymous boolean not null default false,
  category text not null,
  type text not null check (type in ('idea', 'complaint', 'suggestion', 'thanks')),
  text text not null,
  status text not null check (status in ('new', 'in_review', 'assigned', 'resolved', 'rejected')),
  moderated_by uuid,
  assigned_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Ideas

```sql
create table ideas (
  id uuid primary key,
  school_id uuid not null references schools(id),
  class_id uuid references classes(id),
  submitted_by uuid,
  title text not null,
  description text not null,
  budget_needed_czk integer,
  status text not null check (status in ('submitted', 'approved', 'voting', 'funding', 'converted_to_task', 'realized', 'rejected')),
  created_at timestamptz not null default now()
);

create table idea_votes (
  id uuid primary key,
  idea_id uuid not null references ideas(id),
  user_id uuid not null,
  vote_type text not null default 'support',
  created_at timestamptz not null default now(),
  unique (idea_id, user_id)
);
```

## Events

```sql
create table events (
  id uuid primary key,
  school_id uuid not null references schools(id),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  capacity integer,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table event_registrations (
  id uuid primary key,
  event_id uuid not null references events(id),
  user_id uuid not null,
  status text not null check (status in ('registered', 'cancelled', 'attended')),
  created_at timestamptz not null default now(),
  unique(event_id, user_id)
);
```

## Audit logs

```sql
create table audit_logs (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  school_id uuid references schools(id),
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  ip_hash text,
  created_at timestamptz not null default now()
);
```
