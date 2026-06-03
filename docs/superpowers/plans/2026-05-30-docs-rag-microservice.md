# docs-rag-microservice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a centralized RAG service that ingests docs from all statex ecosystem Git repos, generates embeddings via OpenAI, stores vectors in Qdrant, and exposes a hybrid search API for AI agents — reducing token usage by replacing raw repo reads.

**Architecture:** NestJS microservice (port 3396) following ecosystem conventions (Zod contracts, JWT service-auth, TypeORM/Postgres for metadata, Qdrant for vectors, ESO/Vault for secrets, K8s deployment). Git repos are cloned into a persistent volume, docs are chunked semantically, embeddings are stored in Qdrant with rich metadata, and retrieval is hybrid (vector + BM25 keyword).

**Tech Stack:** NestJS 10, TypeScript, TypeORM + PostgreSQL (metadata), Qdrant (vectors), OpenAI text-embedding-3-small, simple-git (repo sync), marked (markdown parsing), Zod (contracts), K8s + ESO/Vault (secrets).

---

## Architecture Discovery Summary

- **Port:** 3396 (next after monitoring-web 3396 is taken → use **3396**)
  - monitoring-microservice: 3395, monitoring-web: 3396
  - Use **3397** for docs-rag-microservice (3396 is taken)
- **Auth pattern:** `ServiceIdentityModule` with `ServiceAuthGuard` + `@Public()` decorator — copy verbatim
- **Contracts:** Zod schemas + `parseOrThrow()` + `ZodValidationPipe` — copy verbatim
- **DB pattern:** TypeORM `forRoot` reading `DATABASE_URL` or individual env vars, `DB_AUTO_CREATE: true` in configmap
- **Secrets:** ESO `ExternalSecret` → `secret/prod/docs-rag-microservice` in Vault
- **K8s:** `statex-apps` namespace, Traefik ingress with cert-manager TLS, `localhost:5000` registry
- **Dockerfile:** node:20-slim multi-stage, user `node` (uid 1000), HEALTHCHECK via wget
- **Logging:** fire-and-forget HTTP POST to `LOGGING_SERVICE_URL`
- **Notifications:** fire-and-forget to `NOTIFICATION_SERVICE_URL` for failures
- **Domain:** `docs-rag.alfares.cz`

---

## File Map

```
docs-rag-microservice/
├── src/
│   ├── main.ts                          # Bootstrap — port 3397
│   ├── app.module.ts                    # Root module wiring
│   ├── health.controller.ts             # GET /health — @Public()
│   ├── contracts/
│   │   ├── contract-violation.error.ts  # ContractViolationError
│   │   ├── parse-or-throw.ts            # Zod parse helper
│   │   ├── zod-validation.pipe.ts       # ZodValidationPipe
│   │   └── http-responses.contract.ts   # HealthResponseSchema
│   ├── service-identity/
│   │   ├── service-identity.module.ts   # APP_GUARD registration
│   │   ├── service-auth.guard.ts        # JWT Bearer guard
│   │   ├── public.decorator.ts          # @Public()
│   │   └── jwt.util.ts                  # Sign/verify HS256
│   ├── common/
│   │   └── filters/
│   │       └── contract-violation.filter.ts  # 500 on ZodError
│   ├── database/
│   │   └── entities/
│   │       ├── document-chunk.entity.ts  # Chunked doc metadata in PG
│   │       └── ingestion-job.entity.ts   # Repo sync job tracking
│   ├── qdrant/
│   │   ├── qdrant.module.ts             # QdrantClient provider
│   │   └── qdrant.service.ts            # upsert, search, delete
│   ├── ingestion/
│   │   ├── ingestion.module.ts
│   │   ├── ingestion.controller.ts      # POST /ingestion/trigger, GET /ingestion/status
│   │   ├── ingestion.service.ts         # Orchestrate clone→chunk→embed→store
│   │   ├── git-sync.service.ts          # simple-git clone/pull, diff detection
│   │   ├── markdown-chunker.service.ts  # Parse + semantic chunk markdown
│   │   └── embedding.service.ts         # OpenAI embeddings, batch + retry
│   ├── retrieval/
│   │   ├── retrieval.module.ts
│   │   ├── retrieval.controller.ts      # POST /retrieval/search, POST /retrieval/agent-context
│   │   └── retrieval.service.ts         # Hybrid search (vector + keyword filter)
│   └── notifications/
│       └── notification.util.ts         # Fire-and-forget to NOTIFICATION_SERVICE_URL
├── test/
│   ├── ingestion/
│   │   ├── markdown-chunker.spec.ts
│   │   └── git-sync.spec.ts
│   └── retrieval/
│       └── retrieval.service.spec.ts
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── external-secret.yaml
│   └── qdrant-deployment.yaml           # Qdrant sidecar/pod in statex-apps
├── Dockerfile
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── jest.config.js
├── .env.example
├── CLAUDE.md
├── SYSTEM.md
├── AGENTS.md
├── BUSINESS.md
├── TASKS.md
└── STATE.json
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `jest.config.js`
- Create: `.env.example`
- Create: `src/main.ts`
- Create: `src/app.module.ts`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "docs-rag-microservice",
  "version": "1.0.0",
  "description": "Centralized documentation RAG service for the Statex ecosystem",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start:prod": "node dist/main.js",
    "test": "jest",
    "test:unit": "jest --testPathPattern='\\.spec\\.ts$'",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/typeorm": "^10.0.0",
    "@qdrant/js-client-rest": "^1.9.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "marked": "^12.0.0",
    "openai": "^4.52.0",
    "pg": "^8.11.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.2",
    "simple-git": "^3.25.0",
    "typeorm": "^0.3.0",
    "uuid": "^9.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@nestjs/testing": "^10.0.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "@types/supertest": "^6.0.0",
    "jest": "^29.5.0",
    "supertest": "^6.3.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false
  }
}
```

- [ ] **Step 3: Create tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

- [ ] **Step 4: Create jest.config.js**

```js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};
```

- [ ] **Step 5: Create .env.example**

```bash
# ── Identity ──
SERVICE_NAME=docs-rag-microservice
NODE_ENV=development
PORT=3397

# ── Network ──
AUTH_SERVICE_URL=http://auth-microservice:3370
LOGGING_SERVICE_URL=http://logging-microservice:3367
NOTIFICATION_SERVICE_URL=http://notifications-microservice:3368

# ── Database (PostgreSQL) ──
DATABASE_URL=
DB_HOST=db-server-postgres
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=
DB_NAME=docs_rag

# ── Qdrant ──
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=ecosystem_docs

# ── OpenAI Embeddings ──
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# ── Git Repos ──
GIT_REPOS_DIR=/data/repos
GIT_REPOS_CONFIG=[]

# ── Auth ──
JWT_SECRET=
```

- [ ] **Step 6: Create src/main.ts**

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ContractViolationFilter } from './common/filters/contract-violation.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new ContractViolationFilter());

  const port = process.env.PORT || 3397;
  await app.listen(port);
  console.log(`docs-rag-microservice listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err);
  process.exit(1);
});
```

- [ ] **Step 7: Install dependencies**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npm install --legacy-peer-deps
```

Expected: `node_modules/` created, no fatal errors.

---

## Task 2: Contracts & Common Infrastructure

**Files:**
- Create: `src/contracts/contract-violation.error.ts`
- Create: `src/contracts/parse-or-throw.ts`
- Create: `src/contracts/zod-validation.pipe.ts`
- Create: `src/contracts/http-responses.contract.ts`
- Create: `src/common/filters/contract-violation.filter.ts`

- [ ] **Step 1: Create src/contracts/contract-violation.error.ts**

```typescript
import { ZodIssue } from 'zod';

export class ContractViolationError extends Error {
  constructor(
    readonly context: string,
    readonly issues: ZodIssue[],
  ) {
    super(`contract_violation:${context}`);
    this.name = 'ContractViolationError';
  }
}
```

- [ ] **Step 2: Create src/contracts/parse-or-throw.ts**

```typescript
import { ZodSchema } from 'zod';
import { ContractViolationError } from './contract-violation.error';

export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ContractViolationError(context, result.error.issues);
  }
  return result.data;
}
```

- [ ] **Step 3: Create src/contracts/zod-validation.pipe.ts**

```typescript
import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: 'Contract violation',
        details: result.error.issues.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    return result.data;
  }
}
```

- [ ] **Step 4: Create src/contracts/http-responses.contract.ts**

```typescript
import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  service: z.string(),
  version: z.string().optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
