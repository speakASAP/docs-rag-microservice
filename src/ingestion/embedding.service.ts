import { Injectable, Logger } from '@nestjs/common';

const BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Ollama serves embeddings from a single model instance. Firing a whole batch
// at it concurrently does not make it faster — it drives every request past
// its timeout at once, which is how ingestion died with "fetch failed" on
// 2026-07-16 and again on 2026-08-23.
const EMBED_CONCURRENCY = Number(process.env.OLLAMA_EMBED_CONCURRENCY || '2');

// Without an explicit signal, fetch waits indefinitely. A wedged Ollama then
// hangs the whole ingestion run instead of failing a single batch.
const EMBED_TIMEOUT_MS = Number(process.env.OLLAMA_EMBED_TIMEOUT_MS || '60000');

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly ollamaUrl: string;
  private readonly model: string;

  constructor() {
    // Ollama listens on 11435, not its 11434 default: it runs as the container
    // ai-microservice-ollama-green with OLLAMA_HOST=0.0.0.0:11435, on the host
    // rather than in the cluster. Nothing has ever served 11434 here, so the
    // old localhost:11434 fallback could only fail silently if OLLAMA_URL was
    // unset. In production it is always set, from k8s/configmap.yaml.
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://192.168.88.53:11435';
    this.model = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const all: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const embeddings = await this.embedWithRetry(batch);
      all.push(...embeddings);
    }
    return all;
  }

  async embedSingle(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text]);
    return embedding;
  }

  private async embedWithRetry(texts: string[]): Promise<number[][]> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Ollama processes one text at a time via /api/embeddings, so cap how
        // many are in flight rather than releasing the whole batch at once.
        const results: number[][] = new Array(texts.length);
        let next = 0;
        const workers = Array.from(
          { length: Math.min(EMBED_CONCURRENCY, texts.length) },
          async () => {
            while (true) {
              const index = next++;
              if (index >= texts.length) return;
              results[index] = await this.ollamaEmbed(texts[index]);
            }
          },
        );
        await Promise.all(workers);
        return results;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(`Embedding attempt ${attempt} failed: ${lastError.message}`);
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
        }
      }
    }
    throw lastError;
  }

  private async ollamaEmbed(text: string): Promise<number[]> {
    let response: Response;
    try {
      response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: text }),
        signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
      });
    } catch (err) {
      // Node reports both connection refusal and abort as a bare "fetch
      // failed", which is what made the 2026-07-16 outage so hard to read.
      // Name the endpoint, the model and the timeout in the error itself.
      const cause = err instanceof Error ? err.message : String(err);
      const timedOut = err instanceof Error && err.name === 'TimeoutError';
      throw new Error(
        `Ollama embedding request to ${this.ollamaUrl}/api/embeddings ` +
          `(model=${this.model}) ${timedOut ? `timed out after ${EMBED_TIMEOUT_MS}ms` : `failed: ${cause}`}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `Ollama embedding failed: ${response.status} ${await response.text()} ` +
          `(url=${this.ollamaUrl}, model=${this.model})`,
      );
    }
    const data = await response.json() as { embedding: number[] };
    if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
      throw new Error(
        `Ollama returned no embedding vector (url=${this.ollamaUrl}, model=${this.model}). ` +
          `Refusing to index an empty vector.`,
      );
    }
    return data.embedding;
  }

  getModelName(): string {
    return this.model;
  }
}
