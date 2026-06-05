# Environment Variables Synchronization System

A comprehensive system for managing and synchronizing `.env` files across multiple development and production servers.

## Overview

This system provides tools to:
- **Compare** `.env` files across different servers to identify differences
- **Synchronize** variables while preserving environment-specific values (domains, secrets)
- **Track** which settings need attention across environments

## Architecture

The system manages `.env` files across three locations:
1. **LOCAL** - Development server: `/Users/sergiystashok/Documents/GitHub`
2. **STATEX** - Production server: `ssh alfares` → `/home/statex`
3. **SGIPREAL** - Production server: `ssh sgipreal` → `/home/sgipreal`

## Tools

### 1. `compare-env.sh` - Comparison Tool

Shows differences between `.env` files across all servers.

**Usage:**
```bash
./scripts/compare-env.sh
```

**Output:**
- ✅ Variables that match (excluding domain differences)
- ⚠️ Variables with different values (needs attention)
- ✗ Missing variables
- ✓ Domain-specific differences (expected, shown for reference)

**Example Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project: crypto-ai-agent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Different Values (non-domain):
  ⚠ API_PORT
    LOCAL:    3102
    STATEX:   3102
    SGIPREAL: 3103

Domain-Specific Differences (expected):
  ✓ DOMAIN (domain-specific)
    LOCAL:    crypto-ai-agent.alfares.cz
    STATEX:   crypto-ai-agent.alfares.cz
    SGIPREAL: crypto-ai-agent.sgipreal.cz
```

### 2. `sync-env-intelligent.sh` - Intelligent Synchronization

Syncs variables from LOCAL to production servers while preserving:
- **Domain-specific variables** (DOMAIN, SERVICE_NAME, etc.)
- **Secret variables** (passwords, API keys, etc.)
- **Existing domain values** on target servers

**Usage:**
```bash
# Sync all projects (with confirmation)
./scripts/sync-env-intelligent.sh

# Sync specific project (no confirmation)
./scripts/sync-env-intelligent.sh crypto-ai-agent

# Dry-run mode (preview changes without applying)
./scripts/sync-env-intelligent.sh --dry-run
./scripts/sync-env-intelligent.sh --dry-run crypto-ai-agent
```

**What it does:**
1. Reads variables from LOCAL `.env` file
2. For each variable:
   - If it's a **secret** and target already has a value → **Skip** (preserve existing)
   - If it's **domain-specific** and target already has a value → **Skip** (preserve existing)
   - If it's **missing** on target → **Add** it
   - If it's **different** and not secret/domain → **Update** it

**Safety Features:**
- Never overwrites secrets
- Never overwrites domain-specific values
- Requires confirmation before syncing all projects
- Shows summary of changes (added/updated/skipped)
- **Automatic backups** created before syncing (`.env.backup.YYYYMMDD_HHMMSS`)
- **Dry-run mode** (`--dry-run` flag) to preview changes
- **Improved error handling** for SSH connection failures

### 3. `env-sync-config.sh` - Configuration

Defines which variables should be preserved per environment.

**Customization:**
Edit this file to add more variables to preserve:

```bash
# Add more domain-specific variables
export DOMAIN_VARS="DOMAIN SERVICE_NAME FRONTEND_URL YOUR_NEW_VAR"

# Add more secret variables
export SECRET_VARS="SECRET_KEY JWT_SECRET YOUR_SECRET_VAR"
```

## Best Practices

### 1. Regular Comparison

Run comparison regularly to catch drift:
```bash
./scripts/compare-env.sh > env-diff-report.txt
```

### 2. Sync After Adding New Variables

When you add a new variable to LOCAL `.env`:
```bash
# 1. Compare first to see what's missing
./scripts/compare-env.sh

