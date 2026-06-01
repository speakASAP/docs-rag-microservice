import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface SearchOptions {
  limit?: number;
  filter?: Record<string, unknown>;
  scoreThreshold?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private readonly client: QdrantClient;
  private readonly collectionName: string;
  private readonly vectorSize: number;

  constructor() {
    const url = process.env.QDRANT_URL || 'http://localhost:6333';
    this.collectionName = process.env.QDRANT_COLLECTION || 'ecosystem_docs';
    this.vectorSize = parseInt(process.env.QDRANT_VECTOR_SIZE || '768', 10);
    this.client = new QdrantClient({ url });
  }

  async onModuleInit() {
    await this.ensureCollection(this.collectionName);
  }

  async ensureCollection(name: string): Promise<void> {
    const { collections } = await this.client.getCollections();
    const exists = collections.some((c) => c.name === name);
    if (!exists) {
      await this.client.createCollection(name, {
        vectors: { size: this.vectorSize, distance: 'Cosine' },
      });
      this.logger.log(`Created Qdrant collection: ${name}`);
    }
  }

  async upsertPoint(collection: string, point: QdrantPoint): Promise<void> {
    await this.client.upsert(collection, {
      wait: true,
      points: [{ id: point.id, vector: point.vector, payload: point.payload }],
    });
  }

  async upsertBatch(collection: string, points: QdrantPoint[]): Promise<void> {
    if (points.length === 0) return;
    await this.client.upsert(collection, {
      wait: true,
      points: points.map((p) => ({ id: p.id, vector: p.vector, payload: p.payload })),
    });
    this.logger.log(`Upserted ${points.length} points to ${collection}`);
  }

  async search(collection: string, vector: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    const searchParams: Record<string, unknown> = {
      vector,
      limit: options.limit ?? 10,
      with_payload: true,
    };

    if (options.filter) {
      searchParams.filter = options.filter;
    }
    if (options.scoreThreshold !== undefined) {
      searchParams.score_threshold = options.scoreThreshold;
    }

    const results = await this.client.search(collection, searchParams as Parameters<QdrantClient['search']>[1]);
    return results.map((r) => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as Record<string, unknown>,
    }));
  }

  async deleteByFilter(collection: string, filter: Record<string, unknown>): Promise<void> {
    const deleteParams: Record<string, unknown> = {
      wait: true,
      filter,
    };
    await this.client.delete(collection, deleteParams as Parameters<QdrantClient['delete']>[1]);
  }

  getDefaultCollection(): string {
    return this.collectionName;
  }
}
