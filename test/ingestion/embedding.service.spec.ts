import 'reflect-metadata';
import { EmbeddingService } from '../../src/ingestion/embedding.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function ollamaResponse(embedding: number[]) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ embedding }),
  } as Response);
}

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    process.env.OLLAMA_URL = 'http://localhost:11434';
    process.env.OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text';
    mockFetch.mockReset();
    service = new EmbeddingService();
  });

  it('embeds a batch of texts', async () => {
    mockFetch
      .mockImplementationOnce(() => ollamaResponse(new Array(768).fill(0.1)))
      .mockImplementationOnce(() => ollamaResponse(new Array(768).fill(0.2)));

    const results = await service.embedBatch(['hello world', 'foo bar']);
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveLength(768);
    expect(results[1]).toHaveLength(768);
  });

  it('retries on failure then succeeds', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockImplementationOnce(() => ollamaResponse(new Array(768).fill(0.5)));

    const results = await service.embedBatch(['retry me']);
    expect(results[0]).toHaveLength(768);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns empty array for empty input', async () => {
    const results = await service.embedBatch([]);
    expect(results).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns model name', () => {
    expect(service.getModelName()).toBe('nomic-embed-text');
  });
});
