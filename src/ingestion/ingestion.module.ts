import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { GitSyncService } from './git-sync.service';
import { MarkdownChunkerService } from './markdown-chunker.service';
import { EmbeddingService } from './embedding.service';
import { IngestionJob } from '../database/entities/ingestion-job.entity';
import { DocumentChunk } from '../database/entities/document-chunk.entity';
import { QdrantModule } from '../qdrant/qdrant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IngestionJob, DocumentChunk]),
    QdrantModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService, GitSyncService, MarkdownChunkerService, EmbeddingService],
  exports: [IngestionService],
})
export class IngestionModule {}
