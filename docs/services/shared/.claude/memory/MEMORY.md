# Memory Index

- [NestJS @Cron Fix](project_nestjs_cron_fix.md) — Node.js v22+/v24 + reflect-metadata bug; monkey-patch in main.ts; K8s container name is `app` not `runlayer`
- [Server Command Authorization](feedback_server_commands.md) — Run production commands (curl, docker, runbooks) directly without asking permission
- [Production Server: alfares](project_production_server.md) — All services deploy to ssh alfares / ~/Documents/Github/ / statex is legacy
- [Cursor IDE Delegation Workflow](feedback_cursor_workflow.md) — Simple tasks → write Cursor prompt file; complex tasks only → Claude Code handles directly
- [No Git Commit or Push](feedback_no_git_commit.md) — Never run git commit/push; ask user in chat with suggested message and wait
- [Already on alfares — no SSH needed](feedback_alfares_local.md) — /home/ssf/Documents/Github IS alfares; run docker/curl commands directly, never SSH
- [Nginx Microservice Rule](feedback_nginx_microservice.md) — Never edit nginx-microservice files; fix via service's nginx/ + deploy.sh sed-i post-deploy patch
- [Orchestrator Delegation Workflow](feedback_orchestrator_delegation.md) — Write paired AGENT/AGENTV prompt files for Cursor; Claude Code is validator sync gate only — never write implementation code directly
- [Work Without Confirmations](feedback_no_confirmations.md) — Proceed autonomously; skip approval gates; only ask when genuinely blocked on missing info
- [Save Progress at 80% Context](feedback_context_80_save_progress.md) — After ~80% context fill, write task status to STATE.json/TASKS.md so next session resumes without re-deriving progress
- [No Tasks, No Subagents — Token Savings](feedback_no_tasks_no_subagents.md) — Never use TaskCreate/TaskUpdate or spawn subagents; work inline; use cheapest model for simple tasks
- [Use shared k8s scripts](feedback_k8s_scripts.md) — Always use shared/scripts/k8s-quick.sh, k8s-monitor.sh, k8s-deploy.sh instead of raw kubectl chains
- [Database Access via MCP postgres](feedback_database_access.md) — call postgres_agent_guide first; see shared/docs/mcp/MCP_POSTGRES.md
- [GitHub Issue Tracking](feedback_github_issue_tracking.md) — Create GH issue for EVERY task before coding; cross-link related issues; post decisions; close on done; wiki for public repo docs

- [AI Agent Refactor (2026-05-26)](project_agent_refactor_2026_05_26.md) — 3 items: JSON contracts (#19 BO), Claude-only routing (#1 ai-ms), AWAITING_USER status (#18 BO); plans written, none started
- [3 New Services Onboarded (2026-05-30)](project_new_services_2026_05_30.md) — monitoring:3395/3396 ✅ full; backups:3398 ✅ scaffold; docs-rag:3397 ✅ scaffold; all in K8s

## Vault: manual unseal required after host reboot
Key at `vault-microservice/.vault-init`. Run: `VAULT_ADDR=http://127.0.0.1:8200 vault operator unseal <key>`

## Phase 2 Deployment Actions (2026-04-19 Evening)
- [Phase 2 Deployment Complete](project_claude_code_executor.md) — Database migrated ✅ | K8s deployed ✅ | Vault awaiting auth | Git protected
