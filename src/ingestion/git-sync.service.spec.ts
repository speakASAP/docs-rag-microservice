import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { GitSyncService } from './git-sync.service';

/**
 * Regression: jarvis vendors Rust crates under `engine/.cargo-home`. Cargo unpacks
 * some of them root-owned 0640, and docs-rag runs as uid 1000, so walking that tree
 * threw EACCES and failed the whole repo -- after the run had already deleted the
 * repo's existing chunks, leaving jarvis with an empty index every 6h for two days.
 *
 * `.cargo-home` also held 858 of jarvis's 928 markdown files. None of them are our
 * documentation.
 */
describe('GitSyncService.listMarkdownFiles', () => {
  let root: string;
  let service: GitSyncService;

  const write = (rel: string, body = '# doc\n') => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
    return full;
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-rag-walk-'));
    service = new GitSyncService();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const rel = (files: string[]) => files.map((f) => path.relative(root, f).replace(/\\/g, '/')).sort();

  it('skips vendored Rust crate docs under .cargo-home', async () => {
    write('docs/real.md');
    write('engine/.cargo-home/registry/src/index.crates.io-1949cf8c/fnv-1.0.7/README.md');
    write('engine/.cargo-home/registry/src/index.crates.io-1949cf8c/serde-1.0/README.md');

    expect(rel(await service.listMarkdownFiles(root))).toEqual(['docs/real.md']);
  });

  it('skips build output under target/', async () => {
    write('docs/real.md');
    write('engine/target/debug/build/notes.md');

    expect(rel(await service.listMarkdownFiles(root))).toEqual(['docs/real.md']);
  });

  it('still walks ordinary source and docs directories', async () => {
    write('README.md');
    write('docs/guide.md');
    write('engine/src/notes.md');

    expect(rel(await service.listMarkdownFiles(root))).toEqual([
      'README.md',
      'docs/guide.md',
      'engine/src/notes.md',
    ]);
  });

  it('keeps excluding the directories it already excluded', async () => {
    write('keep.md');
    for (const dir of ['node_modules', '.git', 'dist', 'coverage', 'vendor', '.venv']) {
      write(`${dir}/skipped.md`);
    }

    expect(rel(await service.listMarkdownFiles(root))).toEqual(['keep.md']);
  });

  it('does not exclude directories that merely contain an excluded name', async () => {
    write('my-vendor-notes/doc.md');
    write('targeting/doc.md');

    expect(rel(await service.listMarkdownFiles(root))).toEqual([
      'my-vendor-notes/doc.md',
      'targeting/doc.md',
    ]);
  });
});

describe('GitSyncService.readFile', () => {
  let root: string;
  let service: GitSyncService;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-rag-read-'));
    service = new GitSyncService();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rejects with EACCES on an unreadable file so the caller can skip it', async () => {
    if (process.getuid && process.getuid() === 0) {
      // root bypasses mode bits; the condition under test cannot be produced.
      return;
    }
    const file = path.join(root, 'secret.md');
    fs.writeFileSync(file, '# nope\n');
    fs.chmodSync(file, 0o000);

    await expect(service.readFile(file)).rejects.toMatchObject({ code: 'EACCES' });
  });
});
