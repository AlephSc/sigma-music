import { queryWithRetry } from '../db/client';
import type { Env, RagChunkRow } from '../types';
import { embedText, formatVectorLiteral } from './embedder';

export interface RankedChunk extends RagChunkRow {
  rrfScore: number;
}

const ID_STOPWORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'atau', 'ini', 'itu',
  'apa', 'apakah', 'berapa', 'bagaimana', 'mana', 'bisa', 'ada', 'saya', 'kami', 'anda',
  'mau', 'ingin', 'tanya', 'tolong', 'halo', 'hai', 'kak', 'mas', 'mbak', 'ya', 'dong',
]);

/**
 * Builds a Postgres `to_tsquery('simple', ...)` expression using OR (`|`)
 * across meaningful alphanumeric Indonesian tokens so natural questions
 * match even when not every word appears in the same chunk.
 */
export function buildOrTsQuery(rawQuery: string): string {
  const tokens = rawQuery
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !ID_STOPWORDS.has(t))
    .slice(0, 8);

  if (tokens.length === 0) return '';
  return tokens.join(' | ');
}

/**
 * Reciprocal Rank Fusion (RRF, k=60) combining dense vector similarity and FTS keyword results.
 */
export function fuseRrf(dense: RagChunkRow[], keyword: RagChunkRow[], k = 60, topN = 6): RankedChunk[] {
  const scores = new Map<number, { chunk: RagChunkRow; score: number }>();

  dense.forEach((chunk, rank) => {
    const prev = scores.get(chunk.id);
    const add = 1 / (k + rank + 1);
    scores.set(chunk.id, {
      chunk,
      score: (prev?.score ?? 0) + add,
    });
  });

  keyword.forEach((chunk, rank) => {
    const prev = scores.get(chunk.id);
    const add = 1 / (k + rank + 1);
    scores.set(chunk.id, {
      chunk: prev?.chunk ?? chunk,
      score: (prev?.score ?? 0) + add,
    });
  });

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((entry) => ({
      ...entry.chunk,
      rrfScore: entry.score,
    }));
}

/**
 * Hybrid RAG retrieval from Neon Postgres (`rag_chunks`):
 * - Dense vector cosine search (`pgvector` HNSW) when query embedding is available
 * - Token-OR Full-text search (`tsvector('simple')`)
 * - Graceful fallback to general chunks if query is a short greeting
 */
export async function retrieveRelevantChunks(
  env: Env,
  queryText: string,
  sessionContextText = ''
): Promise<RankedChunk[]> {
  const embedInput = sessionContextText ? `${sessionContextText}\n${queryText}` : queryText;
  const queryVec = await embedText(env, embedInput);
  const tsExpr = buildOrTsQuery(queryText);

  return queryWithRetry(env, async (sql) => {
    let denseRows: RagChunkRow[] = [];

    if (queryVec) {
      const vecLiteral = formatVectorLiteral(queryVec);
      denseRows = (await sql`
        SELECT c.id, c.document_id, d.title AS document_title, c.chunk_index, c.content, c.section,
               1 - (c.embedding <=> ${vecLiteral}::vector) AS score
        FROM rag_chunks c
        JOIN knowledge_docs d ON d.id = c.document_id
        WHERE c.embedding IS NOT NULL
        ORDER BY c.embedding <=> ${vecLiteral}::vector ASC
        LIMIT 20
      `) as RagChunkRow[];
    }

    let keywordRows: RagChunkRow[] = [];
    if (tsExpr) {
      keywordRows = (await sql`
        SELECT c.id, c.document_id, d.title AS document_title, c.chunk_index, c.content, c.section,
               ts_rank(c.tsv, to_tsquery('simple', ${tsExpr})) AS score
        FROM rag_chunks c
        JOIN knowledge_docs d ON d.id = c.document_id
        WHERE c.tsv @@ to_tsquery('simple', ${tsExpr})
        ORDER BY score DESC
        LIMIT 20
      `) as RagChunkRow[];
    }

    const fused = fuseRrf(denseRows, keywordRows, 60, 6);
    if (fused.length > 0) {
      return fused;
    }

    const fallbackRows = (await sql`
      SELECT c.id, c.document_id, d.title AS document_title, c.chunk_index, c.content, c.section, 0.1 AS score
      FROM rag_chunks c
      JOIN knowledge_docs d ON d.id = c.document_id
      ORDER BY c.id ASC
      LIMIT 4
    `) as RagChunkRow[];

    return fallbackRows.map((row) => ({ ...row, rrfScore: 0.01 }));
  });
}
