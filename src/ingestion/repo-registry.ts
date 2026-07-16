export interface RepoEntry {
  repoName: string;
  repoUrl: string;
  localPath: boolean;
  localAbsolutePath?: string;
}

export const ECOSYSTEM_REPOS: RepoEntry[] = [
  { repoName: 'shared', repoUrl: 'git@github.com:speakASAP/shared.git', localPath: true },
  { repoName: 'auth-microservice', repoUrl: 'https://github.com/speakASAP/auth-microservice.git', localPath: true },
  { repoName: 'logging-microservice', repoUrl: 'git@github.com:speakASAP/logging-microservice.git', localPath: true },
  { repoName: 'notifications-microservice', repoUrl: 'git@github.com:speakASAP/notifications-microservice.git', localPath: true },
  { repoName: 'monitoring-microservice', repoUrl: 'git@github.com:speakASAP/monitoring-microservice.git', localPath: true },
  { repoName: 'backups-microservice', repoUrl: 'git@github.com:speakASAP/backups-microservice.git', localPath: true },
  { repoName: 'database-server', repoUrl: 'git@github.com:speakASAP/database-server.git', localPath: true },
  { repoName: 'nginx-microservice', repoUrl: 'git@github.com:speakASAP/nginx-microservice.git', localPath: true },
  { repoName: 'vault-microservice', repoUrl: 'git@github.com:speakASAP/vault-microservice.git', localPath: true },
  { repoName: 'ai-microservice', repoUrl: 'git@github.com:speakASAP/ai-microservice.git', localPath: true },
  { repoName: 'runlayer', repoUrl: 'git@github.com:speakASAP/runlayer.git', localPath: true },
  { repoName: 'prompts-microservice', repoUrl: 'git@github.com:speakASAP/prompts.git', localPath: true },
  { repoName: 'docs-rag-microservice', repoUrl: 'git@github.com:speakASAP/docs-rag-microservice.git', localPath: true },
  { repoName: 'catalog-microservice', repoUrl: 'git@github.com:speakASAP/catalog-microservice.git', localPath: true },
  { repoName: 'orders-microservice', repoUrl: 'git@github.com:speakASAP/orders-microservice.git', localPath: true },
  { repoName: 'payments-microservice', repoUrl: 'git@github.com:speakASAP/payments-microservice.git', localPath: true },
  { repoName: 'warehouse-microservice', repoUrl: 'git@github.com:speakASAP/warehouse-microservice.git', localPath: true },
  { repoName: 'suppliers-microservice', repoUrl: 'git@github.com:speakASAP/suppliers-microservice.git', localPath: true },
  { repoName: 'leads-microservice', repoUrl: 'https://github.com/speakASAP/leads-microservice.git', localPath: true },
  { repoName: 'marketing-microservice', repoUrl: 'https://github.com/speakASAP/marketing-microservice.git', localPath: true },
  { repoName: 'minio-microservice', repoUrl: 'https://github.com/speakASAP/minio.git', localPath: true },
  { repoName: 'allegro-service', repoUrl: 'git@github.com:speakASAP/allegro-service.git', localPath: true },
  { repoName: 'aukro-service', repoUrl: 'git@github.com:speakASAP/aukro-service.git', localPath: true },
  { repoName: 'bazos-service', repoUrl: 'git@github.com:speakASAP/bazos-service.git', localPath: true },
  { repoName: 'flipflop-service', repoUrl: 'git@github.com:speakASAP/flipflop-service.git', localPath: true },
  { repoName: 'heureka-service', repoUrl: 'git@github.com:speakASAP/heureka-service.git', localPath: true },
  { repoName: 'speakasap', repoUrl: 'git@github.com:speakASAP/speakasap-new.git', localPath: true },
  { repoName: 'speakasap-portal', repoUrl: 'git@github.com:speakASAP/speakasap-portal.git', localPath: true },
  { repoName: 'shop-assistant', repoUrl: 'git@github.com:speakASAP/shop-assistant.git', localPath: true },
  { repoName: 'agentic-email-processing-system', repoUrl: 'git@github.com:speakASAP/agentic-email-processing-system.git', localPath: true },
  { repoName: 'crypto-ai-agent', repoUrl: 'git@github.com:speakASAP/crypto-ai-agent.git', localPath: true },
  { repoName: 'school-committee', repoUrl: 'git@github.com:speakASAP/school-committee.git', localPath: true },
  { repoName: 'marathon', repoUrl: 'git@github.com:speakASAP/marathon.git', localPath: true },
  { repoName: 'k8s-manifests', repoUrl: 'git@github.com:speakASAP/k8s-manifests.git', localPath: true },
  { repoName: 'statex', repoUrl: 'git@github.com:speakASAP/statex.git', localPath: true },
  { repoName: 'statex-ecosystem', repoUrl: 'git@github.com:speakASAP/statex-ecosystem.git', localPath: true },
  { repoName: 'vault', repoUrl: 'git@github.com:speakASAP/vault.git', localPath: true },
  {
    repoName: 'claude-profile',
    repoUrl: 'local:///home/ssf/.claude',
    localPath: true,
    localAbsolutePath: '/home/ssf/.claude',
  },
  {
    repoName: 'codex-profile',
    repoUrl: 'local:///home/ssf/.codex',
    localPath: true,
    localAbsolutePath: '/home/ssf/.codex',
  },
  {
    repoName: 'cursor-profile',
    repoUrl: 'local:///home/ssf/.cursor',
    localPath: true,
    localAbsolutePath: '/home/ssf/.cursor',
  },
];
