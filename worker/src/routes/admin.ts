import { Hono } from 'hono';
import { queryWithRetry } from '../db/client';
import { constantTimeEqual, signAdminJwt, verifyAdminJwt } from '../lib/auth';
import { dateBlockSchema, dateRegex, knowledgeUploadSchema, loginSchema, monthRegex, updateBookingSchema } from '../lib/validation';
import { chunkDocument, simpleHash } from '../rag/chunker';
import { embedText, formatVectorLiteral } from '../rag/embedder';
import type { BookingRow, Env } from '../types';

export const adminRoutes = new Hono<{ Bindings: Env; Variables: { adminEmail: string } }>();

/**
 * POST /v1/admin/login
 * Verifies ADMIN_EMAIL + ADMIN_PASSWORD and returns a signed HS256 JWT.
 */
adminRoutes.post('/login', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ type: 'about:blank', title: 'Invalid JSON', status: 400, detail: 'Body harus JSON valid' }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ type: 'about:blank', title: 'Validasi Gagal', status: 400, detail: 'Email dan password wajib diisi' }, 400);
  }

  const expectedEmail = c.env.ADMIN_EMAIL || '';
  const expectedPass = c.env.ADMIN_PASSWORD || '';
  if (!expectedEmail || !expectedPass || !c.env.JWT_SECRET) {
    return c.json(
      { type: 'about:blank', title: 'Auth Misconfigured', status: 500, detail: 'Kredensial admin belum dikonfigurasi di server' },
      500
    );
  }

  const emailOk = constantTimeEqual(parsed.data.email.trim().toLowerCase(), expectedEmail.trim().toLowerCase());
  const passOk = constantTimeEqual(parsed.data.password, expectedPass);

  if (!emailOk || !passOk) {
    return c.json({ type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Email atau password salah' }, 401);
  }

  const token = await signAdminJwt(expectedEmail, c.env.JWT_SECRET);
  return c.json({ token, email: expectedEmail, expires_in: 86400 });
});

/**
 * Auth middleware for all protected /v1/admin/* routes (except /login and /sync with SYNC_API_KEY).
 */
adminRoutes.use('*', async (c, next) => {
  if (c.req.path.endsWith('/login')) {
    return next();
  }

  // Allow P2 home server sync via dedicated SYNC_API_KEY header if configured
  if (c.req.path.endsWith('/sync') && c.env.SYNC_API_KEY) {
    const syncKey = c.req.header('X-Sync-Key');
    if (syncKey && constantTimeEqual(syncKey, c.env.SYNC_API_KEY)) {
      c.set('adminEmail', 'homeserver-sync');
      return next();
    }
  }

  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token || !c.env.JWT_SECRET) {
    return c.json({ type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Token admin diperlukan' }, 401);
  }

  const payload = await verifyAdminJwt(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Token tidak valid atau kedaluwarsa' }, 401);
  }

  c.set('adminEmail', payload.email);
  return next();
});

/**
 * GET /v1/admin/bookings?status=&month=
 * Includes `same_date_count` for multi-booking warning badges.
 */
adminRoutes.get('/bookings', async (c) => {
  const status = c.req.query('status');
  const month = c.req.query('month');

  if (month && !monthRegex.test(month)) {
    return c.json({ type: 'about:blank', title: 'Invalid Month', status: 400, detail: 'Format month harus YYYY-MM' }, 400);
  }

  const rows = await queryWithRetry(c.env, async (sql) => {
    const allRows = (await sql`
      SELECT
        b.id,
        b.created_at::text AS created_at,
        b.updated_at::text AS updated_at,
        b.event_date::text AS event_date,
        b.setup_start::text AS setup_start,
        b.setup_end::text AS setup_end,
        b.package,
        b.items,
        b.customer_name,
        b.customer_phone,
        b.customer_address,
        b.notes,
        b.status::text AS status,
        b.source,
        b.total_price,
        (
          SELECT COUNT(*)::int
          FROM bookings b2
          WHERE b2.event_date = b.event_date
            AND b2.status IN ('pending', 'booked', 'in_progress')
        ) AS same_date_count
      FROM bookings b
      ORDER BY b.event_date ASC, b.created_at DESC
    `) as BookingRow[];

    return allRows.filter((r) => {
      if (status && status !== 'all' && r.status !== status) return false;
      if (month && !r.event_date.startsWith(month)) return false;
      return true;
    });
  });

  return c.json({ bookings: rows });
});

/**
 * PATCH /v1/admin/bookings/:id
 */
adminRoutes.patch('/bookings/:id', async (c) => {
  const id = c.req.param('id');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ type: 'about:blank', title: 'Invalid JSON', status: 400, detail: 'Body harus JSON valid' }, 400);
  }

  const parsed = updateBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { type: 'about:blank', title: 'Validasi Gagal', status: 400, detail: parsed.error.issues.map((i) => i.message).join('; ') },
      400
    );
  }

  const u = parsed.data;
  const updated = await queryWithRetry(c.env, async (sql) => {
    const existing = (await sql`
      SELECT id, event_date::text AS event_date, status::text AS status
      FROM bookings WHERE id = ${id}::uuid
    `) as Array<{ id: string; event_date: string; status: string }>;

    if (!existing[0]) {
      return null;
    }

    const rows = (await sql`
      UPDATE bookings
      SET
        status = COALESCE(${u.status ?? null}::booking_status, status),
        notes = COALESCE(${u.notes ?? null}, notes),
        total_price = COALESCE(${u.total_price ?? null}, total_price),
        package = COALESCE(${u.package ?? null}, package)
      WHERE id = ${id}::uuid
      RETURNING id, event_date::text AS event_date, status::text AS status, notes, total_price, package, updated_at::text AS updated_at
    `) as BookingRow[];

    return rows[0];
  });

  if (!updated) {
    return c.json({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Booking tidak ditemukan' }, 404);
  }

  return c.json({ ok: true, booking: updated });
});