```

- [ ] **Step 5: Create src/common/filters/contract-violation.filter.ts**

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as http from 'http';
import { URL } from 'url';
import { ContractViolationError } from '../../contracts/contract-violation.error';

@Catch(ContractViolationError)
@Injectable()
export class ContractViolationFilter implements ExceptionFilter {
  private readonly logger = new Logger(ContractViolationFilter.name);

  catch(exception: ContractViolationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const issuesSummary = exception.issues
      .map((i) => `[${i.path.join('.')}] ${i.message}`)
      .join('; ');

    this.logger.error(`Contract violation at "${exception.context}": ${issuesSummary}`);
    this.fireEscalation(exception.context, issuesSummary).catch(() => {});

    response.status(500).json({
      error: 'contract_violation',
      context: exception.context,
      issues: exception.issues,
    });
  }

  private fireEscalation(context: string, issuesSummary: string): Promise<void> {
    return new Promise((resolve) => {
      const notifUrl = process.env.NOTIFICATION_SERVICE_URL;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!notifUrl || !chatId) { resolve(); return; }

      let parsed: URL;
      try { parsed = new URL(`${notifUrl}/notifications/send`); } catch { resolve(); return; }

      const body = JSON.stringify({
        channel: 'telegram',
        type: 'custom',
        recipient: chatId,
        subject: `Contract violation: ${context}`,
        message: `Contract violation at "${context}".\n\nIssues:\n${issuesSummary}`,
        service: 'docs-rag-microservice',
      });

      const req = http.request(
        { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          timeout: 5000 },
        () => resolve(),
      );
      req.on('error', () => resolve());
      req.on('timeout', () => { req.destroy(); resolve(); });
      req.write(body);
      req.end();
    });
  }
}
```

---

## Task 3: Service Identity (JWT Auth Guard)

**Files:**
- Create: `src/service-identity/public.decorator.ts`
- Create: `src/service-identity/jwt.util.ts`
- Create: `src/service-identity/service-auth.guard.ts`
- Create: `src/service-identity/service-identity.module.ts`

- [ ] **Step 1: Create src/service-identity/public.decorator.ts**

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 2: Create src/service-identity/jwt.util.ts**

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

export interface ServiceTokenPayload {
  serviceId: string;
  iss: string;
  iat: number;
  exp: number;
}

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

export class JwtUtil {
  private static readonly ISSUER = 'docs-rag-microservice';
  private static readonly ALGORITHM = 'HS256';

  static sign(serviceId: string, secret: string, expiresInSeconds = 365 * 24 * 3600): string {
    const header = base64url(JSON.stringify({ alg: this.ALGORITHM, typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = base64url(
      JSON.stringify({ serviceId, iss: this.ISSUER, iat: now, exp: now + expiresInSeconds }),
    );
    const signature = base64url(
      createHmac('sha256', secret).update(`${header}.${payload}`).digest(),
    );
    return `${header}.${payload}.${signature}`;
  }

  static verify(token: string, secret: string): ServiceTokenPayload {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');
    const [header, payload, signature] = parts;
    const expectedSig = base64url(
      createHmac('sha256', secret).update(`${header}.${payload}`).digest(),
    );
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new Error('Invalid signature');
    }
    const decoded = JSON.parse(base64urlDecode(payload).toString()) as ServiceTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) throw new Error('Token expired');
    if (decoded.iss !== this.ISSUER) throw new Error('Invalid issuer');
    return decoded;
  }
}
```

- [ ] **Step 3: Create src/service-identity/service-auth.guard.ts**

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { JwtUtil } from './jwt.util';

interface ServiceRequest {
  headers: Record<string, string | undefined>;
  serviceId?: string;
}

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<ServiceRequest>();
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing service token');
    }

    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new UnauthorizedException('JWT_SECRET not configured');

    try {
      const payload = JwtUtil.verify(token, secret);
      request.serviceId = payload.serviceId;
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid token';
      throw new UnauthorizedException(message);
    }
  }
}
```

- [ ] **Step 4: Create src/service-identity/service-identity.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServiceAuthGuard } from './service-auth.guard';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: ServiceAuthGuard,
    },
  ],
})
export class ServiceIdentityModule {}
```

---

## Task 4: Database Entities

**Files:**
- Create: `src/database/entities/document-chunk.entity.ts`
- Create: `src/database/entities/ingestion-job.entity.ts`

- [ ] **Step 1: Write test for entity structure**

Create `test/database/entities.spec.ts`:

```typescript
import 'reflect-metadata';
import { DocumentChunk } from '../../src/database/entities/document-chunk.entity';
import { IngestionJob } from '../../src/database/entities/ingestion-job.entity';

describe('DocumentChunk entity', () => {
  it('has required fields', () => {
    const chunk = new DocumentChunk();
    expect(chunk).toBeInstanceOf(DocumentChunk);
  });
});

describe('IngestionJob entity', () => {
  it('has required fields', () => {
    const job = new IngestionJob();
    expect(job).toBeInstanceOf(IngestionJob);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npx jest test/database/entities.spec.ts --no-coverage
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create src/database/entities/document-chunk.entity.ts**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('document_chunks')
@Index('idx_chunk_repo', ['repoName'])
@Index('idx_chunk_service', ['serviceName'])
@Index('idx_chunk_type', ['docType'])
@Index('idx_chunk_qdrant', ['qdrantId'], { unique: true })
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 200 })
  repoName!: string;

  @Column('varchar', { length: 200, nullable: true })
  serviceName?: string;

  @Column('varchar', { length: 500 })
  filePath!: string;

  @Column('varchar', { length: 100 })
  docType!: string;

  @Column('text')
  chunkText!: string;

  @Column('integer')
  chunkIndex!: number;

  @Column('varchar', { length: 100 })
  embeddingModel!: string;

  @Column('varchar', { length: 100 })
  qdrantId!: string;

  @Column('varchar', { length: 40, nullable: true })
  gitCommitHash?: string;

  @Column('varchar', { length: 50, nullable: true })
  version?: string;

  @Column('simple-array', { nullable: true })
  tags?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

- [ ] **Step 4: Create src/database/entities/ingestion-job.entity.ts**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

@Entity('ingestion_jobs')
export class IngestionJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 200 })
  repoName!: string;

  @Column('varchar', { length: 500 })
  repoUrl!: string;

  @Column('varchar', { length: 20, default: 'pending' })
  status!: JobStatus;

  @Column('integer', { default: 0 })
  chunksProcessed!: number;

  @Column('integer', { default: 0 })
  chunksTotal!: number;

  @Column('text', { nullable: true })
  errorMessage?: string;

  @Column('varchar', { length: 40, nullable: true })
  lastCommitHash?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npx jest test/database/entities.spec.ts --no-coverage
```

Expected: PASS.

---

## Task 5: Qdrant Module

**Files:**
- Create: `src/qdrant/qdrant.module.ts`
- Create: `src/qdrant/qdrant.service.ts`

- [ ] **Step 1: Write test for QdrantService**

Create `test/qdrant/qdrant.service.spec.ts`:

```typescript
import { QdrantService } from '../../src/qdrant/qdrant.service';

