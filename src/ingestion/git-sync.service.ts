import { Injectable, Logger } from '@nestjs/common';
import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

const MARKDOWN_EXTENSIONS = ['.md', '.mdx'];
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'coverage', 'vendor'];

export interface PreparedRepository {
  localPath: string;
  commitHash: string;
}

@Injectable()
export class GitSyncService {
  private readonly logger = new Logger(GitSyncService.name);
  private readonly reposDir: string;

  constructor() {
    this.reposDir = process.env.GIT_BASE_PATH || process.env.GIT_REPOS_DIR || '/data/repos';
  }

  async prepareForIngestion(
    repoName: string,
    repoUrl: string,
    readOnlyLocal: boolean,
    localAbsolutePath?: string,
  ): Promise<PreparedRepository> {
    const localPath = readOnlyLocal
      ? this.getLocalPath(repoName, localAbsolutePath)
      : await this.cloneOrPull(repoName, repoUrl);

    if (readOnlyLocal) {
      const stats = fs.statSync(localPath);
      if (!stats.isDirectory()) {
        throw new Error(`Mounted repository path is not a directory: ${localPath}`);
      }
      this.logger.log(`Using mounted checkout for ${repoName} without fetch or pull`);
    }

    return { localPath, commitHash: await this.getHeadCommit(localPath) };
  }

  async cloneOrPull(repoName: string, repoUrl: string): Promise<string> {
    const localPath = this.getLocalPath(repoName);

    if (fs.existsSync(path.join(localPath, '.git'))) {
      this.logger.log(`Pulling ${repoName}...`);
      const git: SimpleGit = simpleGit(localPath);
      await git.pull();
    } else {
      this.logger.log(`Cloning managed repository ${repoName}...`);
      fs.mkdirSync(localPath, { recursive: true });
      await simpleGit().clone(repoUrl, localPath);
    }

    return localPath;
  }

  async getHeadCommit(localPath: string): Promise<string> {
    try {
      const git: SimpleGit = simpleGit({
        baseDir: localPath,
        config: [`safe.directory=${localPath}`],
      });
      const hash = (await git.revparse(['--verify', 'HEAD'])).trim();
      if (!hash) {
        this.logger.warn(`No commits found at ${localPath}; treating as 'unknown'`);
        return 'unknown';
      }
      return hash;
    } catch (err) {
      // 'unknown' disables the up-to-date short-circuit, forcing a full
      // re-index every run. That is the safe direction, but it is silent and
      // wasteful, so make the cause visible. Common inside containers:
      // git refuses a repo owned by another uid unless safe.directory is set.
      this.logger.error(
        `Cannot read HEAD commit at ${localPath}: ${err instanceof Error ? err.message : String(err)}. ` +
          `Falling back to 'unknown', which forces a full re-index on every run.`,
      );
      return 'unknown';
    }
  }

  async listMarkdownFiles(dirPath: string, excludedRelativePaths: string[] = []): Promise<string[]> {
    const results: string[] = [];
    const rootReal = fs.realpathSync(dirPath);
    const normalizedExclusions = excludedRelativePaths.map((excluded) =>
      excluded.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''),
    );
    this.walkDir(dirPath, dirPath, results, normalizedExclusions, new Set([rootReal]));

    // A symlink and its target resolve to the same file (Github/CLAUDE.md ->
    // shared/CLAUDE.md). Index each real file once, preferring the shortest
    // path so the canonical location wins.
    const byRealPath = new Map<string, string>();
    for (const filePath of results.sort((a, b) => a.length - b.length)) {
      let realPath: string;
      try {
        realPath = fs.realpathSync(filePath);
      } catch (err) {
        this.logger.warn(
          `Skipping unresolvable file ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }
      if (!byRealPath.has(realPath)) byRealPath.set(realPath, filePath);
    }
    return [...byRealPath.values()];
  }

  async readFile(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf-8');
  }

  getLocalPath(repoName: string, localAbsolutePath?: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(repoName) || repoName === '.' || repoName === '..') {
      throw new Error(`Unsafe repository name: ${repoName}`);
    }

    if (localAbsolutePath) return path.resolve(localAbsolutePath);

    const reposRoot = path.resolve(this.reposDir);
    const localPath = path.resolve(reposRoot, repoName);
    const relativePath = path.relative(reposRoot, localPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error(`Repository path escapes the configured root: ${repoName}`);
    }
    return localPath;
  }

  private walkDir(
    rootDir: string,
    dir: string,
    results: string[],
    excludedRelativePaths: string[],
    visited: Set<string> = new Set(),
  ): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (EXCLUDED_DIRS.includes(entry.name)) continue;
      // AppleDouble resource-fork files can contain NUL bytes and are not
      // documentation even when their names end in .md.
      if (entry.name.startsWith('._')) continue;
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      if (
        excludedRelativePaths.some(
          (excluded) => relativePath === excluded || relativePath.startsWith(`${excluded}/`),
        )
      ) {
        continue;
      }

      // Resolve symlinks: the ecosystem root exposes authoritative docs as
      // symlinks (e.g. Github/CLAUDE.md -> shared/CLAUDE.md). Dirent.isDirectory()
      // and isFile() are both false for a symlink, so without this they are
      // silently skipped and never indexed.
      let isDirectory = entry.isDirectory();
      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch (err) {
          this.logger.warn(
            `Skipping unresolvable symlink ${fullPath}: ${err instanceof Error ? err.message : String(err)}`,
          );
          continue;
        }
        isDirectory = stat.isDirectory();
        isFile = stat.isFile();
      }

      if (isDirectory) {
        const realPath = fs.realpathSync(fullPath);
        if (visited.has(realPath)) continue;
        visited.add(realPath);
        this.walkDir(rootDir, fullPath, results, excludedRelativePaths, visited);
      } else if (isFile && MARKDOWN_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
}
