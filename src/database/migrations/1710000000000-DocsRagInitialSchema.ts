import { MigrationInterface, QueryRunner } from 'typeorm';

export class DocsRagInitialSchema1710000000000 implements MigrationInterface {
  name = 'DocsRagInitialSchema1710000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_chunks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "repoName" varchar(200) NOT NULL,
        "serviceName" varchar(200),
        "filePath" varchar(500) NOT NULL,
        "docType" varchar(100) NOT NULL,
        "chunkText" text NOT NULL,
        "chunkIndex" integer NOT NULL,
        "embeddingModel" varchar(100) NOT NULL,
        "qdrantId" varchar(100) NOT NULL,
        "gitCommitHash" varchar(40),
        "version" varchar(50),
        "tags" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ingestion_jobs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "repoName" varchar(200) NOT NULL,
        "repoUrl" varchar(500) NOT NULL,
        "localPath" boolean NOT NULL DEFAULT false,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "chunksProcessed" integer NOT NULL DEFAULT 0,
        "chunksTotal" integer NOT NULL DEFAULT 0,
        "errorMessage" text,
        "lastCommitHash" varchar(40),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_chunk_repo" ON "document_chunks" ("repoName")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_chunk_service" ON "document_chunks" ("serviceName")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_chunk_type" ON "document_chunks" ("docType")');
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "idx_chunk_qdrant" ON "document_chunks" ("qdrantId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_ingestion_jobs_repo_created" ON "ingestion_jobs" ("repoName", "createdAt")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "idx_ingestion_jobs_status" ON "ingestion_jobs" ("status")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_ingestion_jobs_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_ingestion_jobs_repo_created"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_chunk_qdrant"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_chunk_type"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_chunk_service"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_chunk_repo"');
    await queryRunner.query('DROP TABLE IF EXISTS "ingestion_jobs"');
    await queryRunner.query('DROP TABLE IF EXISTS "document_chunks"');
  }
}
