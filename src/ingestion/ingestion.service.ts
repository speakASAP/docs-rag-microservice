import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { IngestionJob } from '../database/entities/ingestion-job.entity';
import { DocumentChunk } from '../database/entities/document-chunk.entity';
import { GitSyncService } from './git-sync.service';
import { MarkdownChunkerService } from './markdown-chunker.service';
import { EmbeddingService } from './embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { ECOSYSTEM_REPOS } from './repo-registry';

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private scheduledTimer?: NodeJS.Timeout;
  private scheduledRunActive = false;

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

  onModuleInit(): void {
    const enabled = process.env.SCHEDULED_INGESTION_ENABLED === 'true';
    if (!enabled) return;

    const intervalHours = Number(process.env.GIT_SYNC_INTERVAL_HOURS || '6');
    const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;
    this.scheduledTimer = setInterval(() => {
      this.runScheduledIngestion().catch((err) => {
        this.logger.error(`Scheduled ingestion failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, intervalMs);
    this.logger.log(`Scheduled ingestion enabled every ${intervalHours} hour(s)`);
  }

  onModuleDestroy(): void {
    if (this.scheduledTimer) clearInterval(this.scheduledTimer);
  }

  private async runScheduledIngestion(): Promise<void> {
    if (this.scheduledRunActive) {
      this.logger.warn('Scheduled ingestion skipped because a previous scheduled run is still active');
      return;
    }
    this.scheduledRunActive = true;
    try {
      await this.triggerAll(false);
    } finally {
      this.scheduledRunActive = false;
    }
  }

  async triggerIngestion(repoName: string, repoUrl: string, force = false, localPath = false): Promise<IngestionJob> {
    const job = this.jobRepo.create({
      repoName,
      repoUrl,
      status: 'pending',
      chunksProcessed: 0,
      chunksTotal: 0,
      localPath,
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
      const localPath = job.localPath
        ? this.gitSync.getLocalPath(job.repoName)
        : await this.gitSync.cloneOrPull(job.repoName, job.repoUrl);
      const commitHash = await this.gitSync.getHeadCommit(localPath);

      const latestCompleted = await this.jobRepo.findOne({
        where: { repoName: job.repoName, status: 'completed' },
        order: { updatedAt: 'DESC' },
      });

      const canReuseLatestCompleted =
        !force &&
        commitHash !== 'unknown' &&
        latestCompleted?.lastCommitHash === commitHash &&
        latestCompleted.chunksTotal > 0;

      if (canReuseLatestCompleted) {
        this.logger.log(`${job.repoName} is up to date at ${commitHash}`);
        job.status = 'completed';
        job.lastCommitHash = commitHash;
        job.chunksProcessed = latestCompleted.chunksProcessed;
        job.chunksTotal = latestCompleted.chunksTotal;
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

  async triggerAll(force = false): Promise<{ queued: number; repos: string[] }> {
    const repos: string[] = [];
    for (const repo of ECOSYSTEM_REPOS) {
      await this.triggerIngestion(repo.repoName, repo.repoUrl, force, repo.localPath);
      repos.push(repo.repoName);
    }
    this.logger.log(`trigger-all: queued ${repos.length} repos`);
    return { queued: repos.length, repos };
  }
}
