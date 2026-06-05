# vault

Vault policies and AppRole setup scripts for the Statex ecosystem.

## Contents

| Path | Purpose |
|------|---------|
| `policies/service-auth.hcl` | HCL policy granting services read access to their secrets |
| `scripts/setup-approles.sh` | Bootstrap AppRole auth and apply policies |

## Usage

```bash
# Apply policies and configure AppRoles
VAULT_ADDR=http://localhost:8200 VAULT_TOKEN=<root-token> ./scripts/setup-approles.sh
```

## Notes

- Root token is never stored here — it lives in `vault-microservice/.vault-init` (gitignored)
- Policies grant least-privilege read access per service path: `secret/services/<name>/`
