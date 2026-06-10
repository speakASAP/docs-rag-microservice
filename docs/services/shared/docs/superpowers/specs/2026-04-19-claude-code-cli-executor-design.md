# Design: Claude Code CLI Executor (ai-microservice endpoint)

**Date:** 2026-04-19  
**Scope:** Add async Claude Code CLI execution to ai-microservice as sibling to `/ai/complete`  
**Integration:** Reuse existing RabbitMQ + DB patterns from runlayer

---

## Architecture

```
runlayer (coordinator)
  └─→ POST /ai/claude-code-execute (ai-microservice)
      ├─ Validate + create job record in DB
      ├─ Enqueue to RabbitMQ
      └─ Return {job_id, status: 'queued'}
          │
          └─ RabbitMQ consumer (in ai-microservice)
             ├─ Dequeue job
             ├─ Create git worktree
             ├─ Run: claude code --repo-path ... --branch ...
             ├─ Capture stdout/stderr/exit_code/diff
             ├─ Run optional validation_script
             └─ Update DB with results
                 │
                 └─ Polling: GET /ai/claude-code-execute/{job_id}
                    └─ Return status + results
```

**Reuse:**
- RabbitMQ (existing queue from orchestrator)
- logging-microservice (log execution events)
- ai-microservice HTTP infrastructure (NestJS)
- Existing DB (postgresql) + schema pattern

---

## API Contract

**POST /ai/claude-code-execute** (Async job creation)

Request:
```json
{
  "task_id": "uuid",
  "repo_path": "/home/ssf/Documents/Github/beauty",
  "branch": "feat/auto-001",
  "instructions": "Add health endpoint",
  "expected_outcome": "GET /health returns 200",
  "timeout_seconds": 300,
  "validation_script": "./scripts/validate.sh"
}
```

Response (201):
```json
{
  "job_id": "job-uuid",
  "task_id": "uuid",
  "status": "queued",
  "created_at": "2026-04-19T16:00:00Z"
}
```

**GET /ai/claude-code-execute/{job_id}** (Polling)

While executing:
```json
{
  "job_id": "job-uuid",
  "status": "executing",
  "started_at": "2026-04-19T16:00:05Z"
}
```

After completion:
```json
{
  "job_id": "job-uuid",
  "status": "success|failed|timeout",
  "exit_code": 0,
  "stdout": "...",
  "stderr": "",
  "git_diff": "diff --git...",
  "validation_passed": true,
  "validation_output": "✓ Health check OK",
  "completed_at": "2026-04-19T16:02:15Z"
}
```

---

## Database Schema

```sql
CREATE TABLE claude_code_jobs (
  job_id VARCHAR(255) PRIMARY KEY,
  task_id UUID NOT NULL,
  
  -- Input
  repo_path TEXT NOT NULL,
  branch VARCHAR(255) NOT NULL,
  instructions TEXT NOT NULL,
  expected_outcome TEXT,
  timeout_seconds INT DEFAULT 300,
  validation_script TEXT,
  
  -- Execution
  status VARCHAR(50) DEFAULT 'queued',  -- queued|executing|success|failed|timeout
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Results
  exit_code INT,
  stdout TEXT,
  stderr TEXT,
  git_diff TEXT,
  validation_passed BOOLEAN,
  validation_output TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX (task_id),
  INDEX (status),
  INDEX (created_at DESC)
);
```

---

## Implementation Phases

**Phase 1 (2 days):** Core
- Endpoint: POST /ai/claude-code-execute (validate, enqueue, create job record)
- Consumer: RabbitMQ listener (execute claude code CLI, capture output, store results)
- Polling: GET /ai/claude-code-execute/{job_id}

**Phase 2 (1 day):** Validation
- Optional validation_script execution
- Logging to logging-microservice
- Metrics (duration, status counts)

**Phase 3 (1 day):** E2E test
- Integration test with runlayer
- Verify task → enqueue → execute → validate → poll flow

---

## Error Handling

| Error | Action |
|-------|--------|
| Invalid repo_path | 400 Bad Request |
| Timeout exceeded | status='timeout', last output captured |
| CLI crash | status='failed', stderr stored |
| Validation script fails | status='success', validation_passed=false |
| RabbitMQ down | 503, orchestrator retries |

---

## Integration Point

**runlayer coordinator** calls this endpoint when a task type is `claude_code_execute`:
1. POST to create job, get job_id
2. Poll GET endpoint until status != 'queued' and != 'executing'
3. Check exit_code + validation_passed
4. If failed, orchestrator can retry (intelligent retry logic from consolidated status)

---

## Success Criteria

✅ Endpoint accepts moderate contract (repo_path, branch, instructions, timeout, validation_script)  
✅ Jobs queued to RabbitMQ immediately  
✅ Consumer executes Claude Code CLI in git worktree  
✅ Results persisted to DB  
✅ Polling endpoint returns job status + results  
✅ Logging integrated with logging-microservice  
✅ E2E test: orchestrator task → successful code execution → validation pass
