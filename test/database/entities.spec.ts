import 'reflect-metadata';
import { DocumentChunk } from '../../src/database/entities/document-chunk.entity';
import { IngestionJob } from '../../src/database/entities/ingestion-job.entity';

describe('DocumentChunk entity', () => {
  it('has required fields', () => {
    const chunk = new DocumentChunk();
    expect(chunk).toBeInstanceOf(DocumentChunk);
  });
});

describe('IngestionJob entity', () => {
  it('has required fields', () => {
    const job = new IngestionJob();
    expect(job).toBeInstanceOf(IngestionJob);
  });
});
