import * as fs from 'fs';
import * as path from 'path';

export interface RepoEntry {
  repoName: string;
  repoUrl: string;
  localPath: boolean;
  localAbsolutePath?: string;
  excludeMarkdownPaths?: string[];
}

interface CatalogEntry {
  id: string;
  checkout: string;
  github: string;
  docsRag?: boolean;
  excludeMarkdownPaths?: string[];
}

interface RepositoryCatalog {
  schemaVersion: number;
  repositories: CatalogEntry[];
}

function resolveCatalogPath(reposRoot: string): string {
  const candidates = [
    process.env.ECOSYSTEM_REPOSITORY_CATALOG,
    path.join(reposRoot, 'shared', 'config', 'ecosystem-repositories.json'),
    path.resolve(process.cwd(), '..', 'shared', 'config', 'ecosystem-repositories.json'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const catalogPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!catalogPath) {
    throw new Error(`Ecosystem repository catalog not found. Checked: ${candidates.join(', ')}`);
  }
  return catalogPath;
}

export function loadEcosystemRepos(
  reposRoot = process.env.GIT_BASE_PATH || process.env.GIT_REPOS_DIR || '/data/repos',
  catalogPath = resolveCatalogPath(reposRoot),
): RepoEntry[] {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8')) as RepositoryCatalog;
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.repositories)) {
    throw new Error(`Unsupported ecosystem repository catalog: ${catalogPath}`);
  }

  const repositories = catalog.repositories
    .filter((entry) => entry.docsRag === true)
    .map((entry): RepoEntry => ({
      repoName: entry.id,
      repoUrl: `${entry.github}.git`,
      localPath: true,
      localAbsolutePath:
        entry.checkout === entry.id ? undefined : path.join(reposRoot, entry.checkout),
      excludeMarkdownPaths: entry.excludeMarkdownPaths,
    }));

  const profiles: RepoEntry[] = [
    {
      repoName: 'claude-profile',
      repoUrl: 'local:///data/agent-profiles/claude',
      localPath: true,
      localAbsolutePath: '/data/agent-profiles/claude',
    },
    {
      repoName: 'codex-profile',
      repoUrl: 'local:///data/agent-profiles/codex',
      localPath: true,
      localAbsolutePath: '/data/agent-profiles/codex',
    },
    {
      repoName: 'cursor-profile',
      repoUrl: 'local:///data/agent-profiles/cursor',
      localPath: true,
      localAbsolutePath: '/data/agent-profiles/cursor',
    },
  ];

  return [...repositories, ...profiles];
}

export const ECOSYSTEM_REPOS: RepoEntry[] = loadEcosystemRepos();
