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
      return log.latest?.hash ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async listMarkdownFiles(dirPath: string): Promise<string[]> {
    const results: string[] = [];
    this.walkDir(dirPath, results);
    return results;
  }

  async readFile(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf-8');
  }

  getLocalPath(repoName: string): string {
    return path.join(this.reposDir, repoName);
  }

  private walkDir(dir: string, results: string[]): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (EXCLUDED_DIRS.includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walkDir(fullPath, results);
      } else if (MARKDOWN_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
}
