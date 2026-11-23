import type { Env } from '../types';

/**
 * Generates a 768-dimensional embedding using:
 * 1) Google Gemini Embedding API (`text-embedding-004` / `GEMINI_EMBED_MODEL`), or
 * 2) Cloudflare Workers AI (`@cf/baai/bge-base-en-v1.5`, 768-dim) if bound.
 * Returns null if neither provider is configured (retriever gracefully falls back to FTS).
 */
export async function embedText(env: Env, text: string): Promise<number[] | null> {
  if (env.GEMINI_API_KEY) {
    const model = env.GEMINI_EMBED_MODEL || 'text-embedding-004';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    });

    if (res.ok) {
      const json = (await res.json()) as { embedding?: { values?: number[] } };
      if (json.embedding?.values && json.embedding.values.length === 768) {
        return json.embedding.values;
      }
    }
  }

  if (env.AI) {
    try {
      const out = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [text] });
      const vec = out?.data?.[0];
      if (Array.isArray(vec) && vec.length === 768) {
        return vec;
      }
    } catch {
      // Fall through to null
    }
  }

  return null;
}

export function formatVectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => Number(n.toFixed(6))).join(',')}]`;
}
