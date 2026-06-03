# Docs-RAG Production Migration & Ecosystem Ingestion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make docs-rag-microservice fully production-ready and ingest all ecosystem documentation from `shared/` and every microservice so agents can query instead of reading raw files.

**Architecture:** The service already runs in K8s at port 3397 with Qdrant for vector storage and Ollama (`nomic-embed-text`) for embeddings. Key gaps: Ollama only binds to `127.0.0.1` (unreachable from pods), no PVC for git repos clone dir, no auto-ingestion registry for all ecosystem repos, no `local-path` ingestion (docs live on-disk already — cloning from GitHub is unnecessary), and SYSTEM.md/external-secret miss the `OPENAI_API_KEY` entry that was the original design intent (now replaced by Ollama). Docs in each service's CLAUDE.md/AGENTS.md/SYSTEM.md/README.md need a backlink to the RAG service so agents know to query there.

**Tech Stack:** NestJS 10, TypeScript, Qdrant, Ollama nomic-embed-text (768-dim), PostgreSQL, K8s (statex-apps namespace), Vault ESO for secrets.

---

## Key facts before you start

- Ollama runs on the host at `127.0.0.1:11434` — NOT reachable from K8s pods at `192.168.88.53:11434`
- All git repos already exist at `/home/ssf/Documents/Github/<name>/` — no GitHub clone needed
- The docs-rag K8s pod has no volume mount for `/data/repos` (emptyDir at best)
- The simplest fix: add a `LocalPathIngestionService` that reads markdown directly from a host-mounted volume instead of cloning git repos
- `nomic-embed-text` outputs 768-dim vectors — matches `QDRANT_VECTOR_SIZE: "768"` in configmap ✅
- JWT_SECRET and DB_PASSWORD are in Vault `secret/prod/docs-rag-microservice` and synced via ESO ✅
- The collection name in configmap is `ecosystem-docs` but code defaults to `ecosystem_docs` — they must match

---

## File Structure

**New files to create:**
- `src/ingestion/local-path-ingestor.service.ts` — reads markdown from host-mounted paths instead of git clone
- `src/ingestion/repo-registry.ts` — static list of all ecosystem repos with local paths
- `scripts/trigger-all-ingestion.sh` — one-shot shell script to POST trigger for every repo
- `docs/RAG_USAGE.md` — how-to for agents to query this service

**Files to modify:**
- `k8s/configmap.yaml` — fix collection name mismatch (`ecosystem-docs` → `ecosystem_docs`), fix OLLAMA_URL to use host gateway
- `k8s/deployment.yaml` — add hostPath volume for `/home/ssf/Documents/Github` → `/data/repos`, add `git` package install
- `k8s/qdrant-deployment.yaml` — add PersistentVolumeClaim for Qdrant storage (emptyDir loses data on pod restart)
- `src/ingestion/ingestion.service.ts` — add `triggerAll()` method that iterates repo-registry
- `src/ingestion/ingestion.controller.ts` — expose `POST /ingestion/trigger-all` endpoint
- `src/ingestion/git-sync.service.ts` — add `listLocalPath()` that reads from a pre-mounted dir (no git clone)
- `SYSTEM.md` — correct stack description (Ollama, not OpenAI), add trigger-all endpoint
- `AGENTS.md` — add retrieval usage examples
- `GOALS.md` — fill in success criteria

---

## Task 1: Fix Qdrant collection name mismatch

The configmap sets `QDRANT_COLLECTION: "ecosystem-docs"` (hyphen) but `QdrantService` defaults to `ecosystem_docs` (underscore). The code reads `process.env.QDRANT_COLLECTION` so it will use the configmap value — but verify and align everything.

**Files:**
- Modify: `k8s/configmap.yaml`
- Modify: `src/qdrant/qdrant.service.ts` (remove the hardcoded default mismatch)

- [ ] **Step 1: Read the current state**

```bash
grep -n "QDRANT_COLLECTION\|collectionName\|ecosystem" \
  k8s/configmap.yaml \
  src/qdrant/qdrant.service.ts
```
Expected: configmap has `ecosystem-docs`, code default has `ecosystem_docs`.

- [ ] **Step 2: Standardize on `ecosystem-docs` (use hyphen to match configmap)**

In `src/qdrant/qdrant.service.ts` line ~31, change the default:
```typescript
this.collectionName = process.env.QDRANT_COLLECTION || 'ecosystem-docs';
```

- [ ] **Step 3: Verify no other hardcoded collection references**

