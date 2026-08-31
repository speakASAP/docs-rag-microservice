import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { IngestionJob } from '../database/entities/ingestion-job.entity';
import { DocumentChunk } from '../database/entities/document-chunk.entity';
import { GitSyncService } from './git-sync.service';
import { MarkdownChunkerService } from './markdown-chunker.service';
import { EmbeddingService } from './embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { getEcosystemRepos } from './repo-registry';

/**
 * A running job writes progress after every chunk batch. If updatedAt has not
 * moved in this long, the worker behind it is gone and the row is a lie.
 */
const STALE_RUNNING_JOB_MS = Number(process.env.STALE_RUNNING_JOB_MINUTES || '20') * 60 * 1000;
const STALE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class IngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionService.name);
  private scheduledTimer?: NodeJS.Timeout;
  private staleSweepTimer?: NodeJS.Timeout;
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
    // A pod restart mid-ingestion leaves jobs stranded in 'running' forever.
    // They then shadow the last good job in the up-to-date check below, so a
    // repo can silently stop re-indexing. Fail them loudly at startup.
    this.failStrandedJobs().catch((err) => {
      this.logger.error(
        `Failed to reconcile stranded ingestion jobs: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    });

    this.staleSweepTimer = setInterval(() => {
      this.failStaleRunningJobs().catch((err) => {
        this.logger.error(
          `Stale ingestion job sweep failed: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      });
    }, STALE_SWEEP_INTERVAL_MS);
    this.logger.log(
      `Stale-running-job sweep every ${Math.round(STALE_SWEEP_INTERVAL_MS / 60000)} minute(s); ` +
        `threshold ${Math.round(STALE_RUNNING_JOB_MS / 60000)} minute(s)`,
    );

    const enabled = process.env.SCHEDULED_INGESTION_ENABLED === 'true';
    if (!enabled) {
      this.logger.warn(
        'SCHEDULED_INGESTION_ENABLED is not "true" — the docs index will NOT refresh. ' +
          'It will serve progressively staler results until re-enabled.',
      );
      return;
    }

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
    if (this.staleSweepTimer) clearInterval(this.staleSweepTimer);
  }

  private async createJob(repoName: string, repoUrl: string, localPath: boolean): Promise<IngestionJob> {
    const registryEntry = getEcosystemRepos().find((repo) => repo.repoName === repoName);
    const job = this.jobRepo.create({
      repoName,
      repoUrl: repoUrl === 'local' && registryEntry ? registryEntry.repoUrl : repoUrl,
      status: 'pending',
      chunksProcessed: 0,
      chunksTotal: 0,
      localPath,
    });
    await this.jobRepo.save(job);
    return job;
  }

  private async runAllSequentially(force: boolean): Promise<void> {
    const registry = getEcosystemRepos();
    const total = registry.length;
    const failures: string[] = [];
    const startedAt = Date.now();
    this.logger.log(`Sequential ingestion starting: ${total} repos (force=${force})`);

    for (const [index, repo] of registry.entries()) {
      const label = `[${index + 1}/${total}] ${repo.repoName}`;
      const repoStartedAt = Date.now();
      try {
        const job = await this.createJob(repo.repoName, repo.repoUrl, repo.localPath);
        await this.runIngestion(job, force, repo.localAbsolutePath);
        this.logger.log(`${label} OK in ${Date.now() - repoStartedAt}ms`);
      } catch (err) {
        // One bad source must not abandon the rest; record and continue.
        failures.push(repo.repoName);
        this.logger.error(
          `${label} FAILED after ${Date.now() - repoStartedAt}ms: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }

    const elapsed = Date.now() - startedAt;
    if (failures.length > 0) {
      this.logger.error(
        `Sequential ingestion finished in ${elapsed}ms with ${failures.length}/${total} failures: ${failures.join(', ')}`,
      );
      return;
    }
    this.logger.log(`Sequential ingestion finished in ${elapsed}ms: all ${total} repos OK`);
  }

  private async failStrandedJobs(): Promise<void> {
    const stranded = await this.jobRepo.find({ where: { status: 'running' } });
    if (stranded.length === 0) return;

    this.logger.error(
      `Found ${stranded.length} ingestion job(s) stranded in 'running' from a previous process ` +
        `(${[...new Set(stranded.map((j) => j.repoName))].join(', ')}). Marking failed.`,
    );

    for (const job of stranded) {
      job.status = 'failed';
      job.errorMessage = 'Stranded in running state by a process restart; failed at startup';
      await this.jobRepo.save(job);
    }
  }

  /**
   * The startup sweep alone is not enough. During a rolling update both pods are
   * briefly alive: the new pod reaps, and the old pod's final write then puts the
   * row back into 'running' with nothing left to reap it. Observed on 2026-08-23,
   * when auth-microservice sat 'running' at 22/89 indefinitely.
   *
   * So also fail any job whose updatedAt has not moved for longer than a live
   * ingestion ever leaves it untouched. Progress is written per chunk batch, so a
   * genuinely running job updates far more often than this.
   */
  private async failStaleRunningJobs(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_RUNNING_JOB_MS);
    const stale = await this.jobRepo.find({
      where: { status: 'running', updatedAt: LessThan(cutoff) },
    });
    if (stale.length === 0) return;

    this.logger.error(
      `Found ${stale.length} ingestion job(s) with no progress for over ` +
        `${Math.round(STALE_RUNNING_JOB_MS / 60000)} minutes ` +
        `(${[...new Set(stale.map((j) => j.repoName))].join(', ')}). Marking failed.`,
    );

    for (const job of stale) {
      job.status = 'failed';
      job.errorMessage =
        `No progress for over ${Math.round(STALE_RUNNING_JOB_MS / 60000)} minutes ` +
        `(stalled at ${job.chunksProcessed}/${job.chunksTotal} chunks); marked failed by the staleness reaper`;
      await this.jobRepo.save(job);
    }
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

  async triggerIngestion(
    repoName: string,
    repoUrl: string,
    force = false,
    localPath = false,
    localAbsolutePath?: string,
  ): Promise<IngestionJob> {
    const registryEntry = getEcosystemRepos().find((repo) => repo.repoName === repoName);
    if (!registryEntry) {
      throw new BadRequestException(
        `Cannot ingest '${repoName}': it is not registered in the ecosystem repository catalog (docsRag: true).`,
      );
    }

    const resolvedLocalAbsolutePath = registryEntry.localAbsolutePath;
    const resolvedLocalPath = registryEntry.localPath;
    const resolvedRepoUrl = registryEntry.repoUrl;

    if (localAbsolutePath !== undefined) {
      const approvedPath = this.gitSync.getLocalPath(repoName, resolvedLocalAbsolutePath);
      const requestedPath = this.gitSync.getLocalPath(repoName, localAbsolutePath);
      if (requestedPath !== approvedPath) {
        throw new BadRequestException(
          `Cannot override the catalog-approved checkout path for '${repoName}'.`,
        );
      }
    }

    const job = await this.createJob(repoName, resolvedRepoUrl, resolvedLocalPath);

    this.runIngestion(job, force, resolvedLocalAbsolutePath).catch((err) => {
      this.logger.error(`Ingestion failed for ${repoName}: ${err.message}`);
    });

    return job;
  }

  private async runIngestion(job: IngestionJob, force: boolean, localAbsolutePath?: string): Promise<void> {
    job.status = 'running';
    await this.jobRepo.save(job);

    try {
      const registryEntry = getEcosystemRepos().find((repo) => repo.repoName === job.repoName);
      const { localPath, commitHash } = await this.gitSync.prepareForIngestion(
        job.repoName,
        job.repoUrl,
        job.localPath,
        localAbsolutePath,
      );

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

      const excludedMarkdownPaths = registryEntry?.excludeMarkdownPaths ?? [];
      const allFiles =
        excludedMarkdownPaths.length > 0
          ? await this.gitSync.listMarkdownFiles(localPath, excludedMarkdownPaths)
          : await this.gitSync.listMarkdownFiles(localPath);
      const files = this.filterIngestionFiles(job.repoName, allFiles);
      const agentInstructionFiles = files.filter((filePath) => /(AGENTS|CLAUDE|GEMINI)\.md$/i.test(filePath));
      this.logger.log(
        `${job.repoName}: markdown files=${files.length}, agent instruction files=${agentInstructionFiles.length}`,
      );
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

    // triggerIngestion returns as soon as the job row exists — the actual work
    // runs detached. Calling it per repo therefore releases all 40 repos onto
    // Ollama at once, which is exactly what produced the "fetch failed" storms.
    // Run the repos through one sequential chain instead.
    for (const repo of getEcosystemRepos()) {
      repos.push(repo.repoName);
    }

    this.runAllSequentially(force).catch((err) => {
      this.logger.error(
        `Sequential ingestion run failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    });
    this.logger.log(`trigger-all: queued ${repos.length} repos`);
    return { queued: repos.length, repos };
  }

  private filterIngestionFiles(repoName: string, files: string[]): string[] {
    if (!repoName.endsWith('-profile')) return files;

    return files.filter((filePath) => /(AGENTS|CLAUDE|GEMINI)\.md$/i.test(filePath.replace(/\\/g, '/')));
  }
}
