/**
 * ServiceAuthGuard authorization tests.
 *
 * The defect these cover: before roles existed, every route resolved to the same
 * authority, so any credential that could read one document could also call
 * POST /ingestion/trigger-all and re-index every repository. The first two tests
 * are the regression guard for that.
 */

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHmac } from 'crypto';
import { ServiceAuthGuard } from './service-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from '../auth/roles.decorator';
import { DOCS_RAG_INGEST_ROLES, DOCS_RAG_READ_ROLES } from '../auth/roles.constants';

const SECRET = 'test-secret';

function hs256(serviceId: string, secret = SECRET): string {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const h = b({ alg: 'HS256', typ: 'JWT' });
  const p = b({ serviceId, iss: 'docs-rag-microservice', iat: now, exp: now + 3600 });
  return `${h}.${p}.${createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
}

function contextFor(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: authorization ? { authorization } : {} }) }),
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

/** Reflector stub: `roles` is what @Roles would have set on the route. */
function reflectorFor(roles?: readonly string[], isPublic = false): Reflector {
  return {
    getAllAndOverride: (key: string) => {
      if (key === IS_PUBLIC_KEY) return isPublic;
      if (key === ROLES_KEY) return roles ? { roles } : undefined;
      return undefined;
    },
  } as unknown as Reflector;
}

describe('ServiceAuthGuard', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    process.env.ALLOW_HS256_FALLBACK = 'true';
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it('denies a legacy HS256 caller on an ingest route', async () => {
    const guard = new ServiceAuthGuard(reflectorFor(DOCS_RAG_INGEST_ROLES));
    await expect(guard.canActivate(contextFor(`Bearer ${hs256('runlayer')}`))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows a legacy HS256 caller on a read route while the window is open', async () => {
    const guard = new ServiceAuthGuard(reflectorFor(DOCS_RAG_READ_ROLES));
    await expect(guard.canActivate(contextFor(`Bearer ${hs256('runlayer')}`))).resolves.toBe(true);
  });

  it('denies an undecorated route rather than falling back to a default role set', async () => {
    const guard = new ServiceAuthGuard(reflectorFor(undefined));
    await expect(guard.canActivate(contextFor(`Bearer ${hs256('runlayer')}`))).rejects.toThrow(
      'Route has no authorization policy',
    );
  });

  it('allows a @Public route with no credential', async () => {
    const guard = new ServiceAuthGuard(reflectorFor(undefined, true));
    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
  });

  it('rejects a missing Authorization header on a protected route', async () => {
    const guard = new ServiceAuthGuard(reflectorFor(DOCS_RAG_READ_ROLES));
    await expect(guard.canActivate(contextFor())).rejects.toThrow('Missing service token');
  });

  it('rejects an HS256 token signed with the wrong secret', async () => {
    const guard = new ServiceAuthGuard(reflectorFor(DOCS_RAG_READ_ROLES));
    await expect(
      guard.canActivate(contextFor(`Bearer ${hs256('runlayer', 'wrong-secret')}`)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects every HS256 token once the fallback window is closed', async () => {
    process.env.ALLOW_HS256_FALLBACK = 'false';
    const guard = new ServiceAuthGuard(reflectorFor(DOCS_RAG_READ_ROLES));
    await expect(guard.canActivate(contextFor(`Bearer ${hs256('runlayer')}`))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
