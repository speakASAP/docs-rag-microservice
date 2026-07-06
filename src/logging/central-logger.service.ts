import { ConsoleLogger, Injectable } from '@nestjs/common';

type CentralLogLevel = 'error' | 'warn' | 'info' | 'debug';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /password|passwd|pwd|secret|token|authorization|cookie|api[_-]?key|private[_-]?key/i;

interface CentralLogPayload {
  service: string;
  level: CentralLogLevel;
  msg: string;
  timestamp: string;
  context?: string;
  duration_ms?: number;
  correlation_id?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CentralLogger extends ConsoleLogger {
  private readonly serviceName = process.env.SERVICE_NAME || 'docs-rag-microservice';
  private readonly centralLogUrl = buildLoggingUrl(process.env.LOGGING_SERVICE_URL, process.env.LOGGING_SERVICE_API_PATH);

  log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(message as never, ...(optionalParams as never[]));
    this.send('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message as never, ...(optionalParams as never[]));
    this.send('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(message as never, ...(optionalParams as never[]));
    this.send('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(message as never, ...(optionalParams as never[]));
    this.send('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose(message as never, ...(optionalParams as never[]));
    this.send('debug', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    super.fatal(message as never, ...(optionalParams as never[]));
    this.send('error', message, optionalParams);
  }

  private send(level: CentralLogLevel, message: unknown, optionalParams: unknown[]): void {
    if (!this.centralLogUrl || typeof fetch !== 'function') {
      return;
    }

    const payload = this.createPayload(level, message, optionalParams);
    setTimeout(() => {
      void fetch(this.centralLogUrl as string, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    }, 0);
  }

  private createPayload(level: CentralLogLevel, message: unknown, optionalParams: unknown[]): CentralLogPayload {
    const { context, metadata } = extractContextAndMetadata(optionalParams);
    const sanitizedMetadata = sanitizeMetadata(metadata);
    const durationMs = coerceDurationMs(sanitizedMetadata.duration_ms);
    const correlationId = coerceCorrelationId(sanitizedMetadata.correlation_id ?? sanitizedMetadata.correlationId);

    return {
      service: this.serviceName,
      level,
      msg: stringifyMessage(message),
      timestamp: new Date().toISOString(),
      ...(context ? { context } : {}),
      ...(durationMs !== undefined ? { duration_ms: durationMs } : {}),
      ...(correlationId ? { correlation_id: correlationId } : {}),
      ...(Object.keys(sanitizedMetadata).length > 0 ? { metadata: sanitizedMetadata } : {}),
    };
  }
}

function buildLoggingUrl(baseUrl?: string, apiPath = '/api/logs'): string | undefined {
  if (!baseUrl?.trim()) {
    return undefined;
  }

  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  const normalizedPath = (apiPath || '/api/logs').startsWith('/') ? apiPath || '/api/logs' : `/${apiPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

function extractContextAndMetadata(optionalParams: unknown[]): { context?: string; metadata: Record<string, unknown> } {
  const metadata: Record<string, unknown> = {};
  let context: string | undefined;

  for (const param of optionalParams) {
    if (typeof param === 'string') {
      context = param;
      continue;
    }
    if (isPlainObject(param)) {
      Object.assign(metadata, param);
    }
  }

  return { context, metadata };
}

function sanitizeMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(value, 0) as Record<string, unknown>;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (depth > 4) {
    return '[MAX_DEPTH]';
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeValue(item, depth + 1));
  }
  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, item]) => {
      acc[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeValue(item, depth + 1);
      return acc;
    }, {});
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'function' || typeof value === 'symbol') {
    return String(value);
  }
  return value;
}

function stringifyMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  if (message instanceof Error) {
    return message.message;
  }
  try {
    return JSON.stringify(sanitizeValue(message, 0));
  } catch {
    return String(message);
  }
}

function coerceDurationMs(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function coerceCorrelationId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