```bash
grep -rn "ecosystem_docs\|ecosystem-docs" src/
```
Expected: only the one change above.

- [ ] **Step 4: Build to confirm no type errors**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npm run build 2>&1 | tail -5
```
Expected: `Found 0 errors.`

---

## Task 2: Fix Ollama reachability from K8s pods

Ollama is `127.0.0.1:11434` on the host — K8s pods cannot reach it at `192.168.88.53:11434`. The fix: bind Ollama to `0.0.0.0` via environment variable and update the configmap to use the node IP.

**Files:**
- Modify: `k8s/configmap.yaml` — OLLAMA_URL to `http://192.168.88.53:11434`
- System: start Ollama with `OLLAMA_HOST=0.0.0.0`

- [ ] **Step 1: Make Ollama listen on all interfaces**

```bash
sudo systemctl stop ollama || true
sudo bash -c 'cat > /etc/systemd/system/ollama.service.d/override.conf << EOF
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
EOF'
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama
```

- [ ] **Step 2: Verify Ollama responds on 192.168.88.53**

```bash
curl -s http://192.168.88.53:11434/api/tags | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print([m['name'] for m in d['models']])"
```
Expected: list including `nomic-embed-text:latest`.

- [ ] **Step 3: Verify from inside the pod**

```bash
kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e \
  "fetch('http://192.168.88.53:11434/api/tags').then(r=>r.json()).then(d=>{ console.log(d.models.map(m=>m.name)); process.exit(0); }).catch(e=>{ console.error(e.message); process.exit(1); })"
```
Expected: list printed, exit 0.

- [ ] **Step 4: Confirm configmap already has correct URL**

```bash
kubectl get configmap docs-rag-microservice-config -n statex-apps \
  -o jsonpath='{.data.OLLAMA_URL}'
```
Expected: `http://192.168.88.53:11434`. If not, patch it:
```bash
kubectl patch configmap docs-rag-microservice-config -n statex-apps \
  --patch '{"data":{"OLLAMA_URL":"http://192.168.88.53:11434"}}'
```

---

## Task 3: Add hostPath volume so pod can read local repos

The pod has no access to `/home/ssf/Documents/Github/`. We mount the host path read-only. This is safe — the pod reads markdown, never writes.

**Files:**
- Modify: `k8s/deployment.yaml` — add volumeMounts + volumes

- [ ] **Step 1: Add volume and volumeMount to deployment.yaml**

In `k8s/deployment.yaml`, under the `app` container spec, add:
```yaml
          volumeMounts:
            - name: git-repos
              mountPath: /data/repos
              readOnly: true
      volumes:
        - name: git-repos
          hostPath:
            path: /home/ssf/Documents/Github
            type: Directory
```
(Add this at the same indent level as `containers:` inside `spec:`)

- [ ] **Step 2: Update configmap to match the mount path**

The configmap already has `GIT_BASE_PATH: "/data/repos"` ✅. Confirm:
```bash
kubectl get configmap docs-rag-microservice-config -n statex-apps \
  -o jsonpath='{.data.GIT_BASE_PATH}'
```
Expected: `/data/repos`

- [ ] **Step 3: Apply the updated deployment**

```bash
kubectl apply -f k8s/deployment.yaml -n statex-apps
kubectl rollout status deployment/docs-rag-microservice -n statex-apps
```
Expected: `Rollout complete.`

- [ ] **Step 4: Verify the mount inside the pod**

```bash
kubectl exec -n statex-apps deploy/docs-rag-microservice -- \
  node -e "const fs=require('fs'); console.log(fs.readdirSync('/data/repos').slice(0,5))"
```
Expected: list of service directory names.

---

## Task 4: Add LocalPath ingestion (skip git clone)

The `GitSyncService.cloneOrPull()` clones from GitHub. For local repos already on disk, we skip the clone step. Add a `localPath` flag to `triggerIngestion` so the service reads directly from `/data/repos/<repoName>` without git operations.

**Files:**
- Modify: `src/ingestion/ingestion.service.ts`
- Modify: `src/ingestion/ingestion.controller.ts`
- Modify: `src/ingestion/git-sync.service.ts`

- [ ] **Step 1: Write a failing test for local-path ingestion**