/**
 * P1: Manual date blocks ("Tutup / Penuh Total")
 */
adminRoutes.get('/blocks', async (c) => {
  const blocks = await queryWithRetry(c.env, async (sql) => {
    return sql`SELECT event_date::text AS event_date, reason, created_at::text AS created_at FROM date_blocks ORDER BY event_date ASC`;
  });
  return c.json({ blocks });
});

adminRoutes.post('/blocks', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ type: 'about:blank', title: 'Invalid JSON', status: 400, detail: 'Body harus JSON valid' }, 400);
  }
  const parsed = dateBlockSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ type: 'about:blank', title: 'Validasi Gagal', status: 400, detail: parsed.error.issues[0]?.message }, 400);
  }

  await queryWithRetry(c.env, async (sql) => {
    await sql`
      INSERT INTO date_blocks (event_date, reason)
      VALUES (${parsed.data.event_date}::date, ${parsed.data.reason})
      ON CONFLICT (event_date) DO UPDATE SET reason = EXCLUDED.reason
    `;
  });

  return c.json({ ok: true, event_date: parsed.data.event_date, reason: parsed.data.reason }, 201);
});

adminRoutes.delete('/blocks/:date', async (c) => {
  const date = c.req.param('date');
  if (!dateRegex.test(date)) {
    return c.json({ type: 'about:blank', title: 'Invalid Date', status: 400, detail: 'Format tanggal harus YYYY-MM-DD' }, 400);
  }
  await queryWithRetry(c.env, async (sql) => {
    await sql`DELETE FROM date_blocks WHERE event_date = ${date}::date`;
  });
  return c.json({ ok: true });
});

/**
 * P1: Knowledge Base Management & RAG Ingestion
 */
adminRoutes.get('/knowledge', async (c) => {
  const docs = await queryWithRetry(c.env, async (sql) => {
    return sql`
      SELECT d.id, d.title, d.mime, d.status, d.created_at::text AS created_at, d.updated_at::text AS updated_at,
             COUNT(r.id)::int AS chunk_count
      FROM knowledge_docs d
      LEFT JOIN rag_chunks r ON r.document_id = d.id
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `;
  });
  return c.json({ documents: docs });
});

