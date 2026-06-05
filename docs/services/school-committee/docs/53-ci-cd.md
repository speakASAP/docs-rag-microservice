# CI/CD

## Required pipelines

### Pull request

- install dependencies
- lint
- typecheck
- unit tests
- build
- OpenAPI validation
- docs link check optional

### Main branch

- build image
- scan image
- push image
- deploy to staging

### Release

- deploy production
- run smoke tests
- notify maintainers

## GitHub Actions skeleton

```yaml
name: ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

## Deployment gates

Production deploy requires:

- green build
- image scan pass
- staging smoke pass
- manual approval for MVP if no automated rollout confidence