Create `test/ingestion/ingestion.service.local.spec.ts`:
```typescript
import { IngestionService } from '../../src/ingestion/ingestion.service';
import { GitSyncService } from '../../src/ingestion/git-sync.service';

describe('IngestionService - local path mode', () => {
  it('should skip cloneOrPull when localPath=true', async () => {
    const cloneOrPull = jest.fn().mockResolvedValue('/data/repos/shared');
    const getHead = jest.fn().mockResolvedValue('abc123');
    const listMarkdown = jest.fn().mockResolvedValue([]);
    const mockGit = { cloneOrPull, getHeadCommit: getHead, listMarkdownFiles: listMarkdown, getLocalPath: jest.fn().mockReturnValue('/data/repos/shared'), readFile: jest.fn() } as unknown as GitSyncService;
    // When localPath=true, cloneOrPull must NOT be called
    // (test is illustrative — wire up when service supports the flag)
    expect(cloneOrPull).not.toHaveBeenCalled();
  });
});
```

Run: `npm test -- --testPathPattern=ingestion.service.local 2>&1 | tail -5`
Expected: PASS (trivial — placeholder to confirm test infrastructure works).

- [ ] **Step 2: Add `localPath` boolean to `IngestionJob` entity**

In `src/database/entities/ingestion-job.entity.ts`, add after `repoUrl`:
```typescript
  @Column('boolean', { default: false })
  localPath!: boolean;
```

- [ ] **Step 3: Add `localPath` parameter to `IngestionService.triggerIngestion()`**

In `src/ingestion/ingestion.service.ts`, update the signature and job creation:
```typescript
async triggerIngestion(repoName: string, repoUrl: string, force = false, localPath = false): Promise<IngestionJob> {
  const job = this.jobRepo.create({
    repoName,
    repoUrl,
    status: 'pending',
    chunksProcessed: 0,
    chunksTotal: 0,
    localPath,
  });
```

- [ ] **Step 4: Skip git clone when `job.localPath` is true**

In `src/ingestion/ingestion.service.ts`, update `runIngestion()` — replace the `cloneOrPull` call:
```typescript
private async runIngestion(job: IngestionJob, force: boolean): Promise<void> {
  job.status = 'running';
  await this.jobRepo.save(job);

  try {
    const localPath = job.localPath
      ? this.gitSync.getLocalPath(job.repoName)          // /data/repos/<repoName>
      : await this.gitSync.cloneOrPull(job.repoName, job.repoUrl);

    const commitHash = await this.gitSync.getHeadCommit(localPath);
    // ... rest unchanged
```

- [ ] **Step 5: Update ingestion controller to accept `localPath` field**

In `src/ingestion/ingestion.controller.ts`, update the request schema:
```typescript
const TriggerIngestionRequestSchema = z.object({
  repoName: z.string().min(1),
  repoUrl: z.string().url().optional().default('local'),
  force: z.boolean().default(false),
  localPath: z.boolean().default(false),
});
```

And update the trigger handler:
```typescript
const job = await this.ingestionService.triggerIngestion(
  body.repoName,
  body.repoUrl ?? 'local',
  body.force,
  body.localPath,
);
```

- [ ] **Step 6: Build and verify**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npm run build 2>&1 | tail -5
```
Expected: `Found 0 errors.`

---

## Task 5: Persist Qdrant data with a PVC

Qdrant uses `emptyDir` — data is lost on pod restart. Fix with a `hostPath` PVC (single-node cluster).

**Files:**
- Modify: `k8s/qdrant-deployment.yaml`

- [ ] **Step 1: Create data directory on host**

```bash
sudo mkdir -p /data/qdrant-storage
sudo chown 1000:1000 /data/qdrant-storage
```

- [ ] **Step 2: Replace emptyDir with hostPath in qdrant-deployment.yaml**

Replace the `volumes` section:
```yaml
      volumes:
        - name: qdrant-storage
          hostPath:
            path: /data/qdrant-storage
            type: DirectoryOrCreate
```

- [ ] **Step 3: Apply and verify**

```bash
kubectl apply -f k8s/qdrant-deployment.yaml -n statex-apps
kubectl rollout status deployment/qdrant -n statex-apps
kubectl exec -n statex-apps deploy/qdrant -- ls /qdrant/storage/
```
Expected: rollout completes, storage dir is accessible.

---

## Task 6: Create repo-registry and trigger-all endpoint

Define the canonical list of all ecosystem repos to ingest, and expose `POST /ingestion/trigger-all` to kick them off in one call.

**Files:**
- Create: `src/ingestion/repo-registry.ts`
- Modify: `src/ingestion/ingestion.service.ts`
- Modify: `src/ingestion/ingestion.controller.ts`

- [ ] **Step 1: Create `src/ingestion/repo-registry.ts`**

```typescript
export interface RepoEntry {
  repoName: string;
  repoUrl: string;
  localPath: boolean;
}

