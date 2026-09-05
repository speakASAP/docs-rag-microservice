import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from '../auth/roles.decorator';
import { JwtUtil } from './jwt.util';
import { verifyAuthToken } from '../auth/jwt-verifier';

interface ServiceRequest {
  headers: Record<string, string | undefined>;
  serviceId?: string;
  route?: { path?: string };
}

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  private readonly logger = new Logger(ServiceAuthGuard.name);

  constructor(private readonly reflector: Reflector) {}

  private hs256FallbackEnabled(): boolean {
    return process.env.ALLOW_HS256_FALLBACK !== 'false';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<ServiceRequest>();
    const handler = `${context.getClass().name}.${context.getHandler().name}`;

    // Deny undecorated routes rather than falling back to a broad default set.
    // A guard that defaults to the widest roles in the service silently grants
    // mutation rights to read-only callers, which is how warehouse let a
    // read-only principal mutate stock.
    const meta = this.reflector.getAllAndOverride<{ roles?: readonly string[] }>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = meta?.roles ?? [];
    if (requiredRoles.length === 0) {
      this.logger.error(
        `Denied ${handler}: route carries neither @Roles nor @Public. ` +
          'Every route must declare its role set in src/auth/roles.constants.ts.',
      );
      throw new UnauthorizedException('Route has no authorization policy');
    }

    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing service token');
    }
    const token = authHeader.slice(7);

    // RS256 is the target scheme: auth holds the private key, so a compromise of
    // any caller cannot be used to mint tokens this service accepts.
    try {
      const payload = await verifyAuthToken(token);
      const roles = Array.isArray(payload.roles) ? payload.roles : [];
      if (!roles.some((r) => requiredRoles.includes(r))) {
        this.logger.warn(
          `Denied ${payload.sub ?? 'unknown'} on ${handler}: has [${roles.join(', ')}], needs one of [${requiredRoles.join(', ')}]`,
        );
        throw new UnauthorizedException('Insufficient role');
      }
      request.serviceId = payload.serviceName ?? payload.sub;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException && err.message === 'Insufficient role') throw err;

      // Fall through to HS256 only while the migration window is open.
      if (!this.hs256FallbackEnabled()) {
        const message = err instanceof Error ? err.message : 'Invalid token';
        throw new UnauthorizedException(message);
      }
    }

    // Legacy HS256 path. Retained so callers still holding shared-secret tokens
    // keep working until every one has been re-minted as an auth-issued RS256
    // principal; closed by setting ALLOW_HS256_FALLBACK=false.
    //
    // These tokens carry no roles, so they are granted READ only: a legacy
    // credential must never reach an ingestion trigger.
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new UnauthorizedException('JWT_SECRET not configured');

    try {
      const payload = JwtUtil.verify(token, secret);
      const readOnly = requiredRoles.includes('internal:docs-rag-microservice:readonly');
      if (!readOnly) {
        this.logger.warn(
          `Denied legacy HS256 caller ${payload.serviceId} on ${handler}: HS256 tokens are read-only`,
        );
        throw new UnauthorizedException('Insufficient role');
      }
      this.logger.warn(
        `Legacy HS256 token accepted for ${payload.serviceId} on ${handler}. ` +
          'Re-mint as an auth-issued RS256 principal; this lane will be closed.',
      );
      request.serviceId = payload.serviceId;
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid token';
      throw new UnauthorizedException(message);
    }
  }
}
