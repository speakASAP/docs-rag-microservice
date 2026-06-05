# Repository Structure

## Recommended final repository

```text
school-committee/
  README.md
  docs/
  apps/
    web/
    admin/
  packages/
    ui/
    api-client/
    shared-types/
    validation/
  services/
    bff/
    notification-worker/
  infrastructure/
    k8s/
    helm/
  .github/
    workflows/
```

## MVP simplified structure

```text
school-committee/
  README.md
  docs/
  app/
  components/
  features/
  lib/
  types/
  public/
  tests/
```

## Documentation rule

All documentation must stay inside `/docs`.

Do not scatter architecture docs across folders.

## Generated code rule

OpenAPI-generated clients should go to:

```text
packages/api-client/generated
```

Generated files should not be manually edited.
