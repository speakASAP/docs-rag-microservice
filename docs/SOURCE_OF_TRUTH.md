# Source of Truth — git, not the RAG

## The rule

**Git is the source of truth for all documentation. The RAG index is a derived,
disposable projection of it.**

Never store documentation only in the RAG. If a doc exists solely as vectors in
Qdrant, it is unrecoverable, unreviewable, and undiffable.

## Why documentation must not live only in the RAG

This was proposed and rejected on 2026-08-23. The reasons are mechanical, not
stylistic:

1. **Ingestion deletes before it writes.** `ingestion.service.ts` purges every
   vector and chunk row for a repo (`deleteByFilter` + `chunkRepo.delete`)
   before re-indexing it. If the markdown is not in git, the first re-ingest of
   an un-backed-up repo destroys the only copy.

2. **Qdrant storage is not backed up.** It lives on a `hostPath` volume
   (`k8s/qdrant-deployment.yaml`), is `.gitignore`d, and `backups-microservice`
   has no Qdrant job — only a mention in `BACKUP_CONSOLIDATION_PLAN.md`. One
   disk failure loses the entire index.

3. **Embeddings are lossy.** Chunks are capped at 400 words / 1800 chars
   (`markdown-chunker.service.ts`). A document cannot be reconstructed from its
   chunks. The index is a pointer to text, not the text.

4. **Git provides what the RAG cannot**: diff, blame, history, PR review, and
   atomic rollback across 40+ services.

**Correct invariant:** deleting all of Qdrant must cost only re-ingestion time.
If it would ever cost information, the architecture has drifted — fix it.

## How drift actually happened (2026-07-16 → 2026-08-23)

The index froze for 38 days while continuing to answer confidently. Chain:

1. Ollama became unreachable (host reboot). Ingestion jobs failed with
   `fetch failed`.
2. `SCHEDULED_INGESTION_ENABLED` was set to `"false"` in the ConfigMap to stop
   the noise — and never re-enabled.
3. 18 jobs stayed stranded in `running`. The up-to-date check reuses the latest
   job per repo, so stranded jobs can independently freeze a repo.
4. Retrieval kept serving the stale index with no staleness signal. It returned
   `shared/.claude/memory/feedback_no_git_commit.md` — a **deleted** file whose
   content ("NEVER run git commit") is the direct opposite of current policy.
5. Separately, `Github/CLAUDE.md` is a symlink to `shared/CLAUDE.md`. The
   directory walker treated symlinks as neither file nor directory, so the
   ecosystem's most authoritative document was never indexed at all.
6. Ollama was throttled to `NanoCpus=50000000` — **0.05 of one core**. Embedding
   requests returned 200 but took 30–53 s each at 5.57 % CPU, so ingestion could
   never finish within any sane window. Raised to 6 CPUs on 2026-08-23; embed
   latency went from 30–53 s to **0.83 s**. This is the original cause of the
   July outage, not a consequence of it.
7. Six registry entries could never resolve. `repoName` doubles as the directory
   name under `/data/repos`, but five working trees are checked out under a
   shorter name than their GitHub repo (`allegro-service` → `allegro`, and the
   same for `aukro`, `bazos`, `flipflop`, `heureka`). They failed every run with
   `ENOENT`, silently hiding **881 markdown files**. `nginx-microservice` was
   retired on 2026-06-17 and only survives as a tarball, so it failed for good.
   Fixed by pointing the five at `localAbsolutePath` and deleting the retired
   entry.

**Lesson:** every one of these was a silent failure. None raised an alert. The
index degraded into confident misinformation, which is worse than an outage —
an outage is visible.

## Guarantees now in place

| Guarantee | Mechanism |
|---|---|
| Scheduler-off is loud | `onModuleInit` logs at **warn** when `SCHEDULED_INGESTION_ENABLED != "true"` |
| Stranded jobs cannot freeze a repo | `failStrandedJobs()` fails `running` jobs at startup, at **error** level |
| Rolling updates cannot strand jobs | `failStaleRunningJobs()` sweeps every 5 min, failing `running` jobs idle past `STALE_RUNNING_JOB_MINUTES` (default 20). The startup reaper alone is not enough: during a rollout the terminating old pod can write a row back to `running` after the new pod has reaped it |
| A repo dir renamed away from its repo name still indexes | Registry entries carry `localAbsolutePath`; ingestion honours it via `getLocalPath` |
| Symlinked docs are indexed | `walkDir` resolves symlinks, dedupes by real path, guards cycles |
| Unreadable git HEAD is visible | `getHeadCommit` logs at **error** before falling back to `unknown` |
| Retrieval failure ≠ empty result | `agentContext` throws `ServiceUnavailableException` instead of returning `context: ''` |
| Weak matches are not dressed as answers | Confidence floor `RAG_CONFIDENT_MATCH_SCORE` (default `0.74`); below it returns `confident: false` + `notice` |

## Reading a response correctly

`confident: false` means **the index could not answer** — go read the repo. It
does not mean "no such thing exists."

A thrown `503` means **the lookup failed**. It is never to be treated as an
empty result. This distinction is the whole point: "not found" and "lookup
failed" must stay distinguishable to the caller.

## Preventing drift

- Docs are committed to git in the repo they describe. The RAG follows.
- Re-ingestion is scheduled (6h). Never disable it to silence errors — fix the
  error. Disabling it is what caused the 38-day outage.
- After changing an authoritative doc, confirm it is retrievable rather than
  assuming: query for a distinctive phrase and check the source path.
- Treat a `confident: false` on a topic you know is documented as an **index
  bug**, not a documentation gap.
- When a repo is renamed or its working tree checked out under a different
  directory name, update `repo-registry.ts` in the same change. A registry entry
  that cannot resolve fails quietly on every run and hides that repo's whole
  documentation set.