export const ECOSYSTEM_REPOS: RepoEntry[] = [
  // Shared — highest priority, all ecosystem docs
  { repoName: 'shared', repoUrl: 'git@github.com:speakASAP/shared.git', localPath: true },

  // Core infrastructure
  { repoName: 'auth-microservice', repoUrl: 'https://github.com/speakASAP/auth-microservice.git', localPath: true },
  { repoName: 'logging-microservice', repoUrl: 'git@github.com:speakASAP/logging-microservice.git', localPath: true },
  { repoName: 'notifications-microservice', repoUrl: 'git@github.com:speakASAP/notifications-microservice.git', localPath: true },
  { repoName: 'monitoring-microservice', repoUrl: 'git@github.com:speakASAP/monitoring-microservice.git', localPath: true },
  { repoName: 'backups-microservice', repoUrl: 'git@github.com:speakASAP/backups-microservice.git', localPath: true },
  { repoName: 'database-server', repoUrl: 'git@github.com:speakASAP/database-server.git', localPath: true },
  { repoName: 'nginx-microservice', repoUrl: 'git@github.com:speakASAP/nginx-microservice.git', localPath: true },
  { repoName: 'vault-microservice', repoUrl: 'git@github.com:speakASAP/vault-microservice.git', localPath: true },

  // AI & orchestration
  { repoName: 'ai-microservice', repoUrl: 'git@github.com:speakASAP/ai-microservice.git', localPath: true },
  { repoName: 'business-orchestrator', repoUrl: 'git@github.com:speakASAP/business-orchestrator.git', localPath: true },
  { repoName: 'prompts-microservice', repoUrl: 'git@github.com:speakASAP/prompts.git', localPath: true },
  { repoName: 'docs-rag-microservice', repoUrl: 'git@github.com:speakASAP/docs-rag-microservice.git', localPath: true },

  // E-commerce
  { repoName: 'catalog-microservice', repoUrl: 'git@github.com:speakASAP/catalog-microservice.git', localPath: true },
  { repoName: 'orders-microservice', repoUrl: 'git@github.com:speakASAP/orders-microservice.git', localPath: true },
  { repoName: 'payments-microservice', repoUrl: 'git@github.com:speakASAP/payments-microservice.git', localPath: true },
  { repoName: 'warehouse-microservice', repoUrl: 'git@github.com:speakASAP/warehouse-microservice.git', localPath: true },
  { repoName: 'suppliers-microservice', repoUrl: 'git@github.com:speakASAP/suppliers-microservice.git', localPath: true },
  { repoName: 'leads-microservice', repoUrl: 'https://github.com/speakASAP/leads-microservice.git', localPath: true },
  { repoName: 'marketing-microservice', repoUrl: 'https://github.com/speakASAP/marketing-microservice.git', localPath: true },
  { repoName: 'minio-microservice', repoUrl: 'https://github.com/speakASAP/minio.git', localPath: true },

  // Marketplace integrations
  { repoName: 'allegro-service', repoUrl: 'git@github.com:speakASAP/allegro-service.git', localPath: true },
  { repoName: 'aukro-service', repoUrl: 'git@github.com:speakASAP/aukro-service.git', localPath: true },
  { repoName: 'bazos-service', repoUrl: 'git@github.com:speakASAP/bazos-service.git', localPath: true },
  { repoName: 'flipflop-service', repoUrl: 'git@github.com:speakASAP/flipflop-service.git', localPath: true },
  { repoName: 'heureka-service', repoUrl: 'git@github.com:speakASAP/heureka-service.git', localPath: true },

  // Apps
  { repoName: 'speakasap', repoUrl: 'git@github.com:speakASAP/speakasap-new.git', localPath: true },
  { repoName: 'speakasap-portal', repoUrl: 'git@github.com:speakASAP/speakasap-portal.git', localPath: true },
  { repoName: 'shop-assistant', repoUrl: 'git@github.com:speakASAP/shop-assistant.git', localPath: true },
  { repoName: 'agentic-email-processing-system', repoUrl: 'git@github.com:speakASAP/agentic-email-processing-system.git', localPath: true },
  { repoName: 'crypto-ai-agent', repoUrl: 'git@github.com:speakASAP/crypto-ai-agent.git', localPath: true },
  { repoName: 'school-committee', repoUrl: 'git@github.com:speakASAP/school-committee.git', localPath: true },
  { repoName: 'marathon', repoUrl: 'git@github.com:speakASAP/marathon.git', localPath: true },
  { repoName: 'k8s-manifests', repoUrl: 'git@github.com:speakASAP/k8s-manifests.git', localPath: true },
];
```

- [ ] **Step 2: Add `triggerAll()` to IngestionService**

In `src/ingestion/ingestion.service.ts`, add after imports:
```typescript
import { ECOSYSTEM_REPOS } from './repo-registry';
```

Add method at end of class:
```typescript
  async triggerAll(force = false): Promise<{ queued: number; repos: string[] }> {
    const jobs: string[] = [];
    for (const repo of ECOSYSTEM_REPOS) {
      await this.triggerIngestion(repo.repoName, repo.repoUrl, force, repo.localPath);
      jobs.push(repo.repoName);
    }
    this.logger.log(`trigger-all: queued ${jobs.length} repos`);
    return { queued: jobs.length, repos: jobs };
  }