const mockClient = {
  getCollections: jest.fn().mockResolvedValue({ collections: [] }),
  createCollection: jest.fn().mockResolvedValue({}),
  upsert: jest.fn().mockResolvedValue({ status: 'acknowledged' }),
  search: jest.fn().mockResolvedValue([]),
  delete: jest.fn().mockResolvedValue({ status: 'acknowledged' }),
};

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => mockClient),
}));

describe('QdrantService', () => {
  let service: QdrantService;

  beforeEach(() => {
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.QDRANT_COLLECTION = 'test_docs';
    service = new QdrantService();
  });

  it('upserts a point', async () => {
    await service.upsertPoint('test_docs', {
      id: 'abc-123',
      vector: new Array(1536).fill(0.1),
      payload: { text: 'hello', repoName: 'test-repo' },
    });
    expect(mockClient.upsert).toHaveBeenCalled();
  });

  it('searches by vector', async () => {
    mockClient.search.mockResolvedValueOnce([
      { id: 'abc-123', score: 0.9, payload: { text: 'hello' } },
    ]);
    const results = await service.search('test_docs', new Array(1536).fill(0.1), { limit: 5 });
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npx jest test/qdrant/qdrant.service.spec.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/qdrant/qdrant.service.ts**

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface SearchOptions {
  limit?: number;
  filter?: Record<string, unknown>;
  scoreThreshold?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private readonly client: QdrantClient;
  private readonly collectionName: string;
  private readonly vectorSize = 1536;

  constructor() {
    const url = process.env.QDRANT_URL || 'http://localhost:6333';
    this.collectionName = process.env.QDRANT_COLLECTION || 'ecosystem_docs';
    this.client = new QdrantClient({ url });
  }

  async onModuleInit() {
    await this.ensureCollection(this.collectionName);
  }

  async ensureCollection(name: string): Promise<void> {
    const { collections } = await this.client.getCollections();
    const exists = collections.some((c) => c.name === name);
    if (!exists) {
      await this.client.createCollection(name, {
        vectors: { size: this.vectorSize, distance: 'Cosine' },
      });
      this.logger.log(`Created Qdrant collection: ${name}`);
    }
  }

  async upsertPoint(collection: string, point: QdrantPoint): Promise<void> {
    await this.client.upsert(collection, {
      wait: true,
      points: [{ id: point.id, vector: point.vector, payload: point.payload }],
    });
  }

  async upsertBatch(collection: string, points: QdrantPoint[]): Promise<void> {
    if (points.length === 0) return;
    await this.client.upsert(collection, {
      wait: true,
      points: points.map((p) => ({ id: p.id, vector: p.vector, payload: p.payload })),
    });
    this.logger.log(`Upserted ${points.length} points to ${collection}`);
  }

  async search(collection: string, vector: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    const results = await this.client.search(collection, {
      vector,
      limit: options.limit ?? 10,
      filter: options.filter as Parameters<QdrantClient['search']>[1]['filter'],
      score_threshold: options.scoreThreshold,
      with_payload: true,
    });
    return results.map((r) => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as Record<string, unknown>,
    }));
  }

  async deleteByFilter(collection: string, filter: Record<string, unknown>): Promise<void> {
    await this.client.delete(collection, {
      wait: true,
      filter: filter as Parameters<QdrantClient['delete']>[1]['filter'],
    });
  }

  getDefaultCollection(): string {
    return this.collectionName;
  }
}
```

- [ ] **Step 4: Create src/qdrant/qdrant.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { QdrantService } from './qdrant.service';

@Module({
  providers: [QdrantService],
  exports: [QdrantService],
})
export class QdrantModule {}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npx jest test/qdrant/qdrant.service.spec.ts --no-coverage
```

Expected: PASS.

---

## Task 6: Markdown Chunker Service

**Files:**
- Create: `src/ingestion/markdown-chunker.service.ts`
- Test: `test/ingestion/markdown-chunker.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `test/ingestion/markdown-chunker.spec.ts`:

```typescript
import { MarkdownChunkerService } from '../../src/ingestion/markdown-chunker.service';

describe('MarkdownChunkerService', () => {
  let service: MarkdownChunkerService;

  beforeEach(() => {
    service = new MarkdownChunkerService();
  });

  it('chunks a markdown file by heading boundaries', () => {
    const md = `# Introduction\n\nSome intro text here.\n\n## Section A\n\nContent of section A.\n\n## Section B\n\nContent of section B.`;
    const chunks = service.chunk(md, 'README.md', { repoName: 'test-repo', serviceName: 'test' });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0].heading).toBe('Introduction');
    expect(chunks[0].text).toContain('Some intro text');
  });

  it('returns empty array for empty input', () => {
    const chunks = service.chunk('', 'empty.md', { repoName: 'test-repo' });
    expect(chunks).toHaveLength(0);
  });

  it('detects doc type from file path', () => {
    const chunks = service.chunk('# ADR\n\nDecision record content.', 'docs/adr/001-database.md', { repoName: 'test-repo' });
    expect(chunks[0].docType).toBe('adr');
  });

  it('splits large sections into sub-chunks', () => {
    const longContent = 'Word '.repeat(500);
    const md = `# Big Section\n\n${longContent}`;
    const chunks = service.chunk(md, 'large.md', { repoName: 'test-repo' });
    expect(chunks.length).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npx jest test/ingestion/markdown-chunker.spec.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/ingestion/markdown-chunker.service.ts**

```typescript
import { Injectable } from '@nestjs/common';

export interface ChunkMeta {
  repoName: string;
  serviceName?: string;
}

export interface DocumentChunkData {
  heading: string;
  text: string;
  chunkIndex: number;
  filePath: string;
  docType: string;
  repoName: string;
  serviceName?: string;
  tags: string[];
}

const MAX_CHUNK_WORDS = 400;

@Injectable()
export class MarkdownChunkerService {
  chunk(markdown: string, filePath: string, meta: ChunkMeta): DocumentChunkData[] {
    if (!markdown.trim()) return [];

    const sections = this.splitBySections(markdown);
    const docType = this.detectDocType(filePath);
    const result: DocumentChunkData[] = [];
    let chunkIndex = 0;

    for (const { heading, content } of sections) {
      const subChunks = this.splitByWordCount(content, MAX_CHUNK_WORDS);
      for (const text of subChunks) {
        if (!text.trim()) continue;
        result.push({
          heading,
          text: `${heading ? `# ${heading}\n\n` : ''}${text}`.trim(),
          chunkIndex: chunkIndex++,
          filePath,
          docType,
          repoName: meta.repoName,
          serviceName: meta.serviceName,
          tags: this.extractTags(heading, filePath, docType),
        });
      }
    }

    return result;
  }

  private splitBySections(markdown: string): { heading: string; content: string }[] {
    const lines = markdown.split('\n');
    const sections: { heading: string; content: string }[] = [];
    let currentHeading = '';
    let currentLines: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,3}\s+(.+)/);
      if (headingMatch) {
        if (currentLines.length > 0) {
          sections.push({ heading: currentHeading, content: currentLines.join('\n') });
        }
        currentHeading = headingMatch[1].trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      sections.push({ heading: currentHeading, content: currentLines.join('\n') });
    }

    return sections.length > 0 ? sections : [{ heading: '', content: markdown }];
  }

  private splitByWordCount(text: string, maxWords: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return [text];

    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += maxWords) {
      chunks.push(words.slice(i, i + maxWords).join(' '));
    }
    return chunks;
  }

  private detectDocType(filePath: string): string {
    const lower = filePath.toLowerCase();
    if (lower.includes('/adr/') || lower.includes('decision')) return 'adr';
    if (lower.includes('readme')) return 'readme';
    if (lower.includes('runbook') || lower.includes('ops')) return 'runbook';
    if (lower.includes('api') || lower.includes('swagger')) return 'api-docs';
    if (lower.includes('k8s') || lower.includes('kubernetes')) return 'infrastructure';
    if (lower.includes('claude.md') || lower.includes('agents.md')) return 'agent-instructions';
    if (lower.includes('system.md')) return 'system';
    if (lower.includes('business.md') || lower.includes('goals')) return 'business';
    return 'documentation';
  }

  private extractTags(heading: string, filePath: string, docType: string): string[] {
    const tags = new Set([docType]);
    const parts = filePath.split('/').filter(Boolean);
    if (parts.length > 0) tags.add(parts[0]);
    const keyTerms = ['auth', 'deploy', 'database', 'api', 'kubernetes', 'security', 'migration'];
    for (const term of keyTerms) {
      if (heading.toLowerCase().includes(term) || filePath.toLowerCase().includes(term)) {
        tags.add(term);
      }
    }
    return Array.from(tags);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npx jest test/ingestion/markdown-chunker.spec.ts --no-coverage
```

Expected: PASS — 4 tests pass.

---

## Task 7: Embedding Service

**Files:**
- Create: `src/ingestion/embedding.service.ts`

- [ ] **Step 1: Write the failing test**

Create `test/ingestion/embedding.service.spec.ts`:

```typescript
import { EmbeddingService } from '../../src/ingestion/embedding.service';

const mockCreate = jest.fn();

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    embeddings: { create: mockCreate },
  })),
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
    mockCreate.mockReset();
    service = new EmbeddingService();
  });

  it('embeds a batch of texts', async () => {
    mockCreate.mockResolvedValueOnce({
      data: [
        { embedding: new Array(1536).fill(0.1), index: 0 },
        { embedding: new Array(1536).fill(0.2), index: 1 },
      ],
    });

    const results = await service.embedBatch(['hello world', 'foo bar']);
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveLength(1536);
  });

  it('retries on failure then succeeds', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValueOnce({ data: [{ embedding: new Array(1536).fill(0.5), index: 0 }] });

    const results = await service.embedBatch(['retry me']);
    expect(results[0]).toHaveLength(1536);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npx jest test/ingestion/embedding.service.spec.ts --no-coverage
```

Expected: FAIL.

- [ ] **Step 3: Create src/ingestion/embedding.service.ts**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const all: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const embeddings = await this.embedWithRetry(batch);
      all.push(...embeddings);
    }
    return all;
  }

  async embedSingle(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text]);
    return embedding;
  }

  private async embedWithRetry(texts: string[]): Promise<number[][]> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: texts,
        });
        const sorted = response.data.sort((a, b) => a.index - b.index);
        return sorted.map((d) => d.embedding);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(`Embedding attempt ${attempt} failed: ${lastError.message}`);
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        }
      }
    }
    throw lastError;
  }

  getModelName(): string {
    return this.model;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npx jest test/ingestion/embedding.service.spec.ts --no-coverage
```

Expected: PASS — 2 tests pass.

---

## Task 8: Git Sync Service

**Files:**
- Create: `src/ingestion/git-sync.service.ts`
- Test: `test/ingestion/git-sync.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `test/ingestion/git-sync.spec.ts`:

```typescript
import { GitSyncService } from '../../src/ingestion/git-sync.service';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

describe('GitSyncService', () => {
  let service: GitSyncService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-sync-test-'));
    process.env.GIT_REPOS_DIR = tmpDir;
    service = new GitSyncService();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists markdown files from a local directory', async () => {
    const repoDir = path.join(tmpDir, 'test-repo');
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Test\n\nContent.');
    fs.writeFileSync(path.join(repoDir, 'docs', 'guide.md'), '# Guide\n\nGuide content.', { flag: 'w' });
    fs.mkdirSync(path.join(repoDir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'docs', 'guide.md'), '# Guide\n\nGuide content.');

    const files = await service.listMarkdownFiles(repoDir);
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files.some((f) => f.endsWith('README.md'))).toBe(true);
  });

  it('reads file content', async () => {
    const repoDir = path.join(tmpDir, 'test-repo');
    fs.mkdirSync(repoDir, { recursive: true });
    const filePath = path.join(repoDir, 'README.md');
    fs.writeFileSync(filePath, '# Hello\n\nWorld.');

    const content = await service.readFile(filePath);
    expect(content).toContain('Hello');
  });

  it('gets repo local path from name', () => {
    const localPath = service.getLocalPath('my-service');
    expect(localPath).toContain('my-service');
    expect(localPath).toContain(tmpDir);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npx jest test/ingestion/git-sync.spec.ts --no-coverage
```

Expected: FAIL.

- [ ] **Step 3: Create src/ingestion/git-sync.service.ts**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

const MARKDOWN_EXTENSIONS = ['.md', '.mdx'];
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'coverage', 'vendor'];

