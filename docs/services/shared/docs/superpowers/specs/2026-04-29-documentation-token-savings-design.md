# Documentation Token Savings — Design Spec
**Date:** 2026-04-29
**Scope:** shared/ ecosystem documentation + all 27 per-service CLAUDE.md files
**Approach:** Slim per-service CLAUDE.md (identity card pattern) + selective compression of large Tier 2 docs

---

## Problem

| Issue | Files affected | Estimated token waste |
|---|---|---|
| "Ecosystem defaults + reading order" header duplicated verbatim | 27 service CLAUDE.md files | ~4,000 tokens/session |
| "Quick ops" bash block (3 commands, same pattern) | 27 service CLAUDE.md files | ~2,000 tokens/session |
| `KUBERNETES_SETUP_GUIDE.md` prose-heavy (642 lines) | 1 file, Tier 2 | ~5,000 tokens when loaded |
| `UNIFIED_ECOMMERCE_ARCHITECTURE.md` historical context + mermaid (807 lines) | 1 file, Tier 2 | ~6,500 tokens when loaded |
| `DEPLOY_SCRIPT_RULES.md` repeats DEPLOY_STANDARD.md (107 lines) | 1 file, Tier 2 | ~900 tokens when loaded |

---

## Solution

### Change 1 — Single-line ecosystem header in all service CLAUDE.md files

**Replace** the 6-line boilerplate header block present in all 27 service CLAUDE.md files:
```markdown
Ecosystem defaults: sibling [`../CLAUDE.md`](../CLAUDE.md) and ...
Read this repo's `BUSINESS.md` → `SYSTEM.md` → ...
```

**With** a single line:
```markdown
→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`
```

**Saves:** ~150 tokens × 27 files = ~4,000 tokens per session.

---

### Change 2 — Compress Quick ops to a single line

**Replace** the 5-6 line bash block in every service CLAUDE.md:
```bash
### Quick ops
```bash
curl http://<svc>:PORT/health
kubectl logs -n statex-apps -l app=<svc> -f
./scripts/deploy.sh
kubectl get pods -n statex-apps -l app=<svc>
```
```

**With** a single inline line:
```markdown
**Ops**: `curl http://<svc>:PORT/health` · `kubectl logs -n statex-apps -l app=<svc> -f` · `./scripts/deploy.sh`
```

**Saves:** ~80 tokens × 27 files = ~2,000 tokens per session.

---

### Change 3 — Compress 3 large Tier 2 docs

#### KUBERNETES_SETUP_GUIDE.md (642 → ~200 lines)
- Add "Setup complete — cluster running" notice at top so Claude knows this is reference-only
- Remove all "Flags Explained" and "Verify" prose after each step
- Keep only the commands and section headings
- Keep troubleshoot and operational sections intact (those ARE needed mid-task)

#### UNIFIED_ECOMMERCE_ARCHITECTURE.md (807 → ~150 lines)
- Remove "Current State" section (historical, no longer relevant)
- Remove all mermaid diagrams (architecture is derivable from ECOSYSTEM_MAP.md + service SYSTEM.md files)
- Keep: service responsibilities table, data ownership rules, event bus summary, integration matrix
- Rename to make its scope clear: "E-commerce Service Boundaries Reference"

#### DEPLOY_SCRIPT_RULES.md (107 → ~40 lines)
- Remove Sections 1–6 (prose that duplicates DEPLOY_STANDARD.md)
- Keep: Section 7 checklist + "Do not" list only
- Add a one-line pointer: `→ Full rules: DEPLOY_STANDARD.md`

---

## What does NOT change

- Per-service identity content: purpose, port, domain, stack, critical constraints — these stay in each service CLAUDE.md
- ECOSYSTEM_MAP.md — already well-optimised (~120 lines, dense tables)
- VAULT.md — already compact (56 lines)
- ENV_FILE_STANDARD.md — already compact (40 lines)
- DEPLOY_STANDARD.md — stays as-is (34 lines, the authoritative reference)
- SYSTEM.md per-service files — not in scope (service-specific content)

---

## Service CLAUDE.md target format (identity card pattern)

Every service CLAUDE.md should follow this template after changes:

```markdown
# CLAUDE.md (<service-name>)

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json`

---

## <service-name>

**Purpose**: <one sentence>
**Port**: XXXX **Domain**: `https://<domain>.alfares.cz`
**Stack**: <stack line>

### Key constraints
- <constraint 1 — safety-critical or non-obvious only>
- <constraint 2>

**Ops**: `curl http://<svc>:PORT/health` · `kubectl logs -n statex-apps -l app=<svc> -f` · `./scripts/deploy.sh`
```

Target: 15–22 lines per service CLAUDE.md (down from 30–46).

---

## Expected token savings summary

| Change | Tokens saved per session |
|---|---|
| Single-line header (27 files) | ~4,000 |
| Single-line Quick ops (27 files) | ~2,000 |
| KUBERNETES_SETUP_GUIDE.md compression | ~3,500 (when loaded) |
| UNIFIED_ECOMMERCE_ARCHITECTURE.md compression | ~5,000 (when loaded) |
| DEPLOY_SCRIPT_RULES.md compression | ~550 (when loaded) |
| **Total per-session (always)** | **~6,000** |
| **Total when Tier 2 docs loaded** | **~15,000** |

---

## Change 4 — Skills and MCP guidance in shared/CLAUDE.md

Add a "Skills and MCP — use these to save tokens" section to `shared/CLAUDE.md` (loaded every session). This tells Claude *which skill or MCP tool to reach for* in common situations, preventing reflexive file loading:

| Situation | Tool |
|---|---|
| Debugging | `superpowers:systematic-debugging` |
| Multi-service update | `superpowers:dispatching-parallel-agents` |
| Ready to ship | `superpowers:finishing-a-development-branch` |
| New feature/bugfix | `superpowers:test-driven-development` |
Database access SSOT: [database-server/docs/ARCHITECTURE.md](../../database-server/docs/ARCHITECTURE.md).
| TypeScript errors | `mcp__ide__getDiagnostics` |

This section is ~15 lines and pays for itself in the first session it redirects Claude away from reading 3 SYSTEM.md files to answer a schema question.

---

## Implementation order

1. Add skills/MCP guidance to `shared/CLAUDE.md` (highest ROI — loaded every session)
2. Compress `DEPLOY_SCRIPT_RULES.md` (smallest, standalone)
3. Compress `UNIFIED_ECOMMERCE_ARCHITECTURE.md`
4. Compress `KUBERNETES_SETUP_GUIDE.md`
5. Update all 27 service CLAUDE.md files (header + Quick ops)
6. Verify: spot-check 3 service repos to confirm format consistency