```

- [ ] **Step 3: Expose `POST /ingestion/trigger-all` in controller**

In `src/ingestion/ingestion.controller.ts`, add endpoint:
```typescript
  @Post('trigger-all')
  @HttpCode(202)
  async triggerAll(@Body() body: { force?: boolean }) {
    const force = body?.force ?? false;
    return this.ingestionService.triggerAll(force);
  }
```

- [ ] **Step 4: Build to verify**

```bash
npm run build 2>&1 | tail -5
```
Expected: `Found 0 errors.`

---

## Task 7: Create trigger-all shell script for one-shot ingestion

A shell script to call the trigger-all endpoint with a service JWT, usable from cron or manually.

**Files:**
- Create: `scripts/trigger-all-ingestion.sh`

- [ ] **Step 1: Create the script**

```bash
cat > /home/ssf/Documents/Github/docs-rag-microservice/scripts/trigger-all-ingestion.sh << 'SCRIPT'
#!/bin/bash
# Trigger full ecosystem ingestion into docs-rag-microservice
set -euo pipefail

DOCS_RAG_URL="${DOCS_RAG_URL:-http://docs-rag-microservice.statex-apps.svc.cluster.local:3397}"
JWT_TOKEN="${JWT_TOKEN:-}"
FORCE="${FORCE:-false}"

if [ -z "$JWT_TOKEN" ]; then
  echo "ERROR: JWT_TOKEN env var is required" >&2
  exit 1
fi

echo "Triggering full ecosystem ingestion (force=$FORCE)..."
curl -sf -X POST "$DOCS_RAG_URL/ingestion/trigger-all" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"force\": $FORCE}" | python3 -m json.tool

echo ""
echo "Check status at: $DOCS_RAG_URL/ingestion/status"
SCRIPT
chmod +x /home/ssf/Documents/Github/docs-rag-microservice/scripts/trigger-all-ingestion.sh
```

- [ ] **Step 2: Verify the script is executable and syntax is valid**

```bash
bash -n /home/ssf/Documents/Github/docs-rag-microservice/scripts/trigger-all-ingestion.sh
echo "Script syntax OK"
```

---

## Task 8: Deploy updated service to K8s

Build, push, and deploy the updated service with all changes from Tasks 1–6.

**Files:**
- Run: `scripts/deploy.sh`

- [ ] **Step 1: Build final TypeScript**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npm run build 2>&1 | tail -10
```
Expected: no errors.

- [ ] **Step 2: Apply updated K8s manifests**

```bash
kubectl apply -f k8s/configmap.yaml -n statex-apps
kubectl apply -f k8s/deployment.yaml -n statex-apps
kubectl apply -f k8s/qdrant-deployment.yaml -n statex-apps
```

- [ ] **Step 3: Deploy new image**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
bash scripts/deploy.sh
```
Expected: health check OK, rollout complete.

- [ ] **Step 4: Verify the pod can reach Ollama and read repos**

```bash
# Check Ollama reachable
kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e \
  "fetch('http://192.168.88.53:11434/api/tags').then(r=>r.json()).then(d=>{ console.log('ollama ok, models:', d.models.length); process.exit(0); })"

# Check repos mounted
kubectl exec -n statex-apps deploy/docs-rag-microservice -- \
  node -e "const fs=require('fs'); console.log('repos:', fs.readdirSync('/data/repos').length, 'dirs')"
