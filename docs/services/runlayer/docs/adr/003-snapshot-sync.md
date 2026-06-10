# ADR-003: State Snapshot Synchronization

**Status:** Accepted | **Date:** 2026-04-04

## Context

Project state exists in two places:

1. `projects.state_snapshot` (PostgreSQL) — authoritative, consistent
2. `STATE.json` on the project filesystem (via `mcp-filesystem`) — used by coordinators for low-latency reads without DB round-trips

These can diverge if a coordinator writes to DB but crashes before writing `STATE.json`, or vice versa. We need a strategy that keeps them consistent without introducing transactions across PostgreSQL and filesystem.

## Decision

### Single Source of Truth

**PostgreSQL is authoritative.** `STATE.json` is a synced cache — it may lag, but never diverges permanently.

### Write Protocol (Coordinator)

Coordinator cycle always writes in this order:

```
1. Compute new state_snapshot (in-memory)
2. UPDATE projects SET state_snapshot = $patch, state_version = state_version + 1
   WHERE id = $project_id AND state_version = $expected_version  ← optimistic lock
3. If DB write fails (version conflict) → abort cycle, re-read, retry
4. If DB write succeeds → write STATE.json via mcp-filesystem
5. If filesystem write fails → log warning, schedule async retry
   (DB is already consistent; filesystem will self-heal on next cycle)
```

### Debounce Rule

`STATE.json` is updated only on **milestone completion** OR after a **5-minute debounce** of any state changes. This prevents flooding `mcp-filesystem` on high-throughput cycles.

Milestones trigger immediate sync:

- Project stage change
- `health` transitions (ok → warning, warning → critical)
- `blockers` array changes

### Recovery

On each coordinator cycle start:

1. Read `state_version` from DB
2. Read `v` field from `STATE.json` (if present)
3. If `STATE.json` version < DB version → immediately overwrite `STATE.json` from DB snapshot
4. Proceed with cycle using DB as source of truth

This ensures a crashed-before-filesystem-write scenario self-heals on next cycle.

### Optimistic Locking

`state_version` column increments on every write. Concurrent writers see `version conflict` → retry with fresh read. This prevents split-brain writes from two coordinator replicas (reinforces ADR-001 leasing).

## Consequences

- **Positive:** DB is always consistent; filesystem inconsistency self-heals
- **Positive:** No distributed transactions needed
- **Positive:** Coordinator always has a fast local STATE.json after first sync
- **Negative:** There is a window (max 5 min or next cycle) where STATE.json may be stale
- **Negative:** Requires coordinator to implement version-check on startup

## Alternatives Considered

- **Filesystem as primary:** Rejected — filesystem has no transaction guarantees
- **Sync both atomically:** Impossible without distributed transactions; overkill for this scale
- **Skip STATE.json entirely:** Possible but would increase DB load from frequent coordinator reads
