import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { queryWithRetry } from './db/client';
import { PayloadTooLargeError, readTextWithLimit } from './lib/body';
import { adminRoutes } from './routes/admin';
import { publicRoutes } from './routes/public';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env; Variables: { rawBody?: string } }>();

/**
 * Normalizes an Origin string: lowercase, strip default port (:443 / :80) and trailing dot (F-22).
 */
export function normalizeOrigin(origin: string): string {
  try {
    const u = new URL(origin.trim());
    const host = u.hostname.toLowerCase().replace(/\.+$/, '');
    const isDefaultPort =
      (u.protocol === 'https:' && (u.port === '' || u.port === '443')) ||
      (u.protocol === 'http:' && (u.port === '' || u.port === '80'));
    const portPart = isDefaultPort ? '' : `:${u.port}`;
    return `${u.protocol}//${host}${portPart}`;
  } catch {
    return '';
  }
}

// Security headers on all API responses (F-18)
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// Normalized CORS allowlist (F-22) placed before Content-Type/size guards so error responses carry CORS headers
app.use('*', async (c, next) => {
  const rawOrigins =
    c.env.ALLOWED_ORIGINS ||
    'https://sigmamusic.my.id,https://www.sigmamusic.my.id,https://sigma-music.vercel.app,http://localhost:3000';
  const allowSet = new Set(
    rawOrigins
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean)
  );

  const corsMiddleware = cors({
    origin: (origin) => {
      if (!origin) return '';
      const norm = normalizeOrigin(origin);
      return norm && allowSet.has(norm) ? origin : '';
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Sync-Key'],
    maxAge: 86400,
  });

  return corsMiddleware(c, next);
});

// Strict Content-Type (F-20) and streaming Body Size Limit (F-26b) for mutating requests
app.use('*', async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
    // Allow empty-body POST to /v1/admin/logout and /v1/admin/knowledge/reindex
    const isNoBodyEndpoint =
      c.req.path === '/v1/admin/logout' || c.req.path === '/v1/admin/knowledge/reindex';

    if (!isNoBodyEndpoint) {
      const ct = (c.req.header('Content-Type') || '').toLowerCase();
      if (!ct.startsWith('application/json')) {
        return c.json(
          {
            type: 'about:blank',
            title: 'Unsupported Media Type',
            status: 415,
            detail: 'Content-Type harus application/json',
          },
          415
        );
      }
    }

    const maxBytes = isNoBodyEndpoint
      ? 4 * 1024
      : c.req.path.startsWith('/v1/admin/knowledge')
      ? 128 * 1024
      : 64 * 1024;

    try {
      const rawBody = await readTextWithLimit(c.req.raw, maxBytes);
      c.set('rawBody', rawBody);
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        return c.json(
          {
            type: 'about:blank',
            title: 'Payload Too Large',
            status: 413,
            detail: err.message,
          },
          413
        );
      }
      throw err;
    }
  }
  await next();
});

app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json(
    {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'Terjadi kesalahan pada server. Silakan coba lagi atau hubungi WhatsApp 0858-1668-6900.',
    },
    500
  );
});

app.route('/v1', publicRoutes);
app.route('/v1/admin', adminRoutes);

app.notFound((c) =>
  c.json({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Endpoint tidak ditemukan' }, 404)
);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      queryWithRetry(env, async (sql) => {
        await sql`SELECT 1`;
        await sql`DELETE FROM chat_sessions WHERE last_active < now() - interval '30 days'`;
      }).catch((err) => {
        console.error('Scheduled cron failed:', err);
      })
    );
  },
};
