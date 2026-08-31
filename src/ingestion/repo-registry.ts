import { Logger } from '@nestjs/common';
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

interface CatalogSnapshot {
  catalogPath: string;
  reposRoot: string;
  mtimeMs: number;
  size: number;
  repos: RepoEntry[];
}

const logger = new Logger('RepoRegistry');

let snapshot: CatalogSnapshot | undefined;

function defaultReposRoot(): string {
  return process.env.GIT_BASE_PATH || process.env.GIT_REPOS_DIR || '/data/repos';
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
  reposRoot = defaultReposRoot(),
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

/**
 * The catalog is a live file on a mounted volume that other workstreams edit;
 * a repo registered while this process is running must become ingestible
 * without a restart. A one-shot module-level snapshot made a newly registered
 * repo unknown to the registry, which silently downgraded it to
 * localPath=false and sent ingestion into `git pull` on the read-only mount
 * (wisdom-quotes, 2026-08-30). Re-read whenever the file changes; the stat is
 * cheap and the parse only happens on change.
 */
export function getEcosystemRepos(
  reposRoot = defaultReposRoot(),
  catalogPathOverride?: string,
): RepoEntry[] {
  try {
    const catalogPath = catalogPathOverride ?? resolveCatalogPath(reposRoot);
    const stats = fs.statSync(catalogPath);
    if (
      snapshot &&
      snapshot.catalogPath === catalogPath &&
      snapshot.reposRoot === reposRoot &&
      snapshot.mtimeMs === stats.mtimeMs &&
      snapshot.size === stats.size
    ) {
      return snapshot.repos;
    }

    const repos = loadEcosystemRepos(reposRoot, catalogPath);
    snapshot = { catalogPath, reposRoot, mtimeMs: stats.mtimeMs, size: stats.size, repos };
    logger.log(`Loaded ecosystem repository catalog ${catalogPath}: ${repos.length} source(s)`);
    return repos;
  } catch (err) {
    // Serving the last good catalog beats failing every ingestion because the
    // file was mid-write, but it must never be silent.
    if (!snapshot) throw err;
    logger.error(
      `Cannot re-read the ecosystem repository catalog: ${err instanceof Error ? err.message : String(err)}. ` +
        `Serving the last known catalog (${snapshot.repos.length} sources) — newly registered repos will be missing.`,
    );
    return snapshot.repos;
  }
}

/** Test hook: drops the cached catalog so the next read hits the filesystem. */
export function resetEcosystemReposCache(): void {
  snapshot = undefined;
}

// Prime at import time so a missing or malformed catalog fails the process at
// startup rather than at the first ingestion request.
getEcosystemRepos();
