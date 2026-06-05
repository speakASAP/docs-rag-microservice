---
name: typeorm-migration
description: Safely generate, validate, and roll back TypeORM migrations for Statex services. Enforces naming convention, revert() implementation, and dry-run before applying. Usage: /typeorm-migration <service-name> <action> [MigrationName]
disable-model-invocation: true
---

Generate, validate, apply, or roll back a TypeORM migration for a Statex microservice.

## Usage

```
/typeorm-migration <service-name> <action> [MigrationName]
```

**Actions:** `generate` | `apply` | `revert` | `status` | `validate`

**Examples:**

- `/typeorm-migration auth-microservice generate AddEmailVerifiedColumn`
- `/typeorm-migration notifications-microservice apply`
- `/typeorm-migration orders-microservice revert`
- `/typeorm-migration payments-microservice status`

---

## Platform detection

```bash
IS_MAC=$([ "$(uname -s)" = "Darwin" ] && echo "true" || echo "false")
GITHUB_DIR=$([ "$IS_MAC" = "true" ] && echo "/Users/sergiystashok/Documents/GitHub" || echo "/home/ssf/Documents/Github")
SERVICE_DIR="$GITHUB_DIR/<service-name>"
```

---

## Action: `status`

Show pending and applied migrations:

```bash
cd $SERVICE_DIR && npx typeorm migration:show -d src/data-source.ts 2>/dev/null \
  || npx typeorm migration:show -d dist/data-source.js 2>/dev/null
```

Output a clear list: ✓ applied, ○ pending.

---

## Action: `validate`

Check all migration files in `src/migrations/` have:

1. **Correct naming** — timestamp prefix, PascalCase name:

   ```bash
   ls $SERVICE_DIR/src/migrations/*.ts 2>/dev/null | grep -v "^\d\{13\}-"
   ```

2. **Non-empty `revert()` method** — never leave it empty:

   ```bash
   grep -A5 "async down" $SERVICE_DIR/src/migrations/*.ts | grep -c "QueryRunner" 
   ```

   Warn on any migration where `down()` only contains `// TODO` or is empty.

3. **No destructive operations without explicit confirmation** — flag any `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE` in migration files.

Report: ✓ or ✗ per check, with file names for failures.

---

## Action: `generate`

**Requires:** `MigrationName` argument (e.g. `AddEmailVerifiedColumn`).

### Step 1: Verify entity changes are saved

```bash
ls -la $SERVICE_DIR/src/**/*.entity.ts 2>/dev/null | head -10
```

### Step 2: Build project first (tsc must pass)

```bash
cd $SERVICE_DIR && npm run build 2>&1 | tail -5
```

Stop if build fails — fix TypeScript errors before generating migrations.

### Step 3: Generate migration

```bash
cd $SERVICE_DIR && npx typeorm migration:generate \
  src/migrations/$(date +%s000)-<MigrationName> \
  -d src/data-source.ts 2>/dev/null \
  || npx typeorm migration:generate \
  src/migrations/$(date +%s000)-<MigrationName> \
  -d dist/data-source.js
```

### Step 4: Review and validate the generated file

Show the generated migration SQL (both `up()` and `down()`).

**Check:**

- Does `down()` correctly reverse `up()`?
- Any `DROP` operations that could lose data?
- Are indexes created for new foreign keys?

Ask the user to confirm before proceeding to apply.

---

## Action: `apply`

**Always dry-run first.**

### Step 1: Show what will run (dry-run)

```bash
cd $SERVICE_DIR && npx typeorm migration:run -d src/data-source.ts --fake 2>/dev/null | head -20
```

Show the user which migrations will be applied.

### Step 2: Ask for confirmation

Tell the user:
> "About to apply the above migrations to the database. This modifies the `<database>` database. Proceed? (yes/no)"

Wait for confirmation.

### Step 3: Apply

```bash
cd $SERVICE_DIR && npx typeorm migration:run -d src/data-source.ts 2>/dev/null \
  || npx typeorm migration:run -d dist/data-source.js
```

### Step 4: Verify

Run `status` action to confirm migrations are now marked as applied.

---

## Action: `revert`

Reverts the most recently applied migration.

### Step 1: Show what will be reverted

Run `status` first to confirm which migration is last.

### Step 2: Ask for confirmation

> "About to revert `<migration-name>`. This will run its `down()` method. Proceed? (yes/no)"

Wait for confirmation.

### Step 3: Revert

```bash
cd $SERVICE_DIR && npx typeorm migration:revert -d src/data-source.ts 2>/dev/null \
  || npx typeorm migration:revert -d dist/data-source.js
```

### Step 4: Verify

Run `status` again to confirm the migration is now pending.

---

## Safety rules (always enforce)

1. **Never run `apply` or `revert` without explicit user confirmation.**
2. **Never run migrations on prod without checking `status` first.**
3. **Warn loudly** on any `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE` in the migration SQL.
4. **If the service is running**, advise restarting it after applying migrations that change schema.