adminRoutes.post('/knowledge', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ type: 'about:blank', title: 'Invalid JSON', status: 400, detail: 'Body harus JSON valid' }, 400);
  }
  const parsed = knowledgeUploadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ type: 'about:blank', title: 'Validasi Gagal', status: 400, detail: parsed.error.issues[0]?.message }, 400);
  }

  const { title, content, mime } = parsed.data;
  const contentHash = simpleHash(content);
  const chunks = chunkDocument(title, content);

  const doc = await queryWithRetry(c.env, async (sql) => {
    const inserted = (await sql`
      INSERT INTO knowledge_docs (title, content, mime, status, content_hash)
      VALUES (${title}, ${content}, ${mime}, 'indexed', ${contentHash})
      RETURNING id, title, status, created_at::text AS created_at
    `) as Array<{ id: string; title: string; status: string; created_at: string }>;
    return inserted[0];
  });

  // Embed & insert chunks
  for (const ch of chunks) {
    const vec = await embedText(c.env, ch.content);
    const vecLiteral = vec ? formatVectorLiteral(vec) : null;
    await queryWithRetry(c.env, async (sql) => {
      if (vecLiteral) {
        await sql`
          INSERT INTO rag_chunks (document_id, chunk_index, content, embedding, section, content_hash)
          VALUES (${doc.id}::uuid, ${ch.index}, ${ch.content}, ${vecLiteral}::vector, ${ch.section}, ${ch.contentHash})
        `;
      } else {
        await sql`
          INSERT INTO rag_chunks (document_id, chunk_index, content, section, content_hash)
          VALUES (${doc.id}::uuid, ${ch.index}, ${ch.content}, ${ch.section}, ${ch.contentHash})
        `;
      }
    });
  }

  return c.json({ ok: true, document: doc, chunks_indexed: chunks.length }, 201);
});

adminRoutes.delete('/knowledge/:id', async (c) => {
  const id = c.req.param('id');
  await queryWithRetry(c.env, async (sql) => {
    await sql`DELETE FROM knowledge_docs WHERE id = ${id}::uuid`;
  });
  return c.json({ ok: true });
});

/**
 * P1: Re-embed all rag_chunks (e.g. seeded chunks or after switching embedder)
 */
adminRoutes.post('/knowledge/reindex', async (c) => {
  const onlyMissing = c.req.query('missing') !== 'false';
  const chunks = await queryWithRetry(c.env, async (sql) => {
    return (onlyMissing
      ? await sql`SELECT id, content FROM rag_chunks WHERE embedding IS NULL ORDER BY id ASC`
      : await sql`SELECT id, content FROM rag_chunks ORDER BY id ASC`) as Array<{
      id: number;
      content: string;
    }>;
  });

  let updated = 0;
  for (const ch of chunks) {
    const vec = await embedText(c.env, ch.content);
    if (!vec) continue;
    const vecLiteral = formatVectorLiteral(vec);
    await queryWithRetry(c.env, async (sql) => {
      await sql`UPDATE rag_chunks SET embedding = ${vecLiteral}::vector, updated_at = now() WHERE id = ${ch.id}`;
    });
    updated += 1;
  }

  return c.json({ ok: true, scanned: chunks.length, embedded: updated });
});

/**
 * Admin Chat Logs Viewer
 */
adminRoutes.get('/chats', async (c) => {
  const sessions = await queryWithRetry(c.env, async (sql) => {
    return sql`
      SELECT s.id, s.created_at::text AS created_at, s.last_active::text AS last_active, s.turn_count,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', m.id,
                   'role', m.role,
                   'content', m.content,
                   'created_at', m.created_at::text
                 ) ORDER BY m.created_at ASC
               ) FILTER (WHERE m.id IS NOT NULL),
               '[]'::json
             ) AS messages
      FROM chat_sessions s
      LEFT JOIN chat_messages m ON m.session_id = s.id
      GROUP BY s.id
      ORDER BY s.last_active DESC
      LIMIT 50
    `;
  });
  return c.json({ sessions });
});

/**
 * Admin Settings
 */
adminRoutes.get('/settings', async (c) => {
  const rows = await queryWithRetry(c.env, async (sql) => {
    return (await sql`SELECT key, value FROM settings`) as Array<{ key: string; value: unknown }>;
  });
  const settings: Record<string, unknown> = {};
  for (const r of rows) settings[r.key] = r.value;
  return c.json({ settings });
});

adminRoutes.put('/settings', async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>;
  await queryWithRetry(c.env, async (sql) => {
    for (const [key, value] of Object.entries(body)) {
      await sql`
        INSERT INTO settings (key, value)
        VALUES (${key}, ${JSON.stringify(value)}::jsonb)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    }
  });
  return c.json({ ok: true });
});

/**
 * P2: Home Server Sync Pull Endpoint
 */
adminRoutes.get('/sync', async (c) => {
  const since = c.req.query('since');
  const data = await queryWithRetry(c.env, async (sql) => {
    const bookings = since
      ? await sql`SELECT * FROM bookings WHERE updated_at >= ${since}::timestamptz ORDER BY updated_at ASC`
      : await sql`SELECT * FROM bookings ORDER BY created_at DESC LIMIT 500`;
    const blocks = await sql`SELECT * FROM date_blocks ORDER BY event_date ASC`;
    return { synced_at: new Date().toISOString(), bookings, date_blocks: blocks };
  });
  return c.json(data);
});
