import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { queryWithRetry } from './db/client';
import { adminRoutes } from './routes/admin';
import { publicRoutes } from './routes/public';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const rawOrigins = c.env.ALLOWED_ORIGINS || 'https://sigmamusic.my.id,http://localhost:3000';
  const allowlist = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const corsMiddleware = cors({
    origin: (origin) => {
      if (!origin) return allowlist[0] ?? '*';
      return allowlist.includes(origin) ? origin : '';
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Sync-Key'],
    maxAge: 86400,
  });

  return corsMiddleware(c, next);
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
        // Heartbeat + purge chat sessions older than 30 days
        await sql`SELECT 1`;
        await sql`DELETE FROM chat_sessions WHERE last_active < now() - interval '30 days'`;
      }).catch((err) => {
        console.error('Scheduled cron failed:', err);
      })
    );
  },
};
