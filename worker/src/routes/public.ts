import { Hono } from 'hono';
import { queryWithRetry } from '../db/client';
import { hashIp } from '../lib/auth';
import { checkRateLimit } from '../lib/rateLimit';
import { sanitizeChatInput } from '../lib/sanitize';
import { chatRequestSchema, createBookingSchema, monthRegex } from '../lib/validation';
import { dispatchBookingWebhook } from '../lib/webhook';
import { handleChatTurn } from '../rag/chat';
import type { DayAvailabilityStatus, Env } from '../types';

export const publicRoutes = new Hono<{ Bindings: Env }>();

function getClientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || '127.0.0.1';
}

publicRoutes.get('/health', async (c) => {
  if (!c.env.DATABASE_URL) {
    return c.json({ ok: true, db: 'unconfigured' });
  }
  try {
    await queryWithRetry(c.env, async (sql) => sql`SELECT 1 AS ok`);
    return c.json({ ok: true, db: 'connected' });
  } catch (err) {
    return c.json(
      {
        type: 'about:blank',
        title: 'Database Unavailable',
        status: 503,
        detail: err instanceof Error ? err.message : 'Database connection failed',
      },
      503
    );
  }
});

/**
 * GET /v1/availability?month=YYYY-MM
 * Returns non-PII day statuses for the requested month.
 */
publicRoutes.get('/availability', async (c) => {
  const month = c.req.query('month') || new Date().toISOString().slice(0, 7);
  if (!monthRegex.test(month)) {
    return c.json(
      { type: 'about:blank', title: 'Invalid Month', status: 400, detail: 'Parameter month harus berformat YYYY-MM' },
      400
    );
  }

  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const mon = Number(monthStr);
  const startDate = `${yearStr}-${monthStr}-01`;
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const endDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const data = await queryWithRetry(c.env, async (sql) => {
    const bookings = (await sql`
      SELECT event_date::text AS event_date, status
      FROM bookings
      WHERE event_date >= ${startDate}::date
        AND event_date <= ${endDate}::date
        AND status IN ('pending', 'booked', 'in_progress')
    `) as Array<{ event_date: string; status: string }>;

    const blocks = (await sql`
      SELECT event_date::text AS event_date, reason
      FROM date_blocks
      WHERE event_date >= ${startDate}::date
        AND event_date <= ${endDate}::date
    `) as Array<{ event_date: string; reason: string | null }>;

    const counts = new Map<string, { pending: number; active: number; inProgress: number }>();
    for (const row of bookings) {
      const entry = counts.get(row.event_date) ?? { pending: 0, active: 0, inProgress: 0 };
      if (row.status === 'pending') entry.pending += 1;
      if (row.status === 'booked') entry.active += 1;
      if (row.status === 'in_progress') {
        entry.active += 1;
        entry.inProgress += 1;
      }
      counts.set(row.event_date, entry);
    }

    const blockMap = new Map<string, string | null>(blocks.map((b) => [b.event_date, b.reason]));
    const days: Array<{ date: string; status: DayAvailabilityStatus; count: number; reason?: string | null }> = [];

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
      if (blockMap.has(dateStr)) {
        days.push({ date: dateStr, status: 'closed', count: 0, reason: blockMap.get(dateStr) });
        continue;
      }
      const cEntry = counts.get(dateStr);
      if (!cEntry) {
        days.push({ date: dateStr, status: 'free', count: 0 });
      } else if (cEntry.inProgress > 0) {
        days.push({ date: dateStr, status: 'in_progress', count: cEntry.active + cEntry.pending });
      } else if (cEntry.active > 0) {
        days.push({ date: dateStr, status: 'busy', count: cEntry.active + cEntry.pending });
      } else {
        days.push({ date: dateStr, status: 'pending', count: cEntry.pending });
      }
    }

    return { month, days };
  });

  return c.json(data, 200, {
    'Cache-Control': 'public, max-age=30',
  });
});

publicRoutes.get('/packages', (c) => {
  return c.json(
    {
      packages: [
        { id: 'sound-1000w', name: 'Sound System 1000W (Acara Keluarga / Pengajian)', category: 'sound' },
        { id: 'sound-3000w', name: 'Sound System 2000W-3000W (Hajatan / Khitanan / Akad)', category: 'sound' },
        { id: 'sound-5000w', name: 'Sound System 5000W+ (Resepsi / Panggung Besar)', category: 'sound' },
        { id: 'lighting-stage', name: 'Lighting & Panggung Rigging', category: 'lighting' },
        { id: 'tenda-dekorasi', name: 'Tenda & Dekorasi Pelaminan', category: 'tenda' },
        { id: 'kursi-meja-alat-makan', name: 'Kursi, Meja & Alat Makan', category: 'jamuan' },
        { id: 'fotografer', name: 'Jasa Fotografer Acara', category: 'dokumentasi' },
        { id: 'paket-lengkap', name: 'Paket Lengkap (Custom sesuai kebutuhan)', category: 'custom' },
      ],
    },
    200,
    { 'Cache-Control': 'public, max-age=300' }
  );
});

/**
 * POST /v1/bookings
 * Public booking request submission (always stored as `pending`).
 * Rate-limited to 3/hour per IP, protected by honeypot field `website`.
 */
