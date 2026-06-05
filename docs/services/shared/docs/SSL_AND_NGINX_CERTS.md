# TLS / SSL and nginx (pointer)

Certificate issuance, wildcard DNS-01, Certbot scripts, and `WILDCARD_CERT_DOMAINS` are owned by **nginx-microservice**, not duplicated here.

- **Operations and wildcard setup**: [nginx-microservice/README.md](../../nginx-microservice/README.md) (Certbot, `request-cert-wildcard.sh`, renewal, symlink behaviour).
- **Implementation** (symlink per subdomain to base wildcard): [nginx-microservice/scripts/blue-green/utils.sh](../../nginx-microservice/scripts/blue-green/utils.sh) — function `ensure_ssl_certificate`.
- **Where service nginx snippets live** (no cert logic): [NGINX_LOCAL_CONFIG.md](./NGINX_LOCAL_CONFIG.md), [DEPLOY_STANDARD.md](./DEPLOY_STANDARD.md).

Environment keys (names only): see [nginx-microservice/.env.example](../../nginx-microservice/.env.example) (`WILDCARD_CERT_DOMAINS`, `CERTBOT_EMAIL`, etc.).
