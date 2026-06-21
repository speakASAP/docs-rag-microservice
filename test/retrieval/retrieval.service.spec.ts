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
    jest.clearAllMocks();
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

  it('returns empty agent context when embedding retrieval is unavailable', async () => {
    mockEmbedder.embedSingle.mockRejectedValueOnce(new Error('fetch failed'));
    const ctx = await service.agentContext({ query: 'deployment', maxTokens: 2000 });
    expect(ctx.context).toBe('');
    expect(ctx.sources).toHaveLength(0);
    expect(ctx.estimatedTokens).toBe(0);
  });
});
