import { IngestionService } from '../../src/ingestion/ingestion.service';

describe('IngestionService commit reuse', () => {
  function buildService(options: { latestCompleted: any; commitHash: string; files?: string[] }) {
    const jobRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      findOne: jest.fn(async () => options.latestCompleted),
      find: jest.fn(),
    };
    const chunkRepo = {
      delete: jest.fn(async () => undefined),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const gitSync = {
      getLocalPath: jest.fn(() => '/repos/catalog-microservice'),
      cloneOrPull: jest.fn(),
      getHeadCommit: jest.fn(async () => options.commitHash),
      prepareForIngestion: jest.fn(async () => ({
        localPath: '/repos/catalog-microservice',
        commitHash: options.commitHash,
      })),
      listMarkdownFiles: jest.fn(async () => options.files ?? ['/repos/catalog-microservice/README.md']),
      readFile: jest.fn(async () => '# Catalog\n\nGoal 24 order affinity blockers.'),
    };
    const chunker = {
      chunk: jest.fn(() => [
        {
          repoName: 'catalog-microservice',
          serviceName: undefined,
          filePath: 'README.md',
          docType: 'readme',
          heading: 'Catalog',
          text: 'Goal 24 order affinity blockers.',
          tags: [],
          chunkIndex: 0,
        },
      ]),
    };
    const embedder = {
      embedBatch: jest.fn(async () => [new Array(768).fill(0.1)]),
      getModelName: jest.fn(() => 'nomic-embed-text'),
    };
    const qdrant = {
      getDefaultCollection: jest.fn(() => 'ecosystem-docs'),
      deleteByFilter: jest.fn(async () => undefined),
      upsertBatch: jest.fn(async () => undefined),
    };

    return {
      service: new IngestionService(jobRepo as any, chunkRepo as any, gitSync as any, chunker as any, embedder as any, qdrant as any),
      mocks: { gitSync, qdrant },
    };
  }

  it('does not skip when the runtime cannot resolve a commit and the previous job indexed no chunks', async () => {
    const { service, mocks } = buildService({
      latestCompleted: { lastCommitHash: 'unknown', chunksProcessed: 0, chunksTotal: 0 },
      commitHash: 'unknown',
    });
    const job: any = {
      repoName: 'catalog-microservice',
      repoUrl: 'local',
      localPath: true,
      status: 'pending',
      chunksProcessed: 0,
      chunksTotal: 0,
    };

    await (service as any).runIngestion(job, false);

    expect(mocks.gitSync.listMarkdownFiles).toHaveBeenCalledWith('/repos/catalog-microservice');
    expect(mocks.qdrant.deleteByFilter).toHaveBeenCalledWith('ecosystem-docs', {
      must: [{ key: 'repoName', match: { value: 'catalog-microservice' } }],
    });
    expect(job.status).toBe('completed');
    expect(job.chunksTotal).toBe(1);
    expect(job.chunksProcessed).toBe(1);
  });

  it('keeps the existing skip path for a known unchanged commit with indexed chunks', async () => {
    const { service, mocks } = buildService({
      latestCompleted: { lastCommitHash: 'abc123', chunksProcessed: 4, chunksTotal: 4 },
      commitHash: 'abc123',
    });
    const job: any = {
      repoName: 'catalog-microservice',
      repoUrl: 'local',
      localPath: true,
      status: 'pending',
      chunksProcessed: 0,
      chunksTotal: 0,
    };

    await (service as any).runIngestion(job, false);

    expect(mocks.gitSync.listMarkdownFiles).not.toHaveBeenCalled();
    expect(mocks.qdrant.deleteByFilter).not.toHaveBeenCalled();
    expect(job.status).toBe('completed');
    expect(job.chunksTotal).toBe(4);
    expect(job.chunksProcessed).toBe(4);
  });
});
