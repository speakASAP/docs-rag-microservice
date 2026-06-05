# Vault Secrets

## Principle

No production secret is stored in Git, Docker image, or frontend bundle.  
All secrets come from Vault via ExternalSecret (ESO) → K8s Secret.

## Vault path prefix

```
secret/prod/school-committee/
```

## Secret paths and keys

| Vault path | Key | Purpose |
|------------|-----|---------|
| `secret/prod/school-committee/auth` | `AUTH_SERVICE_CLIENT_SECRET` | Shared secret for auth-microservice introspection |
| `secret/prod/school-committee/db` | `DB_SERVICE_TOKEN` | PostgreSQL password for `dbadmin` |
| `secret/prod/school-committee/payments` | `PAYMENT_WEBHOOK_SECRET` | Incoming payment webhook HMAC secret |
| `secret/prod/school-committee/payments` | `PAYMENT_ACCOUNT_IBAN` | Czech spolek bank account IBAN |
| `secret/prod/school-committee/payments` | `PAYMENT_ACCOUNT_NUMBER` | Czech spolek account number |
| `secret/prod/school-committee/payments` | `PAYMENT_BANK_CODE` | Czech bank code |
| `secret/prod/school-committee/notifications` | `SMTP_HOST` | SMTP server hostname |
| `secret/prod/school-committee/notifications` | `SMTP_USER` | SMTP username |
| `secret/prod/school-committee/notifications` | `SMTP_PASSWORD` | SMTP password |
| `secret/prod/school-committee/notifications` | `EMAIL_FROM` | Sender address for outbound email |
| `secret/prod/school-committee/storage` | `STORAGE_ACCESS_KEY` | MinIO access key |
| `secret/prod/school-committee/storage` | `STORAGE_SECRET_KEY` | MinIO secret key |
| `secret/prod/school-committee/storage` | `STORAGE_BUCKET` | MinIO bucket name |

Total: **13 secret keys** across 5 sub-paths.

## Kubernetes integration

Secrets are synced from Vault via **External Secrets Operator (ESO)** using the `ClusterSecretStore` named `vault-backend`.

The `ExternalSecret` resource lives at `k8s/external-secret.yaml`:
- `metadata.name`: `school-committee-secret`
- `target.name`: `school-committee-secret`
- Refresh interval: `5m`

Non-secret config (DB host/port/user/name, service URLs) lives in `k8s/configmap.yaml`.

## Initial provisioning

Run `scripts/vault-init.sh` manually (fill in real values first, never commit them):

```bash
VAULT_ADDR=http://127.0.0.1:8200 vault login
bash scripts/vault-init.sh
```

Verify with:
```bash
VAULT_ADDR=http://127.0.0.1:8200 vault kv list secret/prod/school-committee/
```

## Secret rotation policy

| Category | Rotation interval |
|----------|------------------|
| DB password | 90–180 days or after incident |
| Payment webhook secret | Yearly or after incident |
| SMTP credentials | Yearly or after incident |
| Auth client secret | Per auth-microservice rotation policy |
| Storage keys | Yearly or after incident |

## Local development

Copy `.env.example` → `.env.local` and fill in real local values.  
Never commit `.env.local`.
