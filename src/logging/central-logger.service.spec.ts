import { CentralLogger } from './central-logger.service';

describe('CentralLogger', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('posts sanitized central logs when configured', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.SERVICE_NAME = 'docs-rag-microservice';
    process.env.LOGGING_SERVICE_URL = 'http://logging-microservice:3367/';
    process.env.LOGGING_SERVICE_API_PATH = '/api/logs';

    const logger = new CentralLogger();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    logger.log('synthetic central logging smoke', 'SmokeContext', {
      correlation_id: 'corr-1',
      duration_ms: 42,
      password: 'secret',
      nested: { token: 'hidden', safe: 'ok' },
    });

    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://logging-microservice:3367/api/logs',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      service: 'docs-rag-microservice',
      level: 'info',
      msg: 'synthetic central logging smoke',
      correlation_id: 'corr-1',
      duration_ms: 42,
    });
    // `context` travels inside metadata: a top-level `context` is rejected by
    // the logging-microservice DTO (forbidNonWhitelisted) with a 400.
    expect(body.context).toBeUndefined();
    expect(body.metadata.context).toBe('SmokeContext');
    expect(body.metadata.password).toBe('[REDACTED]');
    expect(body.metadata.nested.token).toBe('[REDACTED]');
    expect(body.metadata.nested.safe).toBe('ok');
  });

  it('adds bearer authorization when LOGGING_SERVICE_TOKEN is set', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.LOGGING_SERVICE_URL = 'http://logging-microservice:3367';
    process.env.LOGGING_SERVICE_TOKEN = 'central-token';

    const logger = new CentralLogger();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    logger.log('token auth smoke', 'SmokeContext');

    await jest.runAllTimersAsync();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://logging-microservice:3367/api/logs',
      expect.objectContaining({
        headers: {
          'content-type': 'application/json',
          Authorization: 'Bearer central-token',
        },
      }),
    );
  });

  it('keeps logging fail-open when central transport rejects', () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    process.env.LOGGING_SERVICE_URL = 'http://logging-microservice:3367';
    expect(() => new CentralLogger().warn('still local')).not.toThrow();
  });
});

describe('central log payload contract', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('never sends a top-level context field (logging-microservice rejects it with 400)', async () => {
    process.env.SERVICE_NAME = 'docs-rag-microservice';
    process.env.LOGGING_SERVICE_URL = 'http://logging-microservice:3367';
    const calls: any[] = [];
    global.fetch = jest.fn((_u: any, init: any) => {
      calls.push(JSON.parse(init.body));
      return Promise.resolve({ ok: true, status: 201, text: () => Promise.resolve('{}') } as any);
    }) as any;

    const { CentralLogger } = require('./central-logger.service');
    const logger = new CentralLogger();
    logger.log('hello', 'SomeContext');

    await new Promise((r) => setTimeout(r, 10));

    expect(calls).toHaveLength(1);
    expect(calls[0].context).toBeUndefined();
    expect(calls[0].metadata?.context).toBe('SomeContext');
  });

  it('reports a non-2xx ingest response instead of swallowing it', async () => {
    process.env.SERVICE_NAME = 'docs-rag-microservice';
    process.env.LOGGING_SERVICE_URL = 'http://logging-microservice:3367';
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"message":["property context should not exist"]}'),
      } as any),
    ) as any;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { CentralLogger } = require('./central-logger.service');
    const logger = new CentralLogger();
    logger.log('hello');

    await new Promise((r) => setTimeout(r, 10));

    const emitted = warnSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(emitted).toMatch(/central log ingest rejected/i);
    expect(emitted).toMatch(/400/);
  });
});
