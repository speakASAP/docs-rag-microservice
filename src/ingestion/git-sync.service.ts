import { Injectable, Logger } from '@nestjs/common';
import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

const MARKDOWN_EXTENSIONS = ['.md', '.mdx'];
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'coverage', 'vendor'];

@Injectable()
export class GitSyncService {
  private readonly logger = new Logger(GitSyncService.name);
  private readonly reposDir: string;

  constructor() {
    this.reposDir = process.env.GIT_BASE_PATH || process.env.GIT_REPOS_DIR || '/data/repos';
  }

  async cloneOrPull(repoName: string, repoUrl: string): Promise<string> {
    const localPath = this.getLocalPath(repoName);

    if (fs.existsSync(path.join(localPath, '.git'))) {
      this.logger.log(`Pulling ${repoName}...`);
      const git: SimpleGit = simpleGit(localPath);
      await git.pull();
    } else {
      this.logger.log(`Cloning ${repoName} from ${repoUrl}...`);
      fs.mkdirSync(localPath, { recursive: true });
      await simpleGit().clone(repoUrl, localPath);
    }

    return localPath;
  }

  async getHeadCommit(localPath: string): Promise<string> {
    try {
      const git: SimpleGit = simpleGit(localPath);
      const log = await git.log({ maxCount: 1 });
      const hash = log.latest?.hash;
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

  async listMarkdownFiles(dirPath: string): Promise<string[]> {
    const results: string[] = [];
    const rootReal = fs.realpathSync(dirPath);
    this.walkDir(dirPath, results, new Set([rootReal]));

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
    return localAbsolutePath ? path.resolve(localAbsolutePath) : path.join(this.reposDir, repoName);
  }

  private walkDir(dir: string, results: string[], visited: Set<string> = new Set()): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (EXCLUDED_DIRS.includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);

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
        this.walkDir(fullPath, results, visited);
      } else if (isFile && MARKDOWN_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
}
