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
      context: 'SmokeContext',
    });
    expect(body.metadata.password).toBe('[REDACTED]');
    expect(body.metadata.nested.token).toBe('[REDACTED]');
    expect(body.metadata.nested.safe).toBe('ok');
  });

  it('keeps logging fail-open when central transport rejects', () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    process.env.LOGGING_SERVICE_URL = 'http://logging-microservice:3367';
    expect(() => new CentralLogger().warn('still local')).not.toThrow();
  });
});