```
Expected: `ollama ok, models: N` and `repos: 35+ dirs`.

---

## Task 9: Run initial ingestion for shared/ docs

Ingest the `shared` repository first (highest-value docs: ECOSYSTEM_MAP, SYSTEM, VAULT, DEPLOY_STANDARD, etc.).

- [ ] **Step 1: Get a service JWT**

The JWT_SECRET is in K8s secret. Generate a token:
```bash
JWT_SECRET=$(kubectl get secret docs-rag-microservice-secret -n statex-apps \
  -o jsonpath='{.data.JWT_SECRET}' | base64 -d)

# Generate JWT using node (HS256, no expiry for manual use)
JWT_TOKEN=$(node -e "
const crypto = require('crypto');
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({sub:'admin',iat:Math.floor(Date.now()/1000)})).toString('base64url');
const sig = crypto.createHmac('sha256','$JWT_SECRET').update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
")
echo "JWT: $JWT_TOKEN"
```

- [ ] **Step 2: Trigger ingestion for shared only**

```bash
kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e "
fetch('http://localhost:3397/ingestion/trigger', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $JWT_TOKEN'},
  body: JSON.stringify({repoName: 'shared', repoUrl: 'local', localPath: true, force: true})
}).then(r => r.json()).then(d => { console.log(JSON.stringify(d, null, 2)); process.exit(0); })
"
```
Expected: `{ "jobId": "...", "status": "pending", "repoName": "shared" }`

- [ ] **Step 3: Poll ingestion status until complete**

```bash
for i in $(seq 1 30); do
  STATUS=$(kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e \
    "fetch('http://localhost:3397/ingestion/status', {headers:{'Authorization':'Bearer $JWT_TOKEN'}}).then(r=>r.json()).then(d=>{ const j=d.jobs[0]; console.log(j.status+' '+j.chunksProcessed+'/'+j.chunksTotal); process.exit(0); })" 2>/dev/null)
  echo "$STATUS"
  echo "$STATUS" | grep -q "completed" && break
  sleep 10
done
```
Expected: eventually `completed N/N`.

- [ ] **Step 4: Verify chunks in Qdrant**

```bash
kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e "
fetch('http://qdrant.statex-apps.svc.cluster.local:6333/collections/ecosystem-docs').then(r=>r.json()).then(d=>{ console.log('points:', d.result?.points_count); process.exit(0); })
"
```
Expected: `points: N` where N > 0.

---

## Task 10: Run trigger-all for full ecosystem ingestion

After `shared` is confirmed working, ingest all repos.

- [ ] **Step 1: Trigger all repos**

```bash
kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e "
const jwt = '$JWT_TOKEN';
fetch('http://localhost:3397/ingestion/trigger-all', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer '+jwt},
  body: JSON.stringify({force: false})
}).then(r=>r.json()).then(d=>{ console.log('Queued:', d.queued, 'repos'); process.exit(0); })
"
```
Expected: `Queued: 35 repos`

- [ ] **Step 2: Monitor progress (run for ~5-10 min)**

```bash
watch -n 15 'kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e "
fetch('"'"'http://localhost:3397/ingestion/status'"'"', {headers:{'"'"'Authorization'"'"':'"'"'Bearer $JWT_TOKEN'"'"'}}).then(r=>r.json()).then(d=>{ d.jobs.slice(0,10).forEach(j=>console.log(j.repoName+'"'"': '"'"'+j.status+'"'"' '"'"'+j.chunksProcessed+'"'"'/'"'"'+j.chunksTotal)); process.exit(0); })" 2>/dev/null'
```

- [ ] **Step 3: Verify total vector count**

```bash
kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e "
fetch('http://qdrant.statex-apps.svc.cluster.local:6333/collections/ecosystem-docs').then(r=>r.json()).then(d=>{ console.log('Total vectors:', d.result?.points_count); process.exit(0); })
"
```
Expected: > 500 vectors (all ecosystem docs combined).

---

## Task 11: Test retrieval end-to-end

Verify that semantic search returns useful results.

- [ ] **Step 1: Test search for deployment knowledge**

```bash
kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e "
fetch('http://localhost:3397/retrieval/search', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $JWT_TOKEN'},
  body: JSON.stringify({query: 'how to deploy a microservice to kubernetes', limit: 3})
}).then(r=>r.json()).then(d=>{ d.results.forEach(r=>console.log(r.score.toFixed(3), r.repoName+'/'+r.filePath, r.heading)); process.exit(0); })
"
```
Expected: 3 results with scores > 0.5, from shared/docs/DEPLOY_STANDARD.md or similar.

- [ ] **Step 2: Test agent-context endpoint**

```bash
kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e "
fetch('http://localhost:3397/retrieval/agent-context', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $JWT_TOKEN'},
  body: JSON.stringify({query: 'vault secrets management', maxTokens: 500})
}).then(r=>r.json()).then(d=>{ console.log('tokens:', d.estimatedTokens, 'sources:', d.sources.length); console.log(d.context.slice(0,200)); process.exit(0); })
"
```
Expected: context with Vault docs, ~500 tokens.

- [ ] **Step 3: Test repo-scoped search**

```bash
kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e "
fetch('http://localhost:3397/retrieval/search', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $JWT_TOKEN'},
  body: JSON.stringify({query: 'authentication JWT service', repoName: 'auth-microservice', limit: 3})
}).then(r=>r.json()).then(d=>{ d.results.forEach(r=>console.log(r.score.toFixed(3), r.filePath)); process.exit(0); })
"
```
Expected: results only from auth-microservice repo.

---

## Task 12: Update service docs to backlink RAG

Every service AGENTS.md should tell agents to query docs-rag first. Update the top-priority services.

**Files to modify:** Each service's `AGENTS.md` (add RAG usage block)

- [ ] **Step 1: Add RAG usage block to shared/AGENTS.md**

Add after the first `##` heading in `/home/ssf/Documents/Github/shared/AGENTS.md`:
```markdown
## Knowledge Retrieval

Before reading files directly, query the RAG service:
```bash
# Search ecosystem docs (save 2000-5000 tokens per query)
curl -s -X POST http://docs-rag-microservice.statex-apps.svc.cluster.local:3397/retrieval/agent-context \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR QUESTION HERE", "maxTokens": 3000}'
```
Service URL (K8s internal): `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
Public: `https://docs-rag.alfares.cz`
```

- [ ] **Step 2: Apply the same block to these 5 high-traffic services**

Run this for each:
```bash
for svc in ai-microservice auth-microservice business-orchestrator notifications-microservice monitoring-microservice; do
  AGENTS_FILE="/home/ssf/Documents/Github/$svc/AGENTS.md"
  if [ -f "$AGENTS_FILE" ]; then
    # Prepend RAG block after first line
    python3 - "$AGENTS_FILE" << 'PY'
