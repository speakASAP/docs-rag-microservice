import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('document_chunks')
@Index('idx_chunk_repo', ['repoName'])
@Index('idx_chunk_service', ['serviceName'])
@Index('idx_chunk_type', ['docType'])
@Index('idx_chunk_qdrant', ['qdrantId'], { unique: true })
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 200 })
  repoName!: string;

  @Column('varchar', { length: 200, nullable: true })
  serviceName?: string;

  @Column('varchar', { length: 500 })
  filePath!: string;

  @Column('varchar', { length: 100 })
  docType!: string;

  @Column('text')
  chunkText!: string;

  @Column('integer')
  chunkIndex!: number;

  @Column('varchar', { length: 100 })
  embeddingModel!: string;

  @Column('varchar', { length: 100 })
  qdrantId!: string;

  @Column('varchar', { length: 40, nullable: true })
  gitCommitHash?: string;

  @Column('varchar', { length: 50, nullable: true })
  version?: string;

  @Column('simple-array', { nullable: true })
  tags?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
