import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { IngestionJob } from '../database/entities/ingestion-job.entity';
import { DocumentChunk } from '../database/entities/document-chunk.entity';
import { GitSyncService } from './git-sync.service';
import { MarkdownChunkerService } from './markdown-chunker.service';
import { EmbeddingService } from './embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(IngestionJob)
    private readonly jobRepo: Repository<IngestionJob>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    private readonly gitSync: GitSyncService,
    private readonly chunker: MarkdownChunkerService,
    private readonly embedder: EmbeddingService,
    private readonly qdrant: QdrantService,
  ) {}

  async triggerIngestion(repoName: string, repoUrl: string, force = false): Promise<IngestionJob> {
    const job = this.jobRepo.create({
      repoName,
      repoUrl,
      status: 'pending',
      chunksProcessed: 0,
      chunksTotal: 0,
    });
    await this.jobRepo.save(job);

    this.runIngestion(job, force).catch((err) => {
      this.logger.error(`Ingestion failed for ${repoName}: ${err.message}`);
    });

    return job;
  }

  private async runIngestion(job: IngestionJob, force: boolean): Promise<void> {
    job.status = 'running';
    await this.jobRepo.save(job);

    try {
      const localPath = await this.gitSync.cloneOrPull(job.repoName, job.repoUrl);
      const commitHash = await this.gitSync.getHeadCommit(localPath);

      if (!force && job.lastCommitHash === commitHash) {
        this.logger.log(`${job.repoName} is up to date at ${commitHash}`);
        job.status = 'completed';
        await this.jobRepo.save(job);
        return;
      }

      const files = await this.gitSync.listMarkdownFiles(localPath);
      job.chunksTotal = files.length;
      await this.jobRepo.save(job);

      const collection = this.qdrant.getDefaultCollection();
      await this.qdrant.deleteByFilter(collection, {
        must: [{ key: 'repoName', match: { value: job.repoName } }],
      });
      await this.chunkRepo.delete({ repoName: job.repoName });

      for (const filePath of files) {
        const relativePath = filePath.replace(localPath, '').replace(/^\//, '');
        const content = await this.gitSync.readFile(filePath);
        const chunks = this.chunker.chunk(content, relativePath, { repoName: job.repoName });

        if (chunks.length === 0) {
          job.chunksProcessed++;
          await this.jobRepo.save(job);
          continue;
        }

        const texts = chunks.map((c) => c.text);
        const embeddings = await this.embedder.embedBatch(texts);

        const qdrantPoints = chunks.map((c, i) => ({
          id: randomUUID(),
          vector: embeddings[i],
          payload: {
            repoName: c.repoName,
            serviceName: c.serviceName ?? null,
            filePath: c.filePath,
            docType: c.docType,
            heading: c.heading,
            text: c.text,
            tags: c.tags,
            chunkIndex: c.chunkIndex,
          },
        }));

        await this.qdrant.upsertBatch(collection, qdrantPoints);

        const entities = chunks.map((c, i) =>
          this.chunkRepo.create({
            repoName: c.repoName,
            serviceName: c.serviceName,
            filePath: c.filePath,
            docType: c.docType,
            chunkText: c.text,
            chunkIndex: c.chunkIndex,
            embeddingModel: this.embedder.getModelName(),
            qdrantId: qdrantPoints[i].id,
            gitCommitHash: commitHash,
            tags: c.tags,
          }),
        );
        await this.chunkRepo.save(entities);

        job.chunksProcessed++;
        await this.jobRepo.save(job);
      }

      job.status = 'completed';
      job.lastCommitHash = commitHash;
      await this.jobRepo.save(job);
      this.logger.log(`Ingestion complete for ${job.repoName}: ${job.chunksProcessed} files processed`);
    } catch (err) {
      job.status = 'failed';
      job.errorMessage = err instanceof Error ? err.message : String(err);
      await this.jobRepo.save(job);
      throw err;
    }
  }

  async getStatus(): Promise<IngestionJob[]> {
    return this.jobRepo.find({ order: { createdAt: 'DESC' }, take: 50 });
  }
}
