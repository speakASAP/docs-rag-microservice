import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from '../ingestion/embedding.service';
import { QdrantService, SearchOptions } from '../qdrant/qdrant.service';

export interface SearchRequest {
  query: string;
  limit?: number;
  repoName?: string;
  docType?: string;
  serviceName?: string;
  scoreThreshold?: number;
}

export interface SearchResultItem {
  id: string;
  score: number;
  repoName: string;
  filePath: string;
  docType: string;
  heading: string;
  text: string;
  tags: string[];
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
}

export interface AgentContextRequest {
  query: string;
  maxTokens?: number;
  repoName?: string;
  docType?: string;
}

export interface AgentContextResponse {
  query: string;
  context: string;
  sources: { repoName: string; filePath: string; heading: string; score: number }[];
  estimatedTokens: number;
}

const WORDS_PER_TOKEN = 0.75;

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly embedder: EmbeddingService,
    private readonly qdrant: QdrantService,
  ) {}

  async search(req: SearchRequest): Promise<SearchResponse> {
    const vector = await this.embedder.embedSingle(req.query);
    const collection = this.qdrant.getDefaultCollection();
    const options: SearchOptions = {
      limit: req.limit ?? 10,
      scoreThreshold: req.scoreThreshold ?? 0.5,
    };

    if (req.repoName || req.docType || req.serviceName) {
      const must: Record<string, unknown>[] = [];
      if (req.repoName) must.push({ key: 'repoName', match: { value: req.repoName } });
      if (req.docType) must.push({ key: 'docType', match: { value: req.docType } });
      if (req.serviceName) must.push({ key: 'serviceName', match: { value: req.serviceName } });
      options.filter = { must };
    }

    const raw = await this.qdrant.search(collection, vector, options);

    const results: SearchResultItem[] = raw.map((r) => ({
      id: r.id,
      score: r.score,
      repoName: String(r.payload['repoName'] ?? ''),
      filePath: String(r.payload['filePath'] ?? ''),
      docType: String(r.payload['docType'] ?? ''),
      heading: String(r.payload['heading'] ?? ''),
      text: String(r.payload['text'] ?? ''),
      tags: Array.isArray(r.payload['tags']) ? (r.payload['tags'] as string[]) : [],
    }));

    return { query: req.query, results, total: results.length };
  }

  async agentContext(req: AgentContextRequest): Promise<AgentContextResponse> {
    const maxTokens = req.maxTokens ?? 3000;
    const limit = Math.min(20, Math.ceil(maxTokens / 200));

    let response: SearchResponse;
    try {
      response = await this.search({
        query: req.query,
        limit,
        repoName: req.repoName,
        docType: req.docType,
        scoreThreshold: 0.6,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Agent context retrieval unavailable: ${message}`);
      return {
        query: req.query,
        context: '',
        sources: [],
        estimatedTokens: 0,
      };
    }

    const contextParts: string[] = [];
    const sources: AgentContextResponse['sources'] = [];
    let tokenCount = 0;

    for (const result of response.results) {
      const wordCount = result.text.split(/\s+/).length;
      const tokenEst = Math.ceil(wordCount / WORDS_PER_TOKEN);
      if (tokenCount + tokenEst > maxTokens) break;

      contextParts.push(
        `--- Source: ${result.repoName}/${result.filePath} (${result.heading}) ---\n${result.text}`,
      );
      sources.push({
        repoName: result.repoName,
        filePath: result.filePath,
        heading: result.heading,
        score: result.score,
      });
      tokenCount += tokenEst;
    }

    return {
      query: req.query,
      context: contextParts.join('\n\n'),
      sources,
      estimatedTokens: tokenCount,
    };
  }
}
