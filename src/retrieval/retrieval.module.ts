import { Module } from '@nestjs/common';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './retrieval.service';
import { EmbeddingService } from '../ingestion/embedding.service';
import { QdrantModule } from '../qdrant/qdrant.module';

@Module({
  imports: [QdrantModule],
  controllers: [RetrievalController],
  providers: [RetrievalService, EmbeddingService],
})
export class RetrievalModule {}
