# Memory Index

- [NestJS @Cron Fix](project_nestjs_cron_fix.md) — Node.js v22+/v24 + reflect-metadata bug; monkey-patch in main.ts; K8s container name is `app` not `runlayer`
- [Server Command Authorization](feedback_server_commands.md) — Run production commands (curl, docker, runbooks) directly without asking permission
- [Production Server: alfares](project_production_server.md) — All services deploy to ssh alfares / ~/Documents/Github/ / statex is legacy
- [Already on alfares — no SSH needed](feedback_alfares_local.md) — /home/ssf/Documents/Github IS alfares; run docker/curl commands directly, never SSH
- [Nginx Microservice Rule](feedback_nginx_microservice.md) — Never edit nginx-microservice files; fix via service's nginx/ + deploy.sh sed-i post-deploy patch
- [Work Without Confirmations](feedback_no_confirmations.md) — Proceed autonomously; skip approval gates; only ask when genuinely blocked on missing info
- [Save Progress at 80% Context](feedback_context_80_save_progress.md) — After ~80% context fill, write task status to STATE.json/TASKS.md so next session resumes without re-deriving progress
- [No Tasks, No Subagents — Token Savings](feedback_no_tasks_no_subagents.md) — Never use TaskCreate/TaskUpdate or spawn subagents; work inline; use cheapest model for simple tasks
- [Use shared k8s scripts](feedback_k8s_scripts.md) — Always use shared/scripts/k8s-quick.sh, k8s-monitor.sh, k8s-deploy.sh instead of raw kubectl chains
- [Database Access via MCP postgres](feedback_database_access.md) — call postgres_agent_guide first

## Vault: manual unseal required after host reboot
Key at `vault-microservice/.vault-init`. Run: `VAULT_ADDR=http://127.0.0.1:8200 vault operator unseal <key>`

## Phase 2 Deployment Actions (2026-04-19 Evening)
- [Phase 2 Deployment Complete](project_claude_code_executor.md) — Database migrated ✅ | K8s deployed ✅ | Vault awaiting auth | Git protected
