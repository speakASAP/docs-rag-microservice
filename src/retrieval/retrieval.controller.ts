import { Controller, Post, Body, HttpCode, UsePipes } from '@nestjs/common';
import { z } from 'zod';
import { RetrievalService } from './retrieval.service';
import { ZodValidationPipe } from '../contracts/zod-validation.pipe';

const SearchRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
  repoName: z.string().optional(),
  docType: z.string().optional(),
  serviceName: z.string().optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
});

const AgentContextRequestSchema = z.object({
  query: z.string().min(1),
  maxTokens: z.number().int().min(100).max(8000).default(3000),
  repoName: z.string().optional(),
  docType: z.string().optional(),
});

type SearchRequest = z.infer<typeof SearchRequestSchema>;
type AgentContextRequest = z.infer<typeof AgentContextRequestSchema>;

@Controller('retrieval')
export class RetrievalController {
  constructor(private readonly retrievalService: RetrievalService) {}

  @Post('search')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(SearchRequestSchema))
  async search(@Body() body: SearchRequest) {
    return this.retrievalService.search(body);
  }

  @Post('agent-context')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(AgentContextRequestSchema))
  async agentContext(@Body() body: AgentContextRequest) {
    return this.retrievalService.agentContext(body);
  }
}
