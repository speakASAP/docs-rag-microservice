import { Injectable } from '@nestjs/common';

export interface ChunkMeta {
  repoName: string;
  serviceName?: string;
}

export interface DocumentChunkData {
  heading: string;
  text: string;
  chunkIndex: number;
  filePath: string;
  docType: string;
  repoName: string;
  serviceName?: string;
  tags: string[];
}

const MAX_CHUNK_WORDS = 400;
const MAX_CHUNK_CHARS = 1800;

@Injectable()
export class MarkdownChunkerService {
  chunk(markdown: string, filePath: string, meta: ChunkMeta): DocumentChunkData[] {
    if (!markdown.trim()) return [];

    const sections = this.splitBySections(markdown);
    const docType = this.detectDocType(filePath);
    const result: DocumentChunkData[] = [];
    let chunkIndex = 0;

    for (const { heading, content } of sections) {
      const subChunks = this.splitByWordCount(content, MAX_CHUNK_WORDS);
      for (const text of subChunks) {
        if (!text.trim()) continue;
        result.push({
          heading,
          text: `${heading ? `# ${heading}\n\n` : ''}${text}`.trim(),
          chunkIndex: chunkIndex++,
          filePath,
          docType,
          repoName: meta.repoName,
          serviceName: meta.serviceName,
          tags: this.extractTags(heading, filePath, docType),
        });
      }
    }

    return result;
  }

  private splitBySections(markdown: string): { heading: string; content: string }[] {
    const lines = markdown.split('\n');
    const sections: { heading: string; content: string }[] = [];
    let currentHeading = '';
    let currentLines: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,3}\s+(.+)/);
      if (headingMatch) {
        if (currentLines.length > 0) {
          sections.push({ heading: currentHeading, content: currentLines.join('\n') });
        }
        currentHeading = headingMatch[1].trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      sections.push({ heading: currentHeading, content: currentLines.join('\n') });
    }

    return sections.length > 0 ? sections : [{ heading: '', content: markdown }];
  }

  private splitByWordCount(text: string, maxWords: number): string[] {
    const wordChunks = this.splitByWords(text, maxWords);
    return wordChunks.flatMap((chunk) => this.splitByCharacters(chunk, MAX_CHUNK_CHARS));
  }

  private splitByWords(text: string, maxWords: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return [text];

    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += maxWords) {
      chunks.push(words.slice(i, i + maxWords).join(' '));
    }
    return chunks;
  }

  private splitByCharacters(text: string, maxChars: number): string[] {
    if (text.length <= maxChars) return [text];

    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += maxChars) {
      chunks.push(text.slice(i, i + maxChars));
    }
    return chunks;
  }

  private detectDocType(filePath: string): string {
    const lower = filePath.toLowerCase();
    if (lower.includes('/adr/') || lower.includes('decision')) return 'adr';
    if (lower.includes('readme')) return 'readme';
    if (lower.includes('runbook') || lower.includes('ops')) return 'runbook';
    if (lower.includes('api') || lower.includes('swagger')) return 'api-docs';
    if (lower.includes('k8s') || lower.includes('kubernetes')) return 'infrastructure';
    if (lower.includes('claude.md') || lower.includes('agents.md')) return 'agent-instructions';
    if (lower.includes('system.md')) return 'system';
    if (lower.includes('business.md') || lower.includes('goals')) return 'business';
    return 'documentation';
  }

  private extractTags(heading: string, filePath: string, docType: string): string[] {
    const tags = new Set([docType]);
    const parts = filePath.split('/').filter(Boolean);
    if (parts.length > 0) tags.add(parts[0]);
    const keyTerms = ['auth', 'deploy', 'database', 'api', 'kubernetes', 'security', 'migration'];
    for (const term of keyTerms) {
      if (heading.toLowerCase().includes(term) || filePath.toLowerCase().includes(term)) {
        tags.add(term);
      }
    }
    return Array.from(tags);
  }
}