# 2. Sync to propagate the new variable
./scripts/sync-env-intelligent.sh <project-name>
```

### 3. Domain-Specific Values

Domain-specific variables are automatically preserved. Examples:
- `DOMAIN=crypto-ai-agent.alfares.cz` (on statex)
- `DOMAIN=crypto-ai-agent.sgipreal.cz` (on sgipreal)

These will never be overwritten during sync.

### 4. Secret Management

Secrets are never synced. Each server maintains its own:
- Database passwords
- API keys
- JWT secrets
- Other sensitive credentials

### 5. Workflow

**When adding a new environment variable:**

1. Add it to LOCAL `.env` file
2. Run comparison: `./scripts/compare-env.sh`
3. Sync to production: `./scripts/sync-env-intelligent.sh <project>`
4. Manually set domain-specific values on each server if needed
5. Manually set secret values on each server

**When updating an existing variable:**

1. Update LOCAL `.env` file
2. Run comparison to see differences
3. Sync if it's not a secret/domain variable
4. For secrets/domains, update manually on each server

## Variable Categories

### Domain-Specific Variables
These are automatically preserved per server:
- `DOMAIN` - Service domain name
- `SERVICE_NAME` - Service identifier
- `FRONTEND_URL` - Frontend application URL
- `CORS_ORIGINS` - CORS allowed origins
- `NEXT_PUBLIC_API_URL` - Public API URL
- `NEXT_PUBLIC_WS_URL` - WebSocket URL

### Secret Variables
These are never synced (preserved on each server):
- `SECRET_KEY` - Application secret key
- `JWT_SECRET` - JWT signing secret
- `DB_PASSWORD` - Database password
- `REDIS_PASSWORD` - Redis password
- `PAYMENT_API_KEY` - Payment service API key
- `NEWS_API_KEY` - News API key
- `OPENROUTER_API_KEY` - OpenRouter API key
- `GEMINI_API_KEY` - Gemini API key
- `DATABASE_URL` - Full database connection string (contains password)
- `REDIS_URL` - Full Redis connection string (may contain password)

### Regular Variables
These are synced normally:
- Port configurations
- Timeout settings
- Feature flags
- Cache durations
- Other non-sensitive configuration

## Troubleshooting

### SSH Connection Issues

Ensure SSH access is configured:
```bash
# Test connections
ssh alfares "echo 'Connected to statex'"
ssh sgipreal "echo 'Connected to sgipreal'"
```

### Permission Issues

Ensure scripts are executable:
```bash
chmod +x scripts/compare-env.sh
chmod +x scripts/sync-env-intelligent.sh
```

### Missing Variables

If a variable is missing after sync:
1. Check if it's in the SECRET_VARS or DOMAIN_VARS list
2. If it should be synced, remove it from those lists in `env-sync-config.sh`
3. Re-run sync

### Domain Values Not Preserved

If domain values are being overwritten:
1. Add the variable to DOMAIN_VARS in `env-sync-config.sh`
2. Re-run sync

## Integration with Existing Scripts

This system works alongside:
- `sync-all-env.sh` - Ensures all servers have all `.env` files
- `sync-env-example.sh` - Syncs `.env` to `.env.example` (removes values)

**Recommended workflow:**
1. Use `sync-all-env.sh` to ensure files exist everywhere
2. Use `compare-env.sh` to see differences
3. Use `sync-env-intelligent.sh` to sync variables
4. Use `sync-env-example.sh` to update `.env.example` files

## Security Notes

- **Never commit `.env` files** to git
- **Never sync secrets** - they are automatically preserved
- **Review changes** before syncing to production
- **Backup `.env` files** before major syncs (scripts create backups automatically)

## Examples

### Example 1: Adding a New Configuration Variable

```bash
# 1. Add to LOCAL .env
echo "NEW_FEATURE_ENABLED=true" >> crypto-ai-agent/.env

# 2. Compare to see it's missing on production
./scripts/compare-env.sh | grep NEW_FEATURE_ENABLED

# 3. Sync to add it to production
./scripts/sync-env-intelligent.sh crypto-ai-agent
```

### Example 2: Updating a Port Configuration

```bash
# 1. Update LOCAL .env
sed -i '' 's/API_PORT=3102/API_PORT=3103/' crypto-ai-agent/.env

# 2. Compare to see the difference
./scripts/compare-env.sh | grep API_PORT

# 3. Sync to update on production
./scripts/sync-env-intelligent.sh crypto-ai-agent
```

### Example 3: Domain-Specific Variable (Not Synced)

```bash
# DOMAIN is domain-specific, so it won't be synced
# Each server keeps its own value:
# - statex: DOMAIN=crypto-ai-agent.alfares.cz
# - sgipreal: DOMAIN=crypto-ai-agent.sgipreal.cz

# If you need to update domain, do it manually on each server
ssh alfares "sed -i 's/DOMAIN=.*/DOMAIN=new-domain.alfares.cz/' crypto-ai-agent/.env"
ssh sgipreal "sed -i 's/DOMAIN=.*/DOMAIN=new-domain.sgipreal.cz/' crypto-ai-agent/.env"
```

## Recent Enhancements

✅ **Completed:**
- ✅ Dry-run mode (`--dry-run` flag) to preview changes
- ✅ Automatic backup creation before sync operations
- ✅ Improved error handling for SSH connection failures
- ✅ Better connection timeout handling
- ✅ Quick reference guide (`ENV_SYNC_QUICK_REFERENCE.md`)

## Future Enhancements

Potential improvements:
- [ ] Interactive mode to choose which variables to sync
- [ ] Integration with deployment scripts
- [ ] Web UI for comparison and sync
- [ ] Automatic detection of domain patterns
- [ ] Support for more servers
- [ ] Email notifications for sync operations
