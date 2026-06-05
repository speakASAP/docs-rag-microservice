# System: minio-microservice

## Architecture

MinIO S3-compatible storage. Kubernetes (`statex-apps` namespace).

- API: port 9000, Console: port 9001
- Bucket `records`: key layout `YYYY/MM/DD/lesson_<uuid>.mp3`
- Access: presigned GET URLs only (no anonymous read)

## Deployment

**Platform:** Kubernetes (k3s) · namespace `statex-apps`  
**Image:** `localhost:5000/minio-microservice:latest`  
**Deploy:** `./scripts/deploy.sh`  
**Logs:** `kubectl logs -n statex-apps -l app=minio-microservice -f`  
**Restart:** `kubectl rollout restart deployment/minio-microservice -n statex-apps`

## Integrations

| Consumer | Usage |
|---------|-------|
| speakasap-portal | Store + serve lesson MP3 recordings |
| business-orchestrator | Task artifact storage |

## Secrets

All secrets in Vault at `secret/prod/minio-microservice`.  
Synced via ESO → K8s Secret `minio-microservice-secret`.

## Current State
<!-- AI-maintained -->
Stage: production · Deploy: Kubernetes (`statex-apps`)

## Known Issues
<!-- AI-maintained -->
- None
