import 'reflect-metadata';
import { QdrantService } from '../../src/qdrant/qdrant.service';

const mockClient = {
  getCollections: jest.fn().mockResolvedValue({ collections: [] }),
  createCollection: jest.fn().mockResolvedValue({}),
  upsert: jest.fn().mockResolvedValue({ status: 'acknowledged' }),
  search: jest.fn().mockResolvedValue([]),
  delete: jest.fn().mockResolvedValue({ status: 'acknowledged' }),
};

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => mockClient),
}));

describe('QdrantService', () => {
  let service: QdrantService;

  beforeEach(() => {
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.QDRANT_COLLECTION = 'test_docs';
    service = new QdrantService();
    jest.clearAllMocks();
  });

  it('upserts a point', async () => {
    await service.upsertPoint('test_docs', {
      id: 'abc-123',
      vector: new Array(1536).fill(0.1),
      payload: { text: 'hello', repoName: 'test-repo' },
    });
    expect(mockClient.upsert).toHaveBeenCalled();
  });

  it('searches by vector', async () => {
    mockClient.search.mockResolvedValueOnce([
      { id: 'abc-123', score: 0.9, payload: { text: 'hello' } },
    ]);
    const results = await service.search('test_docs', new Array(1536).fill(0.1), { limit: 5 });
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.9);
  });
});
