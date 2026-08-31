import { BadRequestException } from '@nestjs/common';
import { IngestionService } from '../../src/ingestion/ingestion.service';
import {
  IngestionController,
  TriggerIngestionRequestSchema,
} from '../../src/ingestion/ingestion.controller';
import { ZodValidationPipe } from '../../src/contracts/zod-validation.pipe';
import * as repoRegistry from '../../src/ingestion/repo-registry';

/**
 * The trigger body defaults localPath to false. A catalog entry is the
 * authority on how a repo is reached, so a registered repo must be ingested
 * from its mounted checkout even when the request never mentions localPath.
 * Getting this wrong sent wisdom-quotes into `git pull` on the read-only
 * /data/repos mount on 2026-08-30.
 */
describe('trigger ingestion honours the repository catalog over request defaults', () => {
  function buildService(files: string[] = ['/data/repos/wisdom-quotes/README.md']) {
    const saved: any[] = [];
    const jobRepo = {
      create: jest.fn((value) => ({ ...value })),
      save: jest.fn(async (value) => {
        saved.push({ ...value });
        return value;
      }),
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
    };
    const chunkRepo = {
      delete: jest.fn(async () => undefined),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const gitSync = {
      getLocalPath: jest.fn((repoName: string, absolute?: string) => absolute ?? `/data/repos/${repoName}`),
      cloneOrPull: jest.fn(async (repoName: string) => `/data/repos/${repoName}`),
      getHeadCommit: jest.fn(async () => 'abc123'),
      listMarkdownFiles: jest.fn(async () => files),
      readFile: jest.fn(async () => '# Wisdom\n\nQuotes.'),
    };
    const chunker = { chunk: jest.fn(() => []) };
    const embedder = {
      embedBatch: jest.fn(async () => [new Array(768).fill(0.1)]),
      getModelName: jest.fn(() => 'nomic-embed-text'),
    };
    const qdrant = {
      getDefaultCollection: jest.fn(() => 'ecosystem-docs'),
      deleteByFilter: jest.fn(async () => undefined),
      upsertBatch: jest.fn(async () => undefined),
    };

    const service = new IngestionService(
      jobRepo as any,
      chunkRepo as any,
      gitSync as any,
      chunker as any,
      embedder as any,
      qdrant as any,
    );
    return { service, jobRepo, gitSync, saved };
  }

  async function settle(service: IngestionService, runSpy: jest.SpyInstance) {
    void service;
    for (const result of runSpy.mock.results) {
      if (result.type === 'return') await result.value;
    }
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('overrides the request default localPath=false with the catalog entry and never touches git remotes', async () => {
    jest.spyOn(repoRegistry, 'getEcosystemRepos').mockReturnValue([
      {
        repoName: 'wisdom-quotes',
        repoUrl: 'https://github.com/speakASAP/wisdom-quotes.git',
        localPath: true,
      },
    ]);
    const { service, gitSync } = buildService();
    const runSpy = jest.spyOn(service as any, 'runIngestion');

    const job = await service.triggerIngestion('wisdom-quotes', 'local', true, false, undefined);

    expect(job.localPath).toBe(true);
    expect(job.repoUrl).toBe('https://github.com/speakASAP/wisdom-quotes.git');

    await settle(service, runSpy);
    expect(gitSync.getLocalPath).toHaveBeenCalledWith('wisdom-quotes', undefined);
    expect(gitSync.cloneOrPull).not.toHaveBeenCalled();
    expect(job.status).toBe('completed');
  });

  it('uses the catalog checkout alias as the mounted path', async () => {
    jest.spyOn(repoRegistry, 'getEcosystemRepos').mockReturnValue([
      {
        repoName: 'allegro-service',
        repoUrl: 'https://github.com/speakASAP/allegro.git',
        localPath: true,
        localAbsolutePath: '/data/repos/allegro',
      },
    ]);
    const { service, gitSync } = buildService(['/data/repos/allegro/README.md']);
    const runSpy = jest.spyOn(service as any, 'runIngestion');

    await service.triggerIngestion('allegro-service', 'local', true, false, undefined);

    await settle(service, runSpy);
    expect(gitSync.getLocalPath).toHaveBeenCalledWith('allegro-service', '/data/repos/allegro');
    expect(gitSync.cloneOrPull).not.toHaveBeenCalled();
  });

  it('picks up a repository registered after the process started', async () => {
    const registry = jest.spyOn(repoRegistry, 'getEcosystemRepos').mockReturnValue([]);
    const { service, gitSync } = buildService();

    await expect(service.triggerIngestion('wisdom-quotes', 'local', true, false, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    registry.mockReturnValue([
      {
        repoName: 'wisdom-quotes',
        repoUrl: 'https://github.com/speakASAP/wisdom-quotes.git',
        localPath: true,
      },
    ]);
    const runSpy = jest.spyOn(service as any, 'runIngestion');
    const job = await service.triggerIngestion('wisdom-quotes', 'local', true, false, undefined);

    expect(job.localPath).toBe(true);
    await settle(service, runSpy);
    expect(gitSync.cloneOrPull).not.toHaveBeenCalled();
  });

  it('rejects an unregistered repo instead of handing the "local" placeholder to git', async () => {
    jest.spyOn(repoRegistry, 'getEcosystemRepos').mockReturnValue([]);
    const { service, gitSync, jobRepo } = buildService();

    await expect(service.triggerIngestion('wisdom-quotes', 'local', true, false, undefined)).rejects.toThrow(
      /not registered in the ecosystem repository catalog/,
    );
    expect(jobRepo.create).not.toHaveBeenCalled();
    expect(gitSync.cloneOrPull).not.toHaveBeenCalled();
  });

  it('still clones an unregistered repo when the request supplies a real remote', async () => {
    jest.spyOn(repoRegistry, 'getEcosystemRepos').mockReturnValue([]);
    const { service, gitSync } = buildService(['/data/repos/external/README.md']);
    const runSpy = jest.spyOn(service as any, 'runIngestion');

    const job = await service.triggerIngestion(
      'external',
      'https://github.com/example/external.git',
      true,
      false,
      undefined,
    );

    expect(job.localPath).toBe(false);
    await settle(service, runSpy);
    expect(gitSync.cloneOrPull).toHaveBeenCalledWith('external', 'https://github.com/example/external.git');
  });
});

describe('trigger ingestion request body defaults', () => {
  const pipe = new ZodValidationPipe(TriggerIngestionRequestSchema);

  it('defaults repoUrl to the "local" placeholder and localPath to false', () => {
    expect(pipe.transform({ repoName: 'wisdom-quotes', force: true }, {})).toEqual({
      repoName: 'wisdom-quotes',
      repoUrl: 'local',
      force: true,
      localPath: false,
    });
  });

  it('keeps an explicit localPath: true', () => {
    expect(pipe.transform({ repoName: 'wisdom-quotes', repoUrl: 'local', localPath: true }, {})).toEqual({
      repoName: 'wisdom-quotes',
      repoUrl: 'local',
      force: false,
      localPath: true,
    });
  });

  it('rejects a body without repoName', () => {
    expect(() => pipe.transform({ force: true }, {})).toThrow(BadRequestException);
  });

  it('forwards the parsed defaults unchanged to the service, which owns the catalog override', async () => {
    const ingestionService = {
      triggerIngestion: jest.fn(async () => ({ id: 'job-1', status: 'pending', repoName: 'wisdom-quotes' })),
    };
    const controller = new IngestionController(ingestionService as any);
    const body = pipe.transform({ repoName: 'wisdom-quotes', force: true }, {}) as any;

    await controller.trigger(body);

    expect(ingestionService.triggerIngestion).toHaveBeenCalledWith(
      'wisdom-quotes',
      'local',
      true,
      false,
      undefined,
    );
  });
});