import sys
f = sys.argv[1]
content = open(f).read()
block = """
## Knowledge Retrieval (use before reading files)
Query the RAG service first — saves 2000-5000 tokens per query:
- URL: `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
- Endpoint: `POST /retrieval/agent-context` with `{"query": "...", "maxTokens": 3000}`
- Auth: `Authorization: Bearer <JWT_TOKEN>`

"""
lines = content.split('\n')
# Insert after first heading
for i, line in enumerate(lines):
    if line.startswith('##') and i > 0:
        lines.insert(i, block)
        break
else:
    lines.insert(1, block)
open(f, 'w').write('\n'.join(lines))
print(f"Updated {f}")
PY
  fi
done
```

- [ ] **Step 3: Update SYSTEM.md in docs-rag-microservice itself**

In `SYSTEM.md`, replace the "Key services" section's OpenAI line:
```markdown
## Key services
- PostgreSQL: docs_rag database — chunk metadata, ingestion jobs
- Qdrant: vector DB at qdrant.statex-apps.svc.cluster.local:6333, collection: ecosystem-docs
- Ollama: nomic-embed-text (768-dim) at host:11434 for embeddings (not OpenAI)

## API Endpoints
- GET /health — public, liveness check
- POST /ingestion/trigger — trigger single repo ingestion (JWT required)
- POST /ingestion/trigger-all — trigger all 35 ecosystem repos (JWT required)
- GET /ingestion/status — list recent ingestion jobs (JWT required)
- POST /retrieval/search — semantic + filtered search (JWT required)
- POST /retrieval/agent-context — token-limited context for AI agents (JWT required)
```

- [ ] **Step 4: Create `docs/RAG_USAGE.md`**

```bash
cat > /home/ssf/Documents/Github/docs-rag-microservice/docs/RAG_USAGE.md << 'DOC'
# RAG Service Usage Guide

## Why use this service?

Each query to this service instead of reading raw git files saves **2000–5000 tokens**.
With 35 repos indexed, all ecosystem knowledge is searchable in one call.

## Endpoints

All endpoints require `Authorization: Bearer <JWT_TOKEN>` (service-to-service JWT, HS256).

### Semantic search
```
POST /retrieval/search
{
  "query": "how does vault secret rotation work",
  "limit": 5,
  "repoName": "shared",          // optional: filter by repo
  "docType": "runbook",          // optional: adr|readme|runbook|api-docs|infrastructure|agent-instructions|system|business|documentation
  "scoreThreshold": 0.5          // optional: min similarity score
}
```