@Injectable()
export class GitSyncService {
  private readonly logger = new Logger(GitSyncService.name);
  private readonly reposDir: string;

  constructor() {
    this.reposDir = process.env.GIT_REPOS_DIR || '/data/repos';
  }

  async cloneOrPull(repoName: string, repoUrl: string): Promise<string> {
    const localPath = this.getLocalPath(repoName);

    if (fs.existsSync(path.join(localPath, '.git'))) {
      this.logger.log(`Pulling ${repoName}...`);
      const git: SimpleGit = simpleGit(localPath);
      await git.pull();
    } else {
      this.logger.log(`Cloning ${repoName} from ${repoUrl}...`);
      fs.mkdirSync(localPath, { recursive: true });
      await simpleGit().clone(repoUrl, localPath);
    }

    return localPath;
  }

  async getHeadCommit(localPath: string): Promise<string> {
    try {
      const git: SimpleGit = simpleGit(localPath);
      const log = await git.log({ maxCount: 1 });
      return log.latest?.hash ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async listMarkdownFiles(dirPath: string): Promise<string[]> {
    const results: string[] = [];
    this.walkDir(dirPath, results);
    return results;
  }

  async readFile(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf-8');
  }

  getLocalPath(repoName: string): string {
    return path.join(this.reposDir, repoName);
  }

  private walkDir(dir: string, results: string[]): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (EXCLUDED_DIRS.includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walkDir(fullPath, results);
      } else if (MARKDOWN_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npx jest test/ingestion/git-sync.spec.ts --no-coverage
```

Expected: PASS — 3 tests pass.

---

## Task 9: Ingestion Service & Controller

**Files:**
- Create: `src/ingestion/ingestion.service.ts`
- Create: `src/ingestion/ingestion.controller.ts`
- Create: `src/ingestion/ingestion.module.ts`

Contracts used in this task:

```typescript
// POST /ingestion/trigger body
const TriggerIngestionRequestSchema = z.object({
  repoName: z.string().min(1),
  repoUrl: z.string().url(),
  force: z.boolean().default(false),
});

// GET /ingestion/status response
const IngestionStatusResponseSchema = z.object({
  jobs: z.array(z.object({
    id: z.string(),
    repoName: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    chunksProcessed: z.number(),
    chunksTotal: z.number(),
    errorMessage: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
});
```

- [ ] **Step 1: Create src/ingestion/ingestion.service.ts**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { IngestionJob } from '../database/entities/ingestion-job.entity';
import { DocumentChunk } from '../database/entities/document-chunk.entity';
import { GitSyncService } from './git-sync.service';
import { MarkdownChunkerService } from './markdown-chunker.service';
import { EmbeddingService } from './embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(IngestionJob)
    private readonly jobRepo: Repository<IngestionJob>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    private readonly gitSync: GitSyncService,
    private readonly chunker: MarkdownChunkerService,
    private readonly embedder: EmbeddingService,
    private readonly qdrant: QdrantService,
  ) {}

  async triggerIngestion(repoName: string, repoUrl: string, force = false): Promise<IngestionJob> {
    const job = this.jobRepo.create({
      repoName,
      repoUrl,
      status: 'pending',
      chunksProcessed: 0,
      chunksTotal: 0,
    });
    await this.jobRepo.save(job);

    this.runIngestion(job, force).catch((err) => {
      this.logger.error(`Ingestion failed for ${repoName}: ${err.message}`);
    });

    return job;
  }

  private async runIngestion(job: IngestionJob, force: boolean): Promise<void> {
    job.status = 'running';
    await this.jobRepo.save(job);

    try {
      const localPath = await this.gitSync.cloneOrPull(job.repoName, job.repoUrl);
      const commitHash = await this.gitSync.getHeadCommit(localPath);

      if (!force && job.lastCommitHash === commitHash) {
        this.logger.log(`${job.repoName} is up to date at ${commitHash}`);
        job.status = 'completed';
        await this.jobRepo.save(job);
        return;
      }

      const files = await this.gitSync.listMarkdownFiles(localPath);
      job.chunksTotal = files.length;
      await this.jobRepo.save(job);

      // Delete old chunks for this repo from Qdrant
      const collection = this.qdrant.getDefaultCollection();
      await this.qdrant.deleteByFilter(collection, {
        must: [{ key: 'repoName', match: { value: job.repoName } }],
      });
      await this.chunkRepo.delete({ repoName: job.repoName });

      for (const filePath of files) {
        const relativePath = filePath.replace(localPath, '').replace(/^\//, '');
        const content = await this.gitSync.readFile(filePath);
        const chunks = this.chunker.chunk(content, relativePath, { repoName: job.repoName });

        if (chunks.length === 0) {
          job.chunksProcessed++;
          await this.jobRepo.save(job);
          continue;
        }

        const texts = chunks.map((c) => c.text);
        const embeddings = await this.embedder.embedBatch(texts);

        const qdrantPoints = chunks.map((c, i) => ({
          id: randomUUID(),
          vector: embeddings[i],
          payload: {
            repoName: c.repoName,
            serviceName: c.serviceName ?? null,
            filePath: c.filePath,
            docType: c.docType,
            heading: c.heading,
            text: c.text,
            tags: c.tags,
            chunkIndex: c.chunkIndex,
          },
        }));

        await this.qdrant.upsertBatch(collection, qdrantPoints);

        const entities = chunks.map((c, i) =>
          this.chunkRepo.create({
            repoName: c.repoName,
            serviceName: c.serviceName,
            filePath: c.filePath,
            docType: c.docType,
            chunkText: c.text,
            chunkIndex: c.chunkIndex,
            embeddingModel: this.embedder.getModelName(),
            qdrantId: qdrantPoints[i].id,
            gitCommitHash: commitHash,
            tags: c.tags,
          }),
        );
        await this.chunkRepo.save(entities);

        job.chunksProcessed++;
        await this.jobRepo.save(job);
      }

      job.status = 'completed';
      job.lastCommitHash = commitHash;
      await this.jobRepo.save(job);
      this.logger.log(`Ingestion complete for ${job.repoName}: ${job.chunksProcessed} files processed`);
    } catch (err) {
      job.status = 'failed';
      job.errorMessage = err instanceof Error ? err.message : String(err);
      await this.jobRepo.save(job);
      throw err;
    }
  }

  async getStatus(): Promise<IngestionJob[]> {
    return this.jobRepo.find({ order: { createdAt: 'DESC' }, take: 50 });
  }
}
```

- [ ] **Step 2: Create src/ingestion/ingestion.controller.ts**

```typescript
import { Controller, Post, Get, Body, HttpCode, UsePipes } from '@nestjs/common';
import { z } from 'zod';
import { IngestionService } from './ingestion.service';
import { ZodValidationPipe } from '../contracts/zod-validation.pipe';
import { parseOrThrow } from '../contracts/parse-or-throw';

const TriggerIngestionRequestSchema = z.object({
  repoName: z.string().min(1),
  repoUrl: z.string().url(),
  force: z.boolean().default(false),
});

const IngestionStatusResponseSchema = z.object({
  jobs: z.array(z.object({
    id: z.string(),
    repoName: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    chunksProcessed: z.number(),
    chunksTotal: z.number(),
    errorMessage: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
});

type TriggerIngestionRequest = z.infer<typeof TriggerIngestionRequestSchema>;

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('trigger')
  @HttpCode(202)
  @UsePipes(new ZodValidationPipe(TriggerIngestionRequestSchema))
  async trigger(@Body() body: TriggerIngestionRequest) {
    const job = await this.ingestionService.triggerIngestion(body.repoName, body.repoUrl, body.force);
    return { jobId: job.id, status: job.status, repoName: job.repoName };
  }

  @Get('status')
  async status() {
    const jobs = await this.ingestionService.getStatus();
    return parseOrThrow(
      IngestionStatusResponseSchema,
      {
        jobs: jobs.map((j) => ({
          id: j.id,
          repoName: j.repoName,
          status: j.status,
          chunksProcessed: j.chunksProcessed,
          chunksTotal: j.chunksTotal,
          errorMessage: j.errorMessage ?? null,
          createdAt: j.createdAt.toISOString(),
          updatedAt: j.updatedAt.toISOString(),
        })),
      },
      'ingestion.status',
    );
  }
}
```

- [ ] **Step 3: Create src/ingestion/ingestion.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { GitSyncService } from './git-sync.service';
import { MarkdownChunkerService } from './markdown-chunker.service';
import { EmbeddingService } from './embedding.service';
import { IngestionJob } from '../database/entities/ingestion-job.entity';
import { DocumentChunk } from '../database/entities/document-chunk.entity';
import { QdrantModule } from '../qdrant/qdrant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IngestionJob, DocumentChunk]),
    QdrantModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService, GitSyncService, MarkdownChunkerService, EmbeddingService],
  exports: [IngestionService],
})
export class IngestionModule {}
```

---

## Task 10: Retrieval Service & Controller

**Files:**
- Create: `src/retrieval/retrieval.service.ts`
- Create: `src/retrieval/retrieval.controller.ts`
- Create: `src/retrieval/retrieval.module.ts`

- [ ] **Step 1: Write the failing test**

Create `test/retrieval/retrieval.service.spec.ts`:

```typescript
import { RetrievalService } from '../../src/retrieval/retrieval.service';

const mockEmbedder = {
  embedSingle: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
};

const mockQdrant = {
  search: jest.fn().mockResolvedValue([
    {
      id: 'abc-123',
      score: 0.92,
      payload: {
        repoName: 'shared',
        filePath: 'ECOSYSTEM_MAP.md',
        docType: 'documentation',
        heading: 'Services',
        text: 'Service list content...',
        tags: ['documentation'],
      },
    },
  ]),
  getDefaultCollection: jest.fn().mockReturnValue('ecosystem_docs'),
};

describe('RetrievalService', () => {
  let service: RetrievalService;

  beforeEach(() => {
    service = new RetrievalService(mockEmbedder as any, mockQdrant as any);
  });

  it('searches and returns ranked results', async () => {
    const results = await service.search({ query: 'service ports', limit: 5 });
    expect(results.results).toHaveLength(1);
    expect(results.results[0].score).toBe(0.92);
    expect(results.results[0].repoName).toBe('shared');
  });

  it('filters by repo name', async () => {
    await service.search({ query: 'auth', repoName: 'auth-microservice', limit: 3 });
    const callArgs = mockQdrant.search.mock.calls[0];
    expect(callArgs[2].filter).toBeDefined();
  });

  it('builds agent context from top chunks', async () => {
    const ctx = await service.agentContext({ query: 'deployment', maxTokens: 2000 });
    expect(ctx.context).toBeTruthy();
    expect(ctx.sources).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npx jest test/retrieval/retrieval.service.spec.ts --no-coverage
```

Expected: FAIL.

- [ ] **Step 3: Create src/retrieval/retrieval.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { EmbeddingService } from '../ingestion/embedding.service';
import { QdrantService, SearchOptions } from '../qdrant/qdrant.service';

export interface SearchRequest {
  query: string;
  limit?: number;
  repoName?: string;
  docType?: string;
  serviceName?: string;
  scoreThreshold?: number;
}

export interface SearchResultItem {
  id: string;
  score: number;
  repoName: string;
  filePath: string;
  docType: string;
  heading: string;
  text: string;
  tags: string[];
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
}

export interface AgentContextRequest {
  query: string;
  maxTokens?: number;
  repoName?: string;
  docType?: string;
}

export interface AgentContextResponse {
  query: string;
  context: string;
  sources: { repoName: string; filePath: string; heading: string; score: number }[];
  estimatedTokens: number;
}

const WORDS_PER_TOKEN = 0.75;

@Injectable()
export class RetrievalService {
  constructor(
    private readonly embedder: EmbeddingService,
    private readonly qdrant: QdrantService,
  ) {}

  async search(req: SearchRequest): Promise<SearchResponse> {
    const vector = await this.embedder.embedSingle(req.query);
    const collection = this.qdrant.getDefaultCollection();
    const options: SearchOptions = {
      limit: req.limit ?? 10,
      scoreThreshold: req.scoreThreshold ?? 0.5,
    };

    if (req.repoName || req.docType || req.serviceName) {
      const must: Record<string, unknown>[] = [];
      if (req.repoName) must.push({ key: 'repoName', match: { value: req.repoName } });
      if (req.docType) must.push({ key: 'docType', match: { value: req.docType } });
      if (req.serviceName) must.push({ key: 'serviceName', match: { value: req.serviceName } });
      options.filter = { must };
    }

    const raw = await this.qdrant.search(collection, vector, options);

    const results: SearchResultItem[] = raw.map((r) => ({
      id: r.id,
      score: r.score,
      repoName: String(r.payload['repoName'] ?? ''),
      filePath: String(r.payload['filePath'] ?? ''),
      docType: String(r.payload['docType'] ?? ''),
      heading: String(r.payload['heading'] ?? ''),
      text: String(r.payload['text'] ?? ''),
      tags: Array.isArray(r.payload['tags']) ? (r.payload['tags'] as string[]) : [],
    }));

    return { query: req.query, results, total: results.length };
  }

  async agentContext(req: AgentContextRequest): Promise<AgentContextResponse> {
    const maxTokens = req.maxTokens ?? 3000;
    const limit = Math.min(20, Math.ceil(maxTokens / 200));

    const response = await this.search({
      query: req.query,
      limit,
      repoName: req.repoName,
      docType: req.docType,
      scoreThreshold: 0.6,
    });

    const contextParts: string[] = [];
    const sources: AgentContextResponse['sources'] = [];
    let tokenCount = 0;

    for (const result of response.results) {
      const wordCount = result.text.split(/\s+/).length;
      const tokenEst = Math.ceil(wordCount / WORDS_PER_TOKEN);
      if (tokenCount + tokenEst > maxTokens) break;

      contextParts.push(
        `--- Source: ${result.repoName}/${result.filePath} (${result.heading}) ---\n${result.text}`,
      );
      sources.push({
        repoName: result.repoName,
        filePath: result.filePath,
        heading: result.heading,
        score: result.score,
      });
      tokenCount += tokenEst;
    }

    return {
      query: req.query,
      context: contextParts.join('\n\n'),
      sources,
      estimatedTokens: tokenCount,
    };
  }
}
```

- [ ] **Step 4: Create src/retrieval/retrieval.controller.ts**

```typescript
import { Controller, Post, Body, HttpCode, UsePipes } from '@nestjs/common';
import { z } from 'zod';
import { RetrievalService } from './retrieval.service';
import { ZodValidationPipe } from '../contracts/zod-validation.pipe';

const SearchRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
  repoName: z.string().optional(),
  docType: z.string().optional(),
  serviceName: z.string().optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
});

const AgentContextRequestSchema = z.object({
  query: z.string().min(1),
  maxTokens: z.number().int().min(100).max(8000).default(3000),
  repoName: z.string().optional(),
  docType: z.string().optional(),
});

type SearchRequest = z.infer<typeof SearchRequestSchema>;
type AgentContextRequest = z.infer<typeof AgentContextRequestSchema>;

@Controller('retrieval')
export class RetrievalController {
  constructor(private readonly retrievalService: RetrievalService) {}

  @Post('search')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(SearchRequestSchema))
  async search(@Body() body: SearchRequest) {
    return this.retrievalService.search(body);
  }

  @Post('agent-context')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(AgentContextRequestSchema))
  async agentContext(@Body() body: AgentContextRequest) {
    return this.retrievalService.agentContext(body);
  }
}
```

- [ ] **Step 5: Create src/retrieval/retrieval.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './retrieval.service';
import { EmbeddingService } from '../ingestion/embedding.service';
import { QdrantModule } from '../qdrant/qdrant.module';

@Module({
  imports: [QdrantModule],
  controllers: [RetrievalController],
  providers: [RetrievalService, EmbeddingService],
})
export class RetrievalModule {}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npx jest test/retrieval/retrieval.service.spec.ts --no-coverage
```

Expected: PASS — 3 tests pass.

---

## Task 11: Health Controller & App Module

**Files:**
- Create: `src/health.controller.ts`
- Create: `src/app.module.ts`

- [ ] **Step 1: Create src/health.controller.ts**

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from './service-identity/public.decorator';
import { parseOrThrow } from './contracts/parse-or-throw';
import { HealthResponseSchema } from './contracts/http-responses.contract';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check() {
    return parseOrThrow(
      HealthResponseSchema,
      { status: 'ok', service: 'docs-rag-microservice' },
      'health.check',
    );
  }
}
```

- [ ] **Step 2: Create src/app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceIdentityModule } from './service-identity/service-identity.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { QdrantModule } from './qdrant/qdrant.module';
import { HealthController } from './health.controller';
import { DocumentChunk } from './database/entities/document-chunk.entity';
import { IngestionJob } from './database/entities/ingestion-job.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || 'localhost'),
      port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DATABASE_URL ? undefined : (process.env.DB_USER || 'dbadmin'),
      password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
      database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME || 'docs_rag'),
      entities: [DocumentChunk, IngestionJob],
      synchronize: process.env.NODE_ENV !== 'production' || process.env.DB_AUTO_CREATE === 'true',
      logging: process.env.DEBUG_SQL === 'true',
    }),
    ServiceIdentityModule,
    QdrantModule,
    IngestionModule,
    RetrievalModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 3: Build to verify TypeScript compiles**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npm run build 2>&1
```

Expected: `dist/` created, zero TypeScript errors.

---

## Task 12: Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY tsconfig*.json ./
COPY src/ ./src/

RUN npm run build

# ---- runner ----
FROM node:20-slim AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY --from=builder /app/dist ./dist

RUN chown -R node:node /app
USER node

EXPOSE 3397

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3397/health || exit 1

CMD ["node", "dist/main.js"]
```

- [ ] **Step 2: Build Docker image**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
docker build -t localhost:5000/docs-rag-microservice:latest .
```

Expected: Build succeeds, image tagged.

- [ ] **Step 3: Push to registry**

```bash
docker push localhost:5000/docs-rag-microservice:latest
```

Expected: Push succeeds.

---

## Task 13: Kubernetes Manifests

**Files:**
- Create: `k8s/qdrant-deployment.yaml`
- Create: `k8s/configmap.yaml`
- Create: `k8s/external-secret.yaml`
- Create: `k8s/deployment.yaml`
- Create: `k8s/service.yaml`
- Create: `k8s/ingress.yaml`

- [ ] **Step 1: Create k8s/qdrant-deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: qdrant
  namespace: statex-apps
  labels:
    app: qdrant
spec:
  replicas: 1
  selector:
    matchLabels:
      app: qdrant
  template:
    metadata:
      labels:
        app: qdrant
    spec:
      containers:
        - name: qdrant
          image: qdrant/qdrant:v1.9.0
          ports:
            - containerPort: 6333
              name: http
            - containerPort: 6334
              name: grpc
          resources:
            requests:
              memory: "256Mi"
              cpu: "50m"
            limits:
              memory: "1Gi"
              cpu: "500m"
          volumeMounts:
            - name: qdrant-storage
              mountPath: /qdrant/storage
          readinessProbe:
            httpGet:
              path: /readyz
              port: 6333
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /livez
              port: 6333
            periodSeconds: 10
      volumes:
        - name: qdrant-storage
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: qdrant
  namespace: statex-apps
spec:
  selector:
    app: qdrant
  ports:
    - name: http
      port: 6333
      targetPort: 6333
```

- [ ] **Step 2: Create k8s/configmap.yaml**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: docs-rag-microservice-config
  namespace: statex-apps
  labels:
    app: docs-rag-microservice
data:
  NODE_ENV: "production"
  SERVICE_NAME: "docs-rag-microservice"
  DOMAIN: "docs-rag.alfares.cz"
  PORT: "3397"
  LOG_LEVEL: "INFO"

  AUTH_SERVICE_URL: "http://auth-microservice.statex-apps.svc.cluster.local:3370"
  LOGGING_SERVICE_URL: "http://logging-microservice.statex-apps.svc.cluster.local:3367"
  NOTIFICATION_SERVICE_URL: "http://notifications-microservice.statex-apps.svc.cluster.local:3368"

  DB_HOST: "db-server-postgres"
  DB_PORT: "5432"
  DB_USER: "dbadmin"
  DB_NAME: "docs_rag"
  DB_AUTO_CREATE: "true"
  DB_SYNC: "false"

  QDRANT_URL: "http://qdrant.statex-apps.svc.cluster.local:6333"
  QDRANT_COLLECTION: "ecosystem_docs"

  OPENAI_EMBEDDING_MODEL: "text-embedding-3-small"

  GIT_REPOS_DIR: "/data/repos"
```

- [ ] **Step 3: Create k8s/external-secret.yaml**

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: docs-rag-microservice-secret
  namespace: statex-apps
spec:
  refreshInterval: 5m
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: docs-rag-microservice-secret
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: secret/prod/docs-rag-microservice
        property: DATABASE_URL
    - secretKey: DB_PASSWORD
      remoteRef:
        key: secret/prod/docs-rag-microservice
        property: DB_PASSWORD
    - secretKey: JWT_SECRET
      remoteRef:
        key: secret/prod/docs-rag-microservice
        property: JWT_SECRET
    - secretKey: OPENAI_API_KEY
      remoteRef:
        key: secret/prod/docs-rag-microservice
        property: OPENAI_API_KEY
    - secretKey: TELEGRAM_CHAT_ID
      remoteRef:
        key: secret/prod/docs-rag-microservice
        property: TELEGRAM_CHAT_ID
```

- [ ] **Step 4: Create k8s/deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: docs-rag-microservice
  namespace: statex-apps
  labels:
    app: docs-rag-microservice
spec:
  replicas: 1
  selector:
    matchLabels:
      app: docs-rag-microservice
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  template:
    metadata:
      labels:
        app: docs-rag-microservice
    spec:
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
        - name: app
          image: localhost:5000/docs-rag-microservice:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 3397
              name: http
          envFrom:
            - configMapRef:
                name: docs-rag-microservice-config
            - secretRef:
                name: docs-rag-microservice-secret
          startupProbe:
            httpGet:
              path: /health
              port: 3397
            failureThreshold: 30
            periodSeconds: 10
            timeoutSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 3397
            periodSeconds: 10
            failureThreshold: 3
            timeoutSeconds: 5
          readinessProbe:
            httpGet:
              path: /health
              port: 3397
            initialDelaySeconds: 15
            periodSeconds: 5
            failureThreshold: 3
            timeoutSeconds: 5
          resources:
            requests:
              memory: "256Mi"
              cpu: "50m"
            limits:
              memory: "1Gi"
              cpu: "500m"
          volumeMounts:
            - name: repos-storage
              mountPath: /data/repos
      volumes:
        - name: repos-storage
          emptyDir:
            sizeLimit: "5Gi"
```

- [ ] **Step 5: Create k8s/service.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: docs-rag-microservice
  namespace: statex-apps
  labels:
    app: docs-rag-microservice
spec:
  selector:
    app: docs-rag-microservice
  ports:
    - name: http
      port: 3397
      targetPort: 3397
```

- [ ] **Step 6: Create k8s/ingress.yaml**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: docs-rag-microservice
  namespace: statex-apps
  labels:
    app: docs-rag-microservice
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - docs-rag.alfares.cz
      secretName: docs-rag-microservice-tls
  rules:
    - host: docs-rag.alfares.cz
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: docs-rag-microservice
                port:
                  number: 3397
```

---

## Task 14: Vault Secrets Setup

- [ ] **Step 1: Create Vault secret path**

```bash
# Verify Vault is accessible
VAULT_ADDR=http://127.0.0.1:8200 vault status

# Write secrets (replace values with real ones)
VAULT_ADDR=http://127.0.0.1:8200 vault kv put secret/prod/docs-rag-microservice \
  DATABASE_URL="postgresql://dbadmin:<PASSWORD>@db-server-postgres.statex-apps.svc.cluster.local:5432/docs_rag" \
  DB_PASSWORD="<PASSWORD>" \
  JWT_SECRET="<SAME_JWT_SECRET_AS_OTHER_SERVICES>" \
  OPENAI_API_KEY="<OPENAI_KEY>" \
  TELEGRAM_CHAT_ID="<CHAT_ID>"
```

Expected: `Success! Data written to: secret/prod/docs-rag-microservice`

- [ ] **Step 2: Create the PostgreSQL database**

```bash
kubectl exec -it -n statex-apps $(kubectl get pod -n statex-apps -l app=db-server-postgres -o name | head -1) -- \
  psql -U dbadmin -c "CREATE DATABASE docs_rag;"
```

Expected: `CREATE DATABASE`

---

## Task 15: Deploy to Kubernetes

- [ ] **Step 1: Apply Qdrant**

```bash
kubectl apply -f /home/ssf/Documents/Github/docs-rag-microservice/k8s/qdrant-deployment.yaml
kubectl rollout status deployment/qdrant -n statex-apps --timeout=60s
```

Expected: `deployment "qdrant" successfully rolled out`

- [ ] **Step 2: Apply configmap and external secret**

```bash
kubectl apply -f /home/ssf/Documents/Github/docs-rag-microservice/k8s/configmap.yaml
kubectl apply -f /home/ssf/Documents/Github/docs-rag-microservice/k8s/external-secret.yaml
```

- [ ] **Step 3: Wait for ESO to sync secret**

```bash
kubectl get externalsecret docs-rag-microservice-secret -n statex-apps -w
```

Wait until `STATUS` shows `SecretSynced`.

- [ ] **Step 4: Apply service and deployment**

```bash
kubectl apply -f /home/ssf/Documents/Github/docs-rag-microservice/k8s/service.yaml
kubectl apply -f /home/ssf/Documents/Github/docs-rag-microservice/k8s/deployment.yaml
kubectl rollout status deployment/docs-rag-microservice -n statex-apps --timeout=120s
```

Expected: `deployment "docs-rag-microservice" successfully rolled out`

- [ ] **Step 5: Apply ingress**

```bash
kubectl apply -f /home/ssf/Documents/Github/docs-rag-microservice/k8s/ingress.yaml
```

- [ ] **Step 6: Verify health endpoint**

```bash
curl -s http://localhost:3397/health || \
kubectl exec -n statex-apps deploy/docs-rag-microservice -- wget -qO- http://localhost:3397/health
```

Expected: `{"status":"ok","service":"docs-rag-microservice"}`

---

## Task 16: Trigger First Ingestion & Smoke Test

- [ ] **Step 1: Trigger ingestion of shared docs**

```bash
curl -s -X POST http://docs-rag.alfares.cz/ingestion/trigger \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(VAULT_ADDR=http://127.0.0.1:8200 vault kv get -field=JWT_SECRET secret/prod/docs-rag-microservice)" \
  -d '{"repoName":"shared","repoUrl":"git@github.com:speakASAP/shared.git","force":false}'
```

Expected: `{"jobId":"...","status":"pending","repoName":"shared"}`

- [ ] **Step 2: Check ingestion status**

```bash
curl -s http://docs-rag.alfares.cz/ingestion/status | python3 -m json.tool
```

Expected: job transitions from `pending` → `running` → `completed`.

- [ ] **Step 3: Smoke test retrieval**

```bash
curl -s -X POST http://docs-rag.alfares.cz/retrieval/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{"query":"microservice port assignments","limit":3}'
```

Expected: results with `score > 0.5` and `repoName: "shared"`.

- [ ] **Step 4: Test agent-context endpoint**

```bash
curl -s -X POST http://docs-rag.alfares.cz/retrieval/agent-context \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -d '{"query":"how to deploy a new microservice","maxTokens":2000}'
```

Expected: `context` field contains meaningful text, `estimatedTokens < 2000`.

---

## Task 17: Agent Docs (Required by Ecosystem Standard)

**Files:**
- Create: `CLAUDE.md`
- Create: `SYSTEM.md`
- Create: `AGENTS.md`
- Create: `BUSINESS.md`
- Create: `TASKS.md`
- Create: `STATE.json`

- [ ] **Step 1: Create SYSTEM.md**

```markdown
# docs-rag-microservice — SYSTEM.md

## Stack
- Runtime: Node.js 20 + NestJS 10
- Language: TypeScript
- Port: 3397
- Domain: docs-rag.alfares.cz

## Key services
- PostgreSQL: docs_rag database — chunk metadata, ingestion jobs
- Qdrant: vector DB at qdrant.statex-apps.svc.cluster.local:6333, collection: ecosystem_docs
- OpenAI: text-embedding-3-small for embeddings

## API Endpoints
- GET /health — public, liveness check
- POST /ingestion/trigger — trigger repo ingestion (JWT required)
- GET /ingestion/status — list recent ingestion jobs (JWT required)
- POST /retrieval/search — semantic + filtered search (JWT required)
- POST /retrieval/agent-context — token-limited context for AI agents (JWT required)

## Deployment
K8s namespace: statex-apps
Secrets: Vault path secret/prod/docs-rag-microservice → ESO → K8s Secret docs-rag-microservice-secret

## Auth
Service-to-service JWT (HS256). JWT_SECRET from Vault. @Public() for /health only.
```

- [ ] **Step 2: Create CLAUDE.md**

```markdown
# docs-rag-microservice — CLAUDE.md

Ecosystem RAG service. Ingests docs from Git repos, embeds via OpenAI, stores in Qdrant, serves hybrid search API.

Read SYSTEM.md for ports, endpoints, and deployment details.

## Key patterns
- Auth: ServiceAuthGuard + JWT Bearer — all endpoints except /health require token
- Contracts: Zod schemas via ZodValidationPipe + parseOrThrow()
- Entities: DocumentChunk (chunk metadata) + IngestionJob (sync tracking)
- Qdrant: QdrantService wraps @qdrant/js-client-rest

## Never do
- Never expose /health with auth required
- Never hardcode Vault secrets — always use ESO
- Never store raw embeddings in PostgreSQL (Qdrant only)
```

- [ ] **Step 3: Create AGENTS.md, BUSINESS.md, TASKS.md, STATE.json**

AGENTS.md:
```markdown
# AGENTS.md

## Boundaries
- Ingestion agents: trigger via POST /ingestion/trigger
- Retrieval agents: use POST /retrieval/agent-context (token-limited)
- Never query Git directly if this service is running

## Commands
- Build: npm run build
- Test: npm test
- Deploy: kubectl apply -f k8s/
```

BUSINESS.md:
```markdown
# BUSINESS.md

Reduces AI token costs by providing cached ecosystem knowledge via RAG instead of raw Git reads.
Every agent query that hits this service instead of reading files saves ~2000-5000 tokens.
```

TASKS.md:
```markdown
# TASKS.md
<!-- Backlog populated by agents -->
```

STATE.json:
```json
{
  "stage": "initial-deploy",
  "health": "unknown",
  "cycle": 0
}
```

---

## Task 18: Run Full Test Suite

- [ ] **Step 1: Run all unit tests**

```bash
cd /home/ssf/Documents/Github/docs-rag-microservice
npm test -- --no-coverage 2>&1
```

Expected: All tests pass. Minimum: markdown-chunker (4), git-sync (3), embedding (2), qdrant (2), retrieval (3) = 14 tests.

- [ ] **Step 2: Update Issue #1 with completion summary**

```bash
gh issue comment 1 --repo speakASAP/docs-rag-microservice --body "## Implementation Complete

**What was done:**
- NestJS microservice scaffolded (port 3397, domain docs-rag.alfares.cz)
- Zod contract system (parse-or-throw, ZodValidationPipe, ContractViolationFilter)
- JWT service-auth guard (ServiceIdentityModule pattern)
- TypeORM entities: DocumentChunk + IngestionJob
- QdrantService: collection management, batch upsert, vector search
- MarkdownChunkerService: semantic heading-based splitting, doc type detection
- EmbeddingService: OpenAI text-embedding-3-small, batch + retry
- GitSyncService: simple-git clone/pull, markdown file walking
- IngestionService: full pipeline orchestration (git → chunk → embed → qdrant)
- RetrievalService: hybrid search + agent-context (token-limited)
- Kubernetes manifests: Qdrant deployment, configmap, ExternalSecret, deployment, service, ingress
- Vault secret path created at secret/prod/docs-rag-microservice
- 14+ unit tests passing

**Files created:** 30+ files across src/, k8s/, test/, docs/

**Outcome:** Service deployed to K8s, /health returns ok, first ingestion of shared/ complete, retrieval smoke test passing."
```

---

## Self-Review Against Spec

| Spec requirement | Covered by task |
|-----------------|----------------|
| Git ingestion + incremental sync | Task 8 (GitSyncService), Task 9 (IngestionService) |
| Markdown chunking | Task 6 (MarkdownChunkerService) |
| Embeddings via OpenAI, batching, retry | Task 7 (EmbeddingService) |
| Qdrant vector storage | Task 5 (QdrantService) |
| Semantic search API | Task 10 (RetrievalService/Controller) |
| AI agent context endpoint | Task 10 (agent-context) |
| Metadata (repo, service, type, version, tags) | Tasks 6, 9 entity fields |
| JWT auth + @Public decorator | Task 3 |
| Vault secrets via ESO | Task 13 (external-secret.yaml) |
| K8s deployment + probes + resources | Task 13 (deployment.yaml) |
| Logging integration | ContractViolationFilter → NOTIFICATION_SERVICE_URL |
| Notification on failures | ContractViolationFilter fire-and-forget |
| Unit tests | Tasks 4, 5, 6, 7, 8, 10 |
| Agent docs (CLAUDE.md, SYSTEM.md etc) | Task 17 |
| Health endpoint | Task 11 |

**Not in this plan (deferred):** Frontend UI, Docusaurus, versioned embeddings rollback, RabbitMQ events, monitoring metrics endpoints. These are V2 scope — the issue marks them as "optional" or they require the base service first.
