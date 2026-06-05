import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceIdentityModule } from './service-identity/service-identity.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { QdrantModule } from './qdrant/qdrant.module';
import { HealthController } from './health.controller';
import { DocumentChunk } from './database/entities/document-chunk.entity';
import { IngestionJob } from './database/entities/ingestion-job.entity';
import { DocsRagInitialSchema1710000000000 } from './database/migrations/1710000000000-DocsRagInitialSchema';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST || 'localhost'),
      port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DATABASE_URL ? undefined : (process.env.DB_USER || 'dbadmin'),
      password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
      database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME || 'docs_rag'),
      entities: [DocumentChunk, IngestionJob],
      synchronize: process.env.NODE_ENV !== 'production' && process.env.DB_AUTO_CREATE === 'true',
      migrationsRun: true,
      migrations: [DocsRagInitialSchema1710000000000],
      logging: process.env.DEBUG_SQL === 'true',
    }),
    ServiceIdentityModule,
    QdrantModule,
    IngestionModule,
    RetrievalModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
