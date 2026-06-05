# k8s-manifests

Kubernetes manifests for the Statex ecosystem (`statex-apps` namespace).

## Structure

```
configmaps/   — per-service ConfigMaps (non-secret env vars)
secrets/      — ExternalSecret CRDs (pull values from Vault via ESO)
services/     — Service definitions (ClusterIP, etc.)
```

## Apply

```bash
kubectl apply -f configmaps/ -n statex-apps
kubectl apply -f secrets/ -n statex-apps
kubectl apply -f services/ -n statex-apps
```

## Notes

- No plaintext secrets are stored here — all sensitive values are fetched from Vault at runtime via ExternalSecret
- ConfigMaps contain only non-sensitive config (hostnames, ports, feature flags)
- Vault path pattern: `secret/prod/<service-name>`
