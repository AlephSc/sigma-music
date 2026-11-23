import { queryWithRetry } from '../db/client';
import type { Env, RagChunkRow } from '../types';
import { embedText, formatVectorLiteral } from './embedder';

export interface RankedChunk extends RagChunkRow {
  rrfScore: number;
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
 * - Dense vector cosine search when query embedding is available
 * - Full-text search (`tsvector('simple')`)
 * - Fallback to ILIKE / top chunks if query has uncommon terms
 */
export async function retrieveRelevantChunks(
  env: Env,
  queryText: string,
  sessionContextText = ''
): Promise<RankedChunk[]> {
  const embedInput = sessionContextText ? `${sessionContextText}\n${queryText}` : queryText;
  const queryVec = await embedText(env, embedInput);

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

    const keywordRows = (await sql`
      SELECT c.id, c.document_id, d.title AS document_title, c.chunk_index, c.content, c.section,
             ts_rank(c.tsv, plainto_tsquery('simple', ${queryText})) AS score
      FROM rag_chunks c
      JOIN knowledge_docs d ON d.id = c.document_id
      WHERE c.tsv @@ plainto_tsquery('simple', ${queryText})
      ORDER BY score DESC
      LIMIT 20
    `) as RagChunkRow[];

    const fused = fuseRrf(denseRows, keywordRows, 60, 6);
    if (fused.length > 0) {
      return fused;
    }

    // Fallback: return top general chunks if FTS/vector returned nothing (e.g., short greeting or broad question)
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