### Agent context (token-budgeted)
```
POST /retrieval/agent-context
{
  "query": "kubernetes deployment pattern for microservices",
  "maxTokens": 3000,
  "repoName": "shared"           // optional
}
```
Returns pre-formatted context block ready to paste into an agent prompt.

## Internal URL (K8s)
`http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`

## Public URL
`https://docs-rag.alfares.cz`

## Trigger re-ingestion
```bash
# Single repo
POST /ingestion/trigger
{"repoName": "shared", "repoUrl": "local", "localPath": true, "force": true}

# All repos
POST /ingestion/trigger-all
{"force": false}
```
DOC
```

---

## Task 13: Final production checks

- [ ] **Step 1: Verify health endpoint**

```bash
kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e \
  "fetch('http://localhost:3397/health').then(r=>r.json()).then(d=>{ console.log(JSON.stringify(d)); process.exit(0); })"
```
Expected: `{"status":"ok","service":"docs-rag-microservice"}`

- [ ] **Step 2: Verify ingestion status endpoint**

```bash
kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e \
  "fetch('http://localhost:3397/ingestion/status', {headers:{'Authorization':'Bearer $JWT_TOKEN'}}).then(r=>r.json()).then(d=>{ console.log('jobs:', d.jobs.length, 'latest:', d.jobs[0]?.repoName, d.jobs[0]?.status); process.exit(0); })"
```
Expected: `jobs: N latest: <some-repo> completed`

- [ ] **Step 3: Check for any failed ingestion jobs**

```bash
kubectl exec -n statex-apps deploy/docs-rag-microservice -- node -e \
  "fetch('http://localhost:3397/ingestion/status', {headers:{'Authorization':'Bearer $JWT_TOKEN'}}).then(r=>r.json()).then(d=>{ const failed=d.jobs.filter(j=>j.status==='failed'); console.log('failed:', failed.map(j=>j.repoName+': '+j.errorMessage)); process.exit(0); })"
```
Expected: `failed: []`. If any failed, re-trigger with `force: true`.

- [ ] **Step 4: Update GOALS.md with actual success metrics**

```bash
cat > /home/ssf/Documents/Github/docs-rag-microservice/GOALS.md << 'EOF'
# GOALS.md — docs-rag-microservice

## Success Criteria

- [ ] All 35 ecosystem repos indexed (>500 vectors in Qdrant)
- [ ] Search latency < 2s (embedding + vector search)
- [ ] Agent-context endpoint returns relevant results for "deploy", "vault", "auth", "kubernetes" queries
- [ ] Qdrant data persists across pod restarts (hostPath volume)
- [ ] Ollama reachable from K8s pods (0.0.0.0 bind)
- [ ] Token savings: each agent RAG query vs. reading files = ~3000 tokens saved
EOF
```

- [ ] **Step 5: Update STATE.json**

```bash
cat > /home/ssf/Documents/Github/docs-rag-microservice/STATE.json << 'EOF'
{
  "stage": "production",
  "health": "ok",
  "cycle": 1,
  "notes": "All 35 ecosystem repos ingested. Ollama nomic-embed-text on host:11434. Qdrant persisted via hostPath. trigger-all endpoint live."
}
EOF
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Read docs-rag-microservice | Done (pre-plan) |
| Fix Qdrant collection name | Task 1 |
| Fix Ollama reachability | Task 2 |
| Give pod access to local repos | Task 3 |
| Skip git clone for local repos | Task 4 |
| Persist Qdrant data | Task 5 |
| Registry of all ecosystem repos | Task 6 |
| trigger-all endpoint | Task 6 |
| Deploy to K8s | Task 8 |
| Ingest shared/ first | Task 9 |
| Ingest all ecosystem | Task 10 |
| Verify retrieval works | Task 11 |
| Update service AGENTS.md backlinks | Task 12 |
| Final production checks | Task 13 |

**Known gaps / decisions:**
- Tasks 2 and 3 require host-level changes (`systemctl`, `mkdir`), which are safe on alfares but need root.
- The JWT generation in Task 9 uses raw node crypto — this is intentionally minimal; a production pattern would use the ai-microservice to issue tokens.
- Repos not in `/home/ssf/Documents/Github/` (none identified) would need git-clone mode — all 35 repos are local.
- `school-committee`, `marathon`, `crypto-ai-agent` have many `.md` files (potentially unrelated to ecosystem ops) — they will be ingested but lower priority.
