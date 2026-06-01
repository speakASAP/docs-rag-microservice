import { GitSyncService } from '../../src/ingestion/git-sync.service';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

describe('GitSyncService', () => {
  let service: GitSyncService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-sync-test-'));
    process.env.GIT_REPOS_DIR = tmpDir;
    service = new GitSyncService();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists markdown files from a local directory', async () => {
    const repoDir = path.join(tmpDir, 'test-repo');
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Test\n\nContent.');
    fs.mkdirSync(path.join(repoDir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'docs', 'guide.md'), '# Guide\n\nGuide content.');

    const files = await service.listMarkdownFiles(repoDir);
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files.some((f) => f.endsWith('README.md'))).toBe(true);
  });

  it('reads file content', async () => {
    const repoDir = path.join(tmpDir, 'test-repo');
    fs.mkdirSync(repoDir, { recursive: true });
    const filePath = path.join(repoDir, 'README.md');
    fs.writeFileSync(filePath, '# Hello\n\nWorld.');

    const content = await service.readFile(filePath);
    expect(content).toContain('Hello');
  });

  it('gets repo local path from name', () => {
    const localPath = service.getLocalPath('my-service');
    expect(localPath).toContain('my-service');
    expect(localPath).toContain(tmpDir);
  });
});
