import * as fs from 'fs';
import * as path from 'path';
import {
  getEcosystemRepos,
  loadEcosystemRepos,
  resetEcosystemReposCache,
} from '../../src/ingestion/repo-registry';

/**
 * Regression cover for the wisdom-quotes ingestion failure of 2026-08-30: the
 * repo was registered in the catalog at 19:43, the running process had loaded
 * the catalog into a module-level constant before that, so at 20:53 the repo
 * was unknown to the registry, ingestion fell back to the request default
 * localPath=false and tried to `git pull` inside the read-only repos mount.
 */
describe('ecosystem repository catalog refresh', () => {
  const workDir = path.join(__dirname, `.tmp-repo-registry-${process.pid}`);
  const catalogPath = path.join(workDir, 'ecosystem-repositories.json');

  function writeCatalog(ids: string[], mtimeSeconds: number): void {
    fs.writeFileSync(
      catalogPath,
      JSON.stringify({
        schemaVersion: 1,
        repositories: ids.map((id) => ({
          id,
          checkout: id,
          github: `https://github.com/speakASAP/${id}`,
          docsRag: true,
        })),
      }),
    );
    // Guard against two writes landing in the same filesystem timestamp tick.
    fs.utimesSync(catalogPath, mtimeSeconds, mtimeSeconds);
  }

  beforeEach(() => {
    fs.mkdirSync(workDir, { recursive: true });
    resetEcosystemReposCache();
  });

  afterEach(() => {
    resetEcosystemReposCache();
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('sees a repository registered after the first load without a process restart', () => {
    writeCatalog(['catalog-microservice'], 1_700_000_000);
    const before = getEcosystemRepos('/data/repos', catalogPath);
    expect(before.map((repo) => repo.repoName)).not.toContain('wisdom-quotes');

    writeCatalog(['catalog-microservice', 'wisdom-quotes'], 1_700_000_060);

    const after = getEcosystemRepos('/data/repos', catalogPath);
    expect(after.find((repo) => repo.repoName === 'wisdom-quotes')).toEqual({
      repoName: 'wisdom-quotes',
      repoUrl: 'https://github.com/speakASAP/wisdom-quotes.git',
      localPath: true,
      localAbsolutePath: undefined,
      excludeMarkdownPaths: undefined,
    });
  });

  it('does not re-parse an unchanged catalog', () => {
    writeCatalog(['catalog-microservice'], 1_700_000_000);
    const first = getEcosystemRepos('/data/repos', catalogPath);
    const second = getEcosystemRepos('/data/repos', catalogPath);
    expect(second).toBe(first);
  });

  it('serves the last known catalog when the file becomes unreadable', () => {
    writeCatalog(['catalog-microservice'], 1_700_000_000);
    const loaded = getEcosystemRepos('/data/repos', catalogPath);
    fs.rmSync(catalogPath);

    const fallback = getEcosystemRepos('/data/repos', catalogPath);
    expect(fallback).toBe(loaded);
  });

  it('throws when the catalog is unreadable and nothing was ever loaded', () => {
    expect(() => getEcosystemRepos('/data/repos', path.join(workDir, 'missing.json'))).toThrow();
  });

  it('keeps every catalog entry local, so no catalog repo is ever cloned', () => {
    writeCatalog(['wisdom-quotes', 'catalog-microservice'], 1_700_000_000);
    const repos = loadEcosystemRepos('/data/repos', catalogPath);
    expect(repos.every((repo) => repo.localPath === true)).toBe(true);
  });
});
