import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { GitSyncService } from '../../src/ingestion/git-sync.service';

describe('GitSyncService', () => {
  const workDir = path.join(__dirname, `.tmp-git-sync-${process.pid}`);
  let service: GitSyncService;
  let previousBasePath: string | undefined;
  let previousReposDir: string | undefined;

  function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  }

  function createRepository(repoDir: string, content = '# Initial'): string {
    fs.mkdirSync(repoDir, { recursive: true });
    git(repoDir, 'init');
    git(repoDir, 'config', 'user.email', 'tests@example.invalid');
    git(repoDir, 'config', 'user.name', 'Docs RAG Tests');
    fs.writeFileSync(path.join(repoDir, 'README.md'), content);
    git(repoDir, 'add', 'README.md');
    git(repoDir, 'commit', '-m', 'initial');
    return git(repoDir, 'rev-parse', 'HEAD');
  }

  function chmodTree(root: string, directoryMode: number, fileMode: number): void {
    if (!fs.existsSync(root)) return;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        chmodTree(entryPath, directoryMode, fileMode);
      } else {
        fs.chmodSync(entryPath, fileMode);
      }
    }
    fs.chmodSync(root, directoryMode);
  }

  beforeAll(() => {
    previousBasePath = process.env.GIT_BASE_PATH;
    previousReposDir = process.env.GIT_REPOS_DIR;
  });

  beforeEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.mkdirSync(workDir, { recursive: true });
    process.env.GIT_BASE_PATH = workDir;
    delete process.env.GIT_REPOS_DIR;
    service = new GitSyncService();
  });

  afterEach(() => {
    chmodTree(workDir, 0o755, 0o644);
    fs.rmSync(workDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (previousBasePath === undefined) delete process.env.GIT_BASE_PATH;
    else process.env.GIT_BASE_PATH = previousBasePath;
    if (previousReposDir === undefined) delete process.env.GIT_REPOS_DIR;
    else process.env.GIT_REPOS_DIR = previousReposDir;
  });

  it('prepares a read-only mounted repository without fetch or pull and returns its actual HEAD', async () => {
    const repoDir = path.join(workDir, 'mounted-repo');
    const expectedHead = createRepository(repoDir);
    const gitDir = path.join(repoDir, '.git');
    const fetchHead = path.join(gitDir, 'FETCH_HEAD');
    const configPath = path.join(gitDir, 'config');
    const configBefore = fs.readFileSync(configPath, 'utf8');
    const syncSpy = jest.spyOn(service, 'cloneOrPull');

    chmodTree(gitDir, 0o555, 0o444);
    const prepared = await service.prepareForIngestion('mounted-repo', 'local', true);

    expect(syncSpy).not.toHaveBeenCalled();
    expect(prepared).toEqual({ localPath: repoDir, commitHash: expectedHead });
    expect(fs.existsSync(fetchHead)).toBe(false);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(configBefore);
  });

  it('retains clone and pull behavior for writable remote repositories', async () => {
    const sourceDir = path.join(workDir, 'source-repo');
    createRepository(sourceDir);

    const first = await service.prepareForIngestion('remote-copy', sourceDir, false);
    expect(first.commitHash).toBe(git(sourceDir, 'rev-parse', 'HEAD'));

    fs.writeFileSync(path.join(sourceDir, 'README.md'), '# Updated');
    git(sourceDir, 'add', 'README.md');
    git(sourceDir, 'commit', '-m', 'update');
    const updatedHead = git(sourceDir, 'rev-parse', 'HEAD');

    const second = await service.prepareForIngestion('remote-copy', sourceDir, false);
    expect(second.localPath).toBe(path.join(workDir, 'remote-copy'));
    expect(second.commitHash).toBe(updatedHead);
  });

  it('lists markdown files from a local directory', async () => {
    const repoDir = path.join(workDir, 'test-repo');
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Test\n\nContent.');
    fs.mkdirSync(path.join(repoDir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'docs', 'guide.md'), '# Guide\n\nGuide content.');

    const files = await service.listMarkdownFiles(repoDir);
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files.some((file) => file.endsWith('README.md'))).toBe(true);
  });

  it('skips AppleDouble files', async () => {
    const repoDir = path.join(workDir, 'test-repo');
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Test');
    fs.writeFileSync(path.join(repoDir, '._README.md'), '\u0000AppleDouble');

    const files = await service.listMarkdownFiles(repoDir);
    expect(files.map((file) => path.basename(file))).toEqual(['README.md']);
  });

  it('applies source-specific path exclusions', async () => {
    const repoDir = path.join(workDir, 'test-repo');
    fs.mkdirSync(path.join(repoDir, 'docs', 'services'), { recursive: true });
    fs.mkdirSync(path.join(repoDir, 'docs', 'guides'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'docs', 'services', 'snapshot.md'), '# Snapshot');
    fs.writeFileSync(path.join(repoDir, 'docs', 'guides', 'current.md'), '# Current');

    const files = await service.listMarkdownFiles(repoDir, ['docs/services']);
    expect(files.some((file) => file.endsWith('snapshot.md'))).toBe(false);
    expect(files.some((file) => file.endsWith('current.md'))).toBe(true);
  });

  it('reads file content', async () => {
    const repoDir = path.join(workDir, 'test-repo');
    fs.mkdirSync(repoDir, { recursive: true });
    const filePath = path.join(repoDir, 'README.md');
    fs.writeFileSync(filePath, '# Hello\n\nWorld.');

    const content = await service.readFile(filePath);
    expect(content).toContain('Hello');
  });

  it('gets repo local path from a safe name', () => {
    expect(service.getLocalPath('my-service')).toBe(path.join(workDir, 'my-service'));
  });

  it('rejects repository names that can escape the configured root', () => {
    expect(() => service.getLocalPath('../other-repo')).toThrow('Unsafe repository name');
    expect(() => service.getLocalPath('nested/repo')).toThrow('Unsafe repository name');
  });
});
