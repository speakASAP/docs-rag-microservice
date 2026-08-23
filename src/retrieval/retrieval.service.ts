import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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
  /** False when no result cleared CONFIDENT_MATCH_SCORE; context is then empty by design. */
  confident: boolean;
  /** Similarity of the best match, 0 when nothing was returned. */
  topScore: number;
  /** Present only when confident is false: why no context was returned. */
  notice?: string;
}

const WORDS_PER_TOKEN = 0.75;

// Minimum top-result similarity for an assembled answer to be considered
// trustworthy. Below this, weak chunks are withheld rather than presented as
// an answer. Tuned against observed misses: an unanswerable query topped out
// at ~0.72 while genuinely relevant hits score higher.
const CONFIDENT_MATCH_SCORE = Number(process.env.RAG_CONFIDENT_MATCH_SCORE || '0.74');

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
      // Never return an empty context in place of a failure: an agent cannot
      // distinguish "nothing indexed" from "embedding backend is down", and a
      // silent empty answer sends it off to burn tokens reading source files.
      this.logger.error(
        `Agent context retrieval FAILED for query="${req.query}" ` +
          `repoName=${req.repoName ?? '-'} docType=${req.docType ?? '-'}: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new ServiceUnavailableException(
        `Docs RAG retrieval unavailable: ${message}. Do not treat this as "no results" — ` +
          `the index could not be queried.`,
      );
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

    // A confident answer needs at least one strong match. Vector search always
    // returns *something* above the 0.6 floor, so without this an unanswerable
    // query yields a page of plausible near-misses that reads like an answer.
    const topScore = response.results.length > 0 ? response.results[0].score : 0;
    const confident = topScore >= CONFIDENT_MATCH_SCORE;

    if (!confident) {
      this.logger.warn(
        `No confident match for query="${req.query}" ` +
          `(top score ${topScore.toFixed(3)} < ${CONFIDENT_MATCH_SCORE}); ` +
          `returning explicit no-match instead of ${response.results.length} weak chunks`,
      );
      return {
        query: req.query,
        context: '',
        sources: [],
        estimatedTokens: 0,
        confident: false,
        topScore,
        notice:
          `No confident match in the docs index (best score ${topScore.toFixed(3)}, ` +
          `threshold ${CONFIDENT_MATCH_SCORE}). The index may not cover this topic or may be stale — ` +
          `verify against the repository before relying on an answer.`,
      };
    }

    return {
      query: req.query,
      context: contextParts.join('\n\n'),
      sources,
      estimatedTokens: tokenCount,
      confident: true,
      topScore,
    };
  }
}
