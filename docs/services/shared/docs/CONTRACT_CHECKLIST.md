# Contract Compliance Checklist

Use this checklist when adding any new endpoint or inter-service call to any microservice in the ecosystem.

---

## New HTTP Endpoint

- [ ] Request body uses a `class-validator` DTO OR `ZodValidationPipe` with a Zod schema (never raw `body: unknown` or inline type literals)
- [ ] DTO has `@IsNotEmpty()` on all required string fields (class-validator approach)
- [ ] Enum fields use `@IsEnum()` with an explicit `const` array, not `@IsString()` (class-validator approach)
- [ ] A Zod schema exists in `src/contracts/<feature>.contract.ts` for the response shape
- [ ] The controller handler wraps its return value with `parseOrThrow(ResponseSchema, result, 'context')`
- [ ] Context string follows `<module>.<endpoint>.<direction>` format
- [ ] New schema is exported from `src/contracts/index.ts`
- [ ] At least one success + one failure test added to `contracts.spec.ts`

## New Inter-Service HTTP Call

- [ ] Outbound request is validated: `parseOrThrow(TheirRequestSchema, payload, 'caller.callee.request')`
- [ ] Inbound response is validated: `parseOrThrow(TheirResponseSchema, raw, 'caller.callee.response')`
- [ ] If calling ai-microservice: use `AiCompleteRequestSchema` / `AiCompleteResponseSchema` from `src/contracts`
- [ ] Run `./shared/scripts/check-contract-parity.sh` — must exit 0 before deploying either `business-orchestrator` or `ai-microservice`

## New Microservice (from scratch)

- [ ] `zod` in `package.json` dependencies
- [ ] `src/contracts/contract-violation.error.ts` created (copy from `CONTRACT_STANDARD.md`)
- [ ] `src/contracts/parse-or-throw.ts` created (copy from `CONTRACT_STANDARD.md`)
- [ ] `src/contracts/index.ts` barrel exists
- [ ] `src/common/filters/contract-violation.filter.ts` created
- [ ] `ContractViolationFilter` registered in `main.ts`
- [ ] `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` registered in `main.ts`
- [ ] `src/contracts/contracts.spec.ts` created with at least 5 tests
- [ ] All endpoints pass the "New HTTP Endpoint" checklist above

## Schema Change (breaking)

- [ ] `schemaVersion` field bumped from `'1.0'` to `'2.0'` in schema and all callers
- [ ] Both sides (producer + consumer) updated in same deploy window
- [ ] If change touches `ai-complete.contract.ts`: BOTH `business-orchestrator` AND `ai-microservice` must be updated
- [ ] Run `./shared/scripts/check-contract-parity.sh` after updating both files — confirms parity

---

## Reference Implementations

| Service | Contracts dir | Filter |
|---------|--------------|--------|
| business-orchestrator | `src/contracts/` (18+ files) | `src/common/filters/contract-violation.filter.ts` |
| ai-microservice | `src/contracts/` (11 files) | `src/common/filters/contract-violation.filter.ts` |

Standard doc: `shared/docs/CONTRACT_STANDARD.md`
