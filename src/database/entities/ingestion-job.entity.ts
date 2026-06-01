import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

@Entity('ingestion_jobs')
export class IngestionJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 200 })
  repoName!: string;

  @Column('varchar', { length: 500 })
  repoUrl!: string;

  @Column('varchar', { length: 20, default: 'pending' })
  status!: JobStatus;

  @Column('integer', { default: 0 })
  chunksProcessed!: number;

  @Column('integer', { default: 0 })
  chunksTotal!: number;

  @Column('text', { nullable: true })
  errorMessage?: string;

  @Column('varchar', { length: 40, nullable: true })
  lastCommitHash?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
