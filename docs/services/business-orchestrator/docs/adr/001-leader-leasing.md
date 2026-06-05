# ADR-001: Leader Leasing for Coordinators

**Status:** Accepted | **Date:** 2026-04-04

## Context

`GlobalCoordinator` and `ProjectCoordinator` must each have exactly one active instance at a time. Multiple replicas may run for HA, but only the leader processes work. Without leasing, two coordinators could process the same project cycle simultaneously, creating duplicate tasks and conflicting state writes.

## Decision

Use **Redis-based leasing** with TTL for coordinator exclusivity.

### Lease Key Structure

```
bo:lease:global                  → GlobalCoordinator leader
bo:lease:coordinator:{project_id} → ProjectCoordinator leader per project
```

### Lease Protocol

1. On coordinator startup: `SET bo:lease:{id} {replica_id} NX PX 60000`
   - `NX` = only if key does not exist
   - `PX 60000` = 60 second TTL
2. If SET succeeds → this replica is the leader; begin cycle
3. Heartbeat: `PEXPIRE bo:lease:{id} 60000` every 15 seconds while alive
4. On graceful shutdown: `DEL bo:lease:{id}` (allows instant failover)
5. On crash: TTL expires within 60 seconds; new replica claims lease on next attempt

### Lease Token Check on State Writes

All state writes to PostgreSQL include the lease token as a validation step:

- Check Redis lease still held before committing `state_snapshot` update
- If lease lost mid-cycle → rollback, log `STALE_LEADER_WRITE`, discard cycle output

### Failover Guarantee

- Max failover time = lease TTL = 60 seconds
- Acceptable for Phase 1-2; reduce to 30s in Phase 3 if needed

## Consequences

- **Positive:** Simple, uses existing Redis; no Zookeeper/etcd dependency
- **Positive:** Failure is safe (TTL ensures eventual release)
- **Negative:** Coordinator processes are blocked during failover window (≤60s)
- **Negative:** Redis must be available; add Redis Sentinel in Phase 3

## Alternatives Considered

- **PostgreSQL advisory locks:** Heavier; couples lease lifetime to DB connection
- **Kubernetes leader election:** Overkill for current scale; revisit Phase 3
