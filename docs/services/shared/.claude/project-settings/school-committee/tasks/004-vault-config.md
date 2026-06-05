# Task 004: Vault Config

**Status:** ready
**Epic:** EPIC-010 Deployment
**Depends on:** none

## Context

All production secrets must come from Vault. This task writes the Vault secret paths for school-committee, creates the ExternalSecret K8s resource, and documents the local dev setup. No real secret values are committed anywhere.

## Objective

Provision Vault secret paths, create `k8s/external-secret.yaml`, update `docs/19-vault-secrets.md` with final paths, and provide a local dev `.env.example` with all required keys and fake values only.

## Relevant docs

- `docs/19-vault-secrets.md` — secret categories and paths
- `docs/18-kubernetes-deployment.md` — secrets from Vault section
- `shared/docs/VAULT.md` — Vault ops reference
- `shared/k8s/external-secrets/external-secret.yaml.tpl` — template

## Files likely touched

- `k8s/external-secret.yaml` — ESO resource
- `.env.example` — all keys, no real values
- `docs/19-vault-secrets.md` — update with confirmed paths

## Implementation constraints

- Vault path prefix: `secret/prod/school-committee/`
- Sub-paths: `/auth`, `/db`, `/payments`, `/notifications`, `/storage`
- Never write real secret values into any file
- ExternalSecret must list every secret key the app uses
- `.env.example` must contain all keys with empty or obviously-fake values (e.g. `=changeme`)
- Vault commands in this task are documentation/shell-script format only — do not execute them (no real creds present yet)

## Acceptance criteria

- [ ] `k8s/external-secret.yaml` created with entries for all 13 secret keys from `docs/19-vault-secrets.md`
- [ ] ExternalSecret `metadata.name` is `school-committee-secret`
- [ ] ExternalSecret `target.name` is `school-committee-secret`
- [ ] `.env.example` has every key referenced in SYSTEM.md secrets table with empty or fake value
- [ ] `docs/19-vault-secrets.md` has final confirmed Vault paths matching the ExternalSecret
- [ ] A `scripts/vault-init.sh` shell script documents (but does not run) the Vault write commands for initial setup
- [ ] `scripts/vault-init.sh` has a clear header warning: "Run manually with real values. Never commit values."

## Tests required

- Validation test: `k8s/external-secret.yaml` is valid YAML
- Validation test: every key in `.env.example` matches a key in `k8s/external-secret.yaml` or `k8s/configmap.yaml`
- Documentation test (manual): `scripts/vault-init.sh` reviewed by human before first deploy

## Do not

- Do not write any real secret values into any file
- Do not commit `.env.local` or any file with real credentials
- Do not use a flat vault path — use sub-paths per category (`/auth`, `/db`, etc.)
- Do not skip any secret key used in the application
