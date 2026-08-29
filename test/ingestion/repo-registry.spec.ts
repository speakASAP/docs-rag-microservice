import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadEcosystemRepos } from '../../src/ingestion/repo-registry';

describe('repository catalog', () => {
  it('loads approved repositories and preserves checkout aliases and exclusions', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-catalog-test-'));
    const catalogPath = path.join(tmpDir, 'catalog.json');
    fs.writeFileSync(
      catalogPath,
      JSON.stringify({
        schemaVersion: 1,
        repositories: [
          {
            id: 'service-name',
            checkout: 'checkout-name',
            github: 'https://github.com/example/service',
            docsRag: true,
            excludeMarkdownPaths: ['docs/services'],
          },
          {
            id: 'not-indexed',
            checkout: 'not-indexed',
            github: 'https://github.com/example/not-indexed',
            docsRag: false,
          },
        ],
      }),
    );

    const repos = loadEcosystemRepos('/data/repos', catalogPath);
    const service = repos.find((repo) => repo.repoName === 'service-name');
    expect(service).toEqual({
      repoName: 'service-name',
      repoUrl: 'https://github.com/example/service.git',
      localPath: true,
      localAbsolutePath: '/data/repos/checkout-name',
      excludeMarkdownPaths: ['docs/services'],
    });
    expect(repos.some((repo) => repo.repoName === 'not-indexed')).toBe(false);
    expect(repos.filter((repo) => repo.repoName.endsWith('-profile'))).toHaveLength(3);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
