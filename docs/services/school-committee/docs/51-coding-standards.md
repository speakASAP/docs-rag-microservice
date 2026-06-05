# Coding Standards

## Language

- TypeScript strict mode
- no implicit any
- explicit domain types
- Zod for runtime validation

## Naming

- components: PascalCase
- hooks: useSomething
- utilities: camelCase
- constants: UPPER_CASE
- API files: api.ts

## Error handling

- never throw raw upstream errors to frontend
- use normalized error model
- include request ID
- avoid exposing secrets/internal URLs

## Security

- no secrets in code
- no tokens in localStorage
- server-side permission checks
- validate all inputs
- escape output where needed

## Tests

Minimum:

- unit tests for validation
- API contract tests
- permission tests
- QR payment generation tests
- task claim conflict tests

## Pull requests

Every PR must include:

- summary
- scope
- testing
- risks
- screenshots for UI
- docs update if contracts changed

## Accessibility

All new UI components must support:

- keyboard navigation
- visible focus
- labels
- error messages
