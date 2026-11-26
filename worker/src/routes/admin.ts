import { Hono } from 'hono';
import { queryWithRetry } from '../db/client';
import {
  constantTimeEqual,
  hashIp,
  isJwtRevoked,
  revokeJwtJti,
  signAdminJwt,
  verifyAdminJwt,
  type AdminJwtPayload,
} from '../lib/auth';
import { checkRateLimit } from '../lib/rateLimit';
import {
  dateBlockSchema,
  isValidCalendarDate,
  isValidMonth,
  knowledgeUploadSchema,
  loginSchema,
  updateBookingSchema,
  uuidRegex,
} from '../lib/validation';
import { chunkDocument, simpleHash } from '../rag/chunker';
import { embedText, formatVectorLiteral } from '../rag/embedder';
import type { BookingRow, Env } from '../types';

export const adminRoutes = new Hono<{
  Bindings: Env;
  Variables: { adminEmail: string; adminPayload?: AdminJwtPayload };
}>();

function getClientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || '127.0.0.1';
}

function normalizeBookingOutput(row: BookingRow): BookingRow {
  return {
    ...row,
    total_price: row.total_price === null || row.total_price === undefined ? null : Number(row.total_price),
  };
}

// Always set Cache-Control: no-store on every /v1/admin/* response (F-18)
adminRoutes.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
});

/**
 * POST /v1/admin/login
 * Rate-limited per IP and per email: 5 attempts / 15 minutes (F-03).
 */
