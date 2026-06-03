import { Controller, Post, Get, Body, HttpCode, UsePipes } from '@nestjs/common';
import { z } from 'zod';
import { IngestionService } from './ingestion.service';
import { ZodValidationPipe } from '../contracts/zod-validation.pipe';
import { parseOrThrow } from '../contracts/parse-or-throw';

const TriggerIngestionRequestSchema = z.object({
  repoName: z.string().min(1),
  repoUrl: z.string().min(1).default('local'),
  force: z.boolean().default(false),
  localPath: z.boolean().default(false),
});

const IngestionStatusResponseSchema = z.object({
  jobs: z.array(z.object({
    id: z.string(),
    repoName: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    chunksProcessed: z.number(),
    chunksTotal: z.number(),
    errorMessage: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
});

type TriggerIngestionRequest = z.infer<typeof TriggerIngestionRequestSchema>;

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('trigger')
  @HttpCode(202)
  @UsePipes(new ZodValidationPipe(TriggerIngestionRequestSchema))
  async trigger(@Body() body: TriggerIngestionRequest) {
    const job = await this.ingestionService.triggerIngestion(body.repoName, body.repoUrl, body.force, body.localPath);
    return { jobId: job.id, status: job.status, repoName: job.repoName };
  }

  @Post('trigger-all')
  @HttpCode(202)
  async triggerAll(@Body() body: { force?: boolean }) {
    const force = body?.force ?? false;
    return this.ingestionService.triggerAll(force);
  }

  @Get('status')
  async status() {
    const jobs = await this.ingestionService.getStatus();
    return parseOrThrow(
      IngestionStatusResponseSchema,
      {
        jobs: jobs.map((j) => ({
          id: j.id,
          repoName: j.repoName,
          status: j.status,
          chunksProcessed: j.chunksProcessed,
          chunksTotal: j.chunksTotal,
          errorMessage: j.errorMessage ?? null,
          createdAt: j.createdAt.toISOString(),
          updatedAt: j.updatedAt.toISOString(),
        })),
      },
      'ingestion.status',
    );
  }
}
