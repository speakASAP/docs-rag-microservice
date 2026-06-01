import { MarkdownChunkerService } from '../../src/ingestion/markdown-chunker.service';

describe('MarkdownChunkerService', () => {
  let service: MarkdownChunkerService;

  beforeEach(() => {
    service = new MarkdownChunkerService();
  });

  it('chunks a markdown file by heading boundaries', () => {
    const md = `# Introduction\n\nSome intro text here.\n\n## Section A\n\nContent of section A.\n\n## Section B\n\nContent of section B.`;
    const chunks = service.chunk(md, 'README.md', { repoName: 'test-repo', serviceName: 'test' });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0].heading).toBe('Introduction');
    expect(chunks[0].text).toContain('Some intro text');
  });

  it('returns empty array for empty input', () => {
    const chunks = service.chunk('', 'empty.md', { repoName: 'test-repo' });
    expect(chunks).toHaveLength(0);
  });

  it('detects doc type from file path', () => {
    const chunks = service.chunk('# ADR\n\nDecision record content.', 'docs/adr/001-database.md', { repoName: 'test-repo' });
    expect(chunks[0].docType).toBe('adr');
  });

  it('splits large sections into sub-chunks', () => {
    const longContent = 'Word '.repeat(500);
    const md = `# Big Section\n\n${longContent}`;
    const chunks = service.chunk(md, 'large.md', { repoName: 'test-repo' });
    expect(chunks.length).toBeGreaterThan(1);
  });
});