adminRoutes.post('/login', async (c) => {
  const ip = getClientIp(c.req.raw);
  const ipHash = await hashIp(ip);

  const ipRl = await checkRateLimit(c.env, `login-ip:${ipHash}`, 5, 900);
  if (!ipRl.allowed) {
    return c.json(
      {
        type: 'about:blank',
        title: 'Terlalu Banyak Percobaan Login',
        status: 429,
        detail: 'Terlalu banyak percobaan login gagal. Coba lagi dalam beberapa menit.',
      },
      429,
      { 'Retry-After': String(ipRl.retryAfterSeconds) }
    );
  }

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

  const emailNorm = parsed.data.email.trim().toLowerCase();
  const emailRl = await checkRateLimit(c.env, `login-email:${emailNorm}`, 5, 900);
  if (!emailRl.allowed) {
    return c.json(
      {
        type: 'about:blank',
        title: 'Terlalu Banyak Percobaan Login',
        status: 429,
        detail: 'Terlalu banyak percobaan login untuk akun ini. Coba lagi dalam beberapa menit.',
      },
      429,
      { 'Retry-After': String(emailRl.retryAfterSeconds) }
    );
  }

  const expectedEmail = c.env.ADMIN_EMAIL || '';
  const expectedPass = c.env.ADMIN_PASSWORD || '';
  if (!expectedEmail || !expectedPass || !c.env.JWT_SECRET) {
    return c.json(
      { type: 'about:blank', title: 'Auth Misconfigured', status: 500, detail: 'Kredensial admin belum dikonfigurasi di server' },
      500
    );
  }

  const emailOk = constantTimeEqual(emailNorm, expectedEmail.trim().toLowerCase());
  const passOk = constantTimeEqual(parsed.data.password, expectedPass);

  if (!emailOk || !passOk) {
    return c.json({ type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Email atau password salah' }, 401);
  }

  const ttlSeconds = 7200; // 2 hours (F-12)
  const token = await signAdminJwt(expectedEmail, c.env.JWT_SECRET, ttlSeconds);
  return c.json({ token, email: expectedEmail, expires_in: ttlSeconds });
});

/**
 * Auth + revocation + rate-limit middleware for all protected /v1/admin/* routes (F-05, F-12).
 */
adminRoutes.use('*', async (c, next) => {
  if (c.req.path === '/v1/admin/login') {
    return next();
  }

  const ip = getClientIp(c.req.raw);
  const ipHash = await hashIp(ip);
  const adminRl = await checkRateLimit(c.env, `admin-api:${ipHash}`, 120, 60);
  if (!adminRl.allowed) {
    return c.json(
      { type: 'about:blank', title: 'Too Many Requests', status: 429, detail: 'Batas permintaan admin tercapai.' },
      429,
      { 'Retry-After': String(adminRl.retryAfterSeconds) }
    );
  }

  if (c.req.path === '/v1/admin/sync' && c.env.SYNC_API_KEY) {
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

  if (await isJwtRevoked(c.env.RATE_LIMIT_KV, payload.jti)) {
    return c.json({ type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Sesi sudah keluar (revoked)' }, 401);
  }

  c.set('adminEmail', payload.email);
  c.set('adminPayload', payload);
  return next();
});

/**
 * POST /v1/admin/logout — Server-side JWT revocation via KV denylist (F-12).
 */
adminRoutes.post('/logout', async (c) => {
  const payload = c.get('adminPayload');
  if (payload?.jti) {
    await revokeJwtJti(c.env.RATE_LIMIT_KV, payload.jti, payload.exp);
  }
  return c.json({ ok: true, message: 'Sesi berhasil dicabut.' });
});

/**
 * GET /v1/admin/bookings
 * Supports case-insensitive `status`, `month`, `date_from`, `date_to`, `q`, `limit`, `offset` (F-10).
 */
adminRoutes.get('/bookings', async (c) => {
  const statusRaw = c.req.query('status')?.trim().toLowerCase();
  const month = c.req.query('month')?.trim();
  const dateFrom = c.req.query('date_from')?.trim();
  const dateTo = c.req.query('date_to')?.trim();
  const q = c.req.query('q')?.trim().toLowerCase();
  const limitRaw = Number(c.req.query('limit') ?? 50);
  const offsetRaw = Number(c.req.query('offset') ?? 0);

  if (month && !isValidMonth(month)) {
    return c.json({ type: 'about:blank', title: 'Invalid Month', status: 400, detail: 'Format month harus YYYY-MM (bulan 01-12)' }, 400);
  }
  if (dateFrom && !isValidCalendarDate(dateFrom)) {
    return c.json({ type: 'about:blank', title: 'Invalid Date', status: 400, detail: 'Format date_from harus tanggal kalender valid YYYY-MM-DD' }, 400);
  }
  if (dateTo && !isValidCalendarDate(dateTo)) {
    return c.json({ type: 'about:blank', title: 'Invalid Date', status: 400, detail: 'Format date_to harus tanggal kalender valid YYYY-MM-DD' }, 400);
  }

  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

  const result = await queryWithRetry(c.env, async (sql) => {
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

    const filtered = allRows
      .filter((r) => {
        if (statusRaw && statusRaw !== 'all' && r.status !== statusRaw) return false;
        if (month && !r.event_date.startsWith(month)) return false;
        if (dateFrom && r.event_date < dateFrom) return false;
        if (dateTo && r.event_date > dateTo) return false;
        if (q) {
          const hay = `${r.customer_name} ${r.customer_phone} ${r.package} ${r.customer_address || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map(normalizeBookingOutput);

    return {
      total: filtered.length,
      limit,
      offset,
      bookings: filtered.slice(offset, offset + limit),
    };
  });

  return c.json(result);
});

/**
 * PATCH /v1/admin/bookings/:id
 * Supports editing all operational fields + clearing nullable fields like `total_price: null` (F-01, F-17).
 */
adminRoutes.patch('/bookings/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidRegex.test(id)) {
    return c.json({ type: 'about:blank', title: 'Invalid ID', status: 400, detail: 'ID booking harus UUID valid' }, 400);
  }

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
  const hasEventDate = u.event_date !== undefined;
  const hasPackage = u.package !== undefined;
  const hasCustomerName = u.customer_name !== undefined;
  const hasCustomerPhone = u.customer_phone !== undefined;
  const hasCustomerAddress = u.customer_address !== undefined;
  const hasNotes = u.notes !== undefined;
  const hasStatus = u.status !== undefined;
  const hasTotalPrice = u.total_price !== undefined;
  const hasSetupStart = u.setup_start !== undefined;
  const hasSetupEnd = u.setup_end !== undefined;

  const updated = await queryWithRetry(c.env, async (sql) => {
    const rows = (await sql`
      UPDATE bookings
      SET
        event_date = CASE WHEN ${hasEventDate} THEN ${u.event_date ?? null}::date ELSE event_date END,
        package = CASE WHEN ${hasPackage} THEN ${u.package ?? null} ELSE package END,
        customer_name = CASE WHEN ${hasCustomerName} THEN ${u.customer_name ?? null} ELSE customer_name END,
        customer_phone = CASE WHEN ${hasCustomerPhone} THEN ${u.customer_phone ?? null} ELSE customer_phone END,
        customer_address = CASE WHEN ${hasCustomerAddress} THEN ${u.customer_address ?? null} ELSE customer_address END,
        notes = CASE WHEN ${hasNotes} THEN ${u.notes ?? null} ELSE notes END,
        status = CASE WHEN ${hasStatus} THEN ${u.status ?? null}::booking_status ELSE status END,
        total_price = CASE WHEN ${hasTotalPrice} THEN ${u.total_price ?? null}::numeric ELSE total_price END,
        setup_start = CASE WHEN ${hasSetupStart} THEN ${u.setup_start ?? null}::time ELSE setup_start END,
        setup_end = CASE WHEN ${hasSetupEnd} THEN ${u.setup_end ?? null}::time ELSE setup_end END
      WHERE id = ${id}::uuid
      RETURNING
        id, created_at::text AS created_at, updated_at::text AS updated_at,
        event_date::text AS event_date, setup_start::text AS setup_start, setup_end::text AS setup_end,
        package, items, customer_name, customer_phone, customer_address, notes,
        status::text AS status, source, total_price
    `) as BookingRow[];

    return rows[0] ? normalizeBookingOutput(rows[0]) : null;
  });

  if (!updated) {
    return c.json({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Booking tidak ditemukan' }, 404);
  }

  return c.json({ ok: true, booking: updated });
});

/**
 * DELETE /v1/admin/bookings/:id — Removes a booking permanently (F-01, F-19).
 */
adminRoutes.delete('/bookings/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuidRegex.test(id)) {
    return c.json({ type: 'about:blank', title: 'Invalid ID', status: 400, detail: 'ID booking harus UUID valid' }, 400);
  }

  const deleted = await queryWithRetry(c.env, async (sql) => {
    const rows = (await sql`DELETE FROM bookings WHERE id = ${id}::uuid RETURNING id`) as Array<{ id: string }>;
    return rows.length > 0;
  });

  if (!deleted) {
    return c.json({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Booking tidak ditemukan' }, 404);
  }

  return c.json({ ok: true, deleted_id: id });
});

/**
 * P1: Manual date blocks ("Tutup / Penuh Total") — semantic date validation (F-07) & conflict count (F-11).
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
    return c.json(
      { type: 'about:blank', title: 'Validasi Gagal', status: 400, detail: parsed.error.issues.map((i) => i.message).join('; ') },
      400
    );
  }

  const existingBookings = await queryWithRetry(c.env, async (sql) => {
    const countRows = (await sql`
      SELECT COUNT(*)::int AS cnt FROM bookings
      WHERE event_date = ${parsed.data.event_date}::date
        AND status IN ('pending', 'booked', 'in_progress')
    `) as Array<{ cnt: number }>;

    await sql`
      INSERT INTO date_blocks (event_date, reason)
      VALUES (${parsed.data.event_date}::date, ${parsed.data.reason})
      ON CONFLICT (event_date) DO UPDATE SET reason = EXCLUDED.reason
    `;
    return countRows[0]?.cnt ?? 0;
  });

  return c.json(
    {
      ok: true,
      event_date: parsed.data.event_date,
      reason: parsed.data.reason,
      existing_bookings_count: existingBookings,
    },
    201
  );
});

adminRoutes.delete('/blocks/:date', async (c) => {
  const date = c.req.param('date');
  if (!isValidCalendarDate(date)) {
    return c.json({ type: 'about:blank', title: 'Invalid Date', status: 400, detail: 'Tanggal tidak valid (YYYY-MM-DD)' }, 400);
  }
  const deleted = await queryWithRetry(c.env, async (sql) => {
    const rows = (await sql`DELETE FROM date_blocks WHERE event_date = ${date}::date RETURNING event_date`) as Array<{
      event_date: string;
    }>;
    return rows.length > 0;
  });

  if (!deleted) {
    return c.json({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Tanggal tutup tidak ditemukan' }, 404);
  }
  return c.json({ ok: true });
});

/**
 * P1: Knowledge Base Management & RAG Ingestion (F-14, F-19)
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
    return c.json(
      { type: 'about:blank', title: 'Validasi Gagal', status: 400, detail: parsed.error.issues.map((i) => i.message).join('; ') },
      400
    );
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
  if (!uuidRegex.test(id)) {
    return c.json({ type: 'about:blank', title: 'Invalid ID', status: 400, detail: 'ID dokumen harus UUID valid' }, 400);
  }
  const deleted = await queryWithRetry(c.env, async (sql) => {
    const rows = (await sql`DELETE FROM knowledge_docs WHERE id = ${id}::uuid RETURNING id`) as Array<{ id: string }>;
    return rows.length > 0;
  });
  if (!deleted) {
    return c.json({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Dokumen tidak ditemukan' }, 404);
  }
  return c.json({ ok: true });
});

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
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ type: 'about:blank', title: 'Invalid JSON', status: 400, detail: 'Body harus JSON valid' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ type: 'about:blank', title: 'Validasi Gagal', status: 400, detail: 'Body harus berupa objek JSON' }, 400);
  }
  await queryWithRetry(c.env, async (sql) => {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
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
 * P2: Home Server Sync Pull Endpoint — supports `?since=ISO` & `?limit=` (F-10).
 */
adminRoutes.get('/sync', async (c) => {
  const since = c.req.query('since')?.trim();
  const limitRaw = Number(c.req.query('limit') ?? 200);
  const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 200;

  if (since && Number.isNaN(Date.parse(since))) {
    return c.json({ type: 'about:blank', title: 'Invalid Since', status: 400, detail: 'Parameter since harus ISO timestamp valid' }, 400);
  }

  const data = await queryWithRetry(c.env, async (sql) => {
    const bookings = since
      ? await sql`SELECT * FROM bookings WHERE updated_at >= ${since}::timestamptz ORDER BY updated_at ASC LIMIT ${limit}`
      : await sql`SELECT * FROM bookings ORDER BY created_at DESC LIMIT ${limit}`;
    const blocks = await sql`SELECT * FROM date_blocks ORDER BY event_date ASC`;
    return { synced_at: new Date().toISOString(), count: bookings.length, bookings, date_blocks: blocks };
  });
  return c.json(data);
});
