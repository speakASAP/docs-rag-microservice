import { IngestionService } from '../../src/ingestion/ingestion.service';

/**
 * Regression cover for 2026-08-23: during a rolling update both pods are briefly
 * alive. The new pod's startup reaper ran, then the terminating old pod wrote
 * progress one last time, putting the row back into 'running' with no worker
 * behind it. auth-microservice then sat 'running' at 22/89 indefinitely.
 */
describe('IngestionService stale running job reaper', () => {
  function buildService(running: any[]) {
    const saved: any[] = [];
    const jobRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        saved.push(value);
        return value;
      }),
      findOne: jest.fn(),
      find: jest.fn(async (_opts?: any) => running) as jest.Mock,
    };
    const noop = {} as any;
    const service = new IngestionService(
      jobRepo as any,
      noop,
      noop,
      noop,
      noop,
      noop,
    );
    return { service, jobRepo, saved };
  }

  const callSweep = (service: IngestionService): Promise<void> =>
    (service as unknown as { failStaleRunningJobs(): Promise<void> }).failStaleRunningJobs();

  it('fails a running job whose progress has not moved past the threshold', async () => {
    const stalled = {
      repoName: 'auth-microservice',
      status: 'running',
      chunksProcessed: 22,
      chunksTotal: 89,
      errorMessage: null,
    };
    const { service, saved } = buildService([stalled]);

    await callSweep(service);

    expect(saved).toHaveLength(1);
    expect(saved[0].status).toBe('failed');
    expect(saved[0].errorMessage).toContain('22/89');
  });

  it('queries only running jobs older than the cutoff, never live ones', async () => {
    const { service, jobRepo } = buildService([]);

    await callSweep(service);

    const where = (jobRepo.find as jest.Mock).mock.calls[0][0].where;
    expect(where.status).toBe('running');
    // LessThan(cutoff) — a live job that just wrote progress must not match.
    expect(where.updatedAt).toBeDefined();
  });

  it('writes nothing when no job is stale', async () => {
    const { service, saved } = buildService([]);

    await callSweep(service);

    expect(saved).toHaveLength(0);
  });
});