publicRoutes.post('/bookings', async (c) => {
  const ip = getClientIp(c.req.raw);
  const ipHash = await hashIp(ip);
  const rl = await checkRateLimit(c.env, `booking:${ipHash}`, 3, 3600);
  if (!rl.allowed) {
    return c.json(
      {
        type: 'about:blank',
        title: 'Terlalu Banyak Permintaan',
        status: 429,
        detail: 'Batas pengajuan booking tercapai. Silakan coba lagi nanti atau hubungi WhatsApp 0858-1668-6900.',
      },
      429,
      { 'Retry-After': String(rl.retryAfterSeconds) }
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ type: 'about:blank', title: 'Invalid JSON', status: 400, detail: 'Body harus berupa JSON valid' }, 400);
  }

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        type: 'about:blank',
        title: 'Validasi Gagal',
        status: 400,
        detail: parsed.error.issues.map((i) => i.message).join('; '),
      },
      400
    );
  }

  // Honeypot check: silently pretend success to confuse bots without writing DB
  if (parsed.data.website && parsed.data.website.trim().length > 0) {
    return c.json(
      {
        ok: true,
        status: 'pending',
        message: 'Permohonan booking diterima dan menunggu verifikasi admin.',
      },
      201
    );
  }

  const d = parsed.data;
  const created = await queryWithRetry(c.env, async (sql) => {
    const blocked = (await sql`
      SELECT reason FROM date_blocks WHERE event_date = ${d.event_date}::date
    `) as Array<{ reason: string | null }>;
    if (blocked.length > 0) {
      return { blocked: true as const, reason: blocked[0].reason };
    }

    const rows = (await sql`
      INSERT INTO bookings (
        event_date, setup_start, setup_end, package,
        customer_name, customer_phone, customer_address, notes,
        status, source
      )
      VALUES (
        ${d.event_date}::date,
        ${d.setup_start || null}::time,
        ${d.setup_end || null}::time,
        ${d.package},
        ${d.customer_name},
        ${d.customer_phone},
        ${d.customer_address},
        ${d.notes || null},
        'pending',
        'web'
      )
      RETURNING id, event_date::text AS event_date, package, customer_name, customer_phone, customer_address, notes, status, source, created_at::text AS created_at
    `) as Array<{
      id: string;
      event_date: string;
      package: string;
      customer_name: string;
      customer_phone: string;
      customer_address: string | null;
      notes: string | null;
      status: string;
      source: string;
      created_at: string;
    }>;
    return { blocked: false as const, row: rows[0] };
  });

  if (created.blocked) {
    return c.json(
      {
        type: 'about:blank',
        title: 'Tanggal Ditutup',
        status: 409,
        detail: `Tanggal ${d.event_date} sedang ditutup (${created.reason || 'Penuh / Perbaikan'}). Silakan pilih tanggal lain atau hubungi WhatsApp kami.`,
      },
      409
    );
  }

  const row = created.row;
  c.executionCtx.waitUntil(
    dispatchBookingWebhook(c.env, {
      event: 'booking.created',
      booking_id: row.id,
      event_date: row.event_date,
      package: row.package,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      customer_address: row.customer_address,
      notes: row.notes,
      status: row.status,
      source: row.source,
      created_at: row.created_at,
    })
  );

  return c.json(
    {
      ok: true,
      id: row.id,
      event_date: row.event_date,
      status: 'pending',
      message: 'Permohonan booking berhasil dikirim! Pemilik Sigma Music akan mengonfirmasi melalui WhatsApp.',
    },
    201
  );
});

/**
 * POST /v1/chat
 * RAG AI Chatbot endpoint (rate-limited 15 msg/min per IP).
 */
publicRoutes.post('/chat', async (c) => {
  const ip = getClientIp(c.req.raw);
  const ipHash = await hashIp(ip);
  const rl = await checkRateLimit(c.env, `chat:${ipHash}`, 15, 60);
  if (!rl.allowed) {
    return c.json(
      {
        type: 'about:blank',
        title: 'Batas Chat Tercapai',
        status: 429,
        detail: 'Terlalu banyak pesan dalam 1 menit. Tunggu sebentar atau hubungi WhatsApp 0858-1668-6900.',
      },
      429,
      { 'Retry-After': String(rl.retryAfterSeconds) }
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ type: 'about:blank', title: 'Invalid JSON', status: 400, detail: 'Body harus berupa JSON valid' }, 400);
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        type: 'about:blank',
        title: 'Validasi Gagal',
        status: 400,
        detail: parsed.error.issues.map((i) => i.message).join('; '),
      },
      400
    );
  }

  const sanitized = sanitizeChatInput(parsed.data.message);
  if (!sanitized.clean) {
    return c.json(
      { type: 'about:blank', title: 'Pesan Kosong', status: 400, detail: 'Pesan tidak boleh kosong' },
      400
    );
  }

  const result = await handleChatTurn(c.env, {
    sessionId: parsed.data.session_id,
    message: sanitized.clean,
    ipHash,
    flaggedInjection: sanitized.flaggedInjection,
  });

  return c.json(result);
});
