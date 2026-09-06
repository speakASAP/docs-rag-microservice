/**
 * ServiceAuthGuard authorization tests.
 *
 * The defect these cover: before roles existed, every route resolved to the same
 * authority, so any credential that could read one document could also call
 * POST /ingestion/trigger-all and re-index every repository. The first tests
 * are the regression guard for that.
 *
 * HS256 is closed: any legacy shared-secret token must fail immediately.
 */

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHmac } from 'crypto';
import { ServiceAuthGuard } from './service-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from '../auth/roles.decorator';
import { DOCS_RAG_INGEST_ROLES, DOCS_RAG_READ_ROLES } from '../auth/roles.constants';

function hs256(serviceId: string, secret = 'test-secret'): string {
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
  it('denies a legacy HS256 caller on an ingest route', async () => {
    const guard = new ServiceAuthGuard(reflectorFor(DOCS_RAG_INGEST_ROLES));
    await expect(guard.canActivate(contextFor(`Bearer ${hs256('runlayer')}`))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('denies a legacy HS256 caller on a read route', async () => {
    const guard = new ServiceAuthGuard(reflectorFor(DOCS_RAG_READ_ROLES));
    await expect(guard.canActivate(contextFor(`Bearer ${hs256('runlayer')}`))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lets an ingest principal poll ingestion status', async () => {
    // A publisher triggers a job and then polls until it completes. Leaving
    // `ingest` out of the read set made cliplot's publish_docs_rag.sh 401
    // halfway through, after it had already started an ingestion run.
    const verifier = require('../auth/jwt-verifier');
    const spy = jest
      .spyOn(verifier, 'verifyAuthToken')
      .mockResolvedValue({ sub: 'svc-cliplot--docs-rag', roles: ['internal:docs-rag-microservice:ingest'] });

    const guard = new ServiceAuthGuard(reflectorFor(DOCS_RAG_READ_ROLES));
    await expect(guard.canActivate(contextFor('Bearer rs256-token'))).resolves.toBe(true);
    spy.mockRestore();
  });

  it('denies a readonly principal on an ingest route', async () => {
    const verifier = require('../auth/jwt-verifier');
    const spy = jest
      .spyOn(verifier, 'verifyAuthToken')
      .mockResolvedValue({ sub: 'svc-runlayer--docs-rag', roles: ['internal:docs-rag-microservice:readonly'] });

    const guard = new ServiceAuthGuard(reflectorFor(DOCS_RAG_INGEST_ROLES));
    await expect(guard.canActivate(contextFor('Bearer rs256-token'))).rejects.toThrow('Insufficient role');
    spy.mockRestore();
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
});
