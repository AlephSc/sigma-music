import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type { Env } from '../types';

export type SqlClient = NeonQueryFunction<false, false>;

/**
 * Creates a Neon serverless SQL client with a lightweight retry wrapper
 * to handle Neon's 1-2s cold-start wake-up gracefully.
 */
export function createSqlClient(databaseUrl: string): SqlClient {
  return neon(databaseUrl);
}

export async function queryWithRetry<T = Record<string, unknown>>(
  env: Env,
  fn: (sql: SqlClient) => Promise<T>,
  retries = 2
): Promise<T> {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  const sql = createSqlClient(env.DATABASE_URL);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(sql);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      const isTransient =
        msg.includes('timeout') ||
        msg.includes('connection') ||
        msg.includes('econnreset') ||
        msg.includes('fetch failed') ||
        msg.includes('starting');

      if (!isTransient || attempt === retries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}
