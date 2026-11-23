export interface TextChunk {
  index: number;
  section: string;
  content: string;
  contentHash: string;
}

/**
 * Structure-aware chunker for Markdown / plain text knowledge documents.
 * Targets ~1000-1800 chars (~250-450 tokens) per chunk with ~15% overlap on hard cuts,
 * prepending document title and section heading so each chunk is self-contained.
 */
export function chunkDocument(title: string, rawText: string, maxChars = 1400, overlapChars = 200): TextChunk[] {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const sections: Array<{ heading: string; body: string }> = [];
  let currentHeading = 'Umum';
  let buffer: string[] = [];

  for (const line of lines) {
    const headingMatch = /^#{1,3}\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      if (buffer.join('\n').trim().length > 0) {
        sections.push({ heading: currentHeading, body: buffer.join('\n').trim() });
      }
      currentHeading = headingMatch[1].trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  if (buffer.join('\n').trim().length > 0) {
    sections.push({ heading: currentHeading, body: buffer.join('\n').trim() });
  }

  const chunks: TextChunk[] = [];
  let idx = 0;

  for (const sec of sections) {
    const prefix = `[${title} — ${sec.heading}]\n`;
    const paragraphs = sec.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let current = '';

    const pushChunk = (text: string) => {
      const full = `${prefix}${text}`.trim();
      if (full.length < 40) return;
      chunks.push({
        index: idx++,
        section: sec.heading,
        content: full,
        contentHash: simpleHash(full),
      });
    };

    for (const para of paragraphs) {
      if (current.length + para.length + 2 <= maxChars) {
        current = current ? `${current}\n\n${para}` : para;
      } else if (para.length > maxChars) {
        if (current) {
          pushChunk(current);
          current = '';
        }
        // Hard-cut long paragraph with overlap
        let start = 0;
        while (start < para.length) {
          const slice = para.slice(start, start + maxChars);
          pushChunk(slice);
          if (start + maxChars >= para.length) break;
          start += Math.max(1, maxChars - overlapChars);
        }
      } else {
        if (current) pushChunk(current);
        const tail = current.slice(-overlapChars);
        current = tail ? `${tail}\n\n${para}` : para;
        if (current.length > maxChars) {
          current = para;
        }
      }
    }

    if (current) {
      pushChunk(current);
    }
  }

  return chunks;
}

export function simpleHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
