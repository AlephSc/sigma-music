import { z } from 'zod';

const BIDI_AND_CONTROL = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Strips invisible bidi overrides (e.g. U+202E RLO) and control characters (F-23).
 */
export function cleanDisplayText(raw: string): string {
  return raw.normalize('NFKC').replace(BIDI_AND_CONTROL, '').trim();
}

/**
 * Normalizes Indonesian phone numbers to `628...` format.
 * Accepts `08...`, `+628...`, `628...`, or `8...` with spaces/dashes.
 * Returns null if invalid.
 */
export function normalizeIndonesianPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  let normalized = digits;

  if (normalized.startsWith('+62')) {
    normalized = normalized.slice(1);
  } else if (normalized.startsWith('0')) {
    normalized = '62' + normalized.slice(1);
  } else if (normalized.startsWith('8')) {
    normalized = '62' + normalized;
  }

  if (!/^628\d{7,12}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
export const monthRegex = /^\d{4}-\d{2}$/;
export const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
export const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Semantically validates YYYY-MM-DD against the Gregorian calendar (F-07).
 * Rejects impossible dates like 2026-02-30, 2026-13-01, 0000-01-01.
 */
export function isValidCalendarDate(val: string): boolean {
  if (!dateRegex.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === val;
}

/**
 * Semantically validates YYYY-MM (F-06).
 * Rejects 2026-00, 2026-13, 0000-01, etc.
 */
export function isValidMonth(val: string): boolean {
  if (!monthRegex.test(val)) return false;
  const [y, m] = val.split('-').map(Number);
  return y >= 2000 && y <= 2100 && m >= 1 && m <= 12;
}

const cleanString = (min: number, max: number, minMsg?: string) =>
  z
    .string()
    .transform(cleanDisplayText)
    .pipe(
      z
        .string()
        .min(min, minMsg)
        .max(max)
    );

const phoneField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const normalized = normalizeIndonesianPhone(v);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nomor WhatsApp harus format Indonesia yang valid (contoh: 085816686900 atau 6285816686900)',
      });
      return z.NEVER;
    }
    return normalized;
  });

const calendarDateField = z
  .string()
  .regex(dateRegex, 'Format tanggal harus YYYY-MM-DD')
  .refine(isValidCalendarDate, 'Tanggal tidak ada di kalender (tahun 2000-2100)');

export const createBookingSchema = z
  .object({
    event_date: calendarDateField,
    package: cleanString(2, 120, 'Pilih paket atau jenis acara'),
    customer_name: cleanString(2, 100, 'Nama minimal 2 karakter'),
    customer_phone: phoneField,
    customer_address: cleanString(3, 250, 'Alamat acara wajib diisi'),
    notes: z
      .string()
      .optional()
      .default('')
      .transform(cleanDisplayText)
      .pipe(z.string().max(500)),
    setup_start: z.string().regex(timeRegex, 'Format jam harus HH:MM').optional(),
    setup_end: z.string().regex(timeRegex, 'Format jam harus HH:MM').optional(),
    website: z.string().optional(),
  })
  .strict();

/**
 * Admin PATCH schema — supports editing all operational fields (F-01, F-17).
 * Uses `.strict()` so unsupported/typo fields return 400 instead of being silently ignored.
 */
export const updateBookingSchema = z
  .object({
    event_date: calendarDateField.optional(),
    package: cleanString(2, 120, 'Paket minimal 2 karakter').optional(),
    customer_name: cleanString(2, 100, 'Nama minimal 2 karakter').optional(),
    customer_phone: phoneField.optional(),
    customer_address: cleanString(3, 250, 'Alamat minimal 3 karakter').nullable().optional(),
    notes: z
      .string()
      .transform(cleanDisplayText)
      .pipe(z.string().max(500))
      .nullable()
      .optional(),
    status: z.enum(['pending', 'booked', 'in_progress', 'completed', 'cancelled']).optional(),
    total_price: z.number().nonnegative().max(1_000_000_000, 'Harga melebihi batas wajar').nullable().optional(),
    setup_start: z.string().regex(timeRegex, 'Format jam harus HH:MM').nullable().optional(),
    setup_end: z.string().regex(timeRegex, 'Format jam harus HH:MM').nullable().optional(),
  })
  .strict();

export const chatRequestSchema = z.object({
  session_id: z.string().uuid().optional(),
  message: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(1000, 'Pesan maksimal 1000 karakter'),
});

export const knowledgeUploadSchema = z.object({
  title: cleanString(3, 140, 'Judul minimal 3 karakter'),
  content: z
    .string()
    .trim()
    .min(20, 'Isi dokumen minimal 20 karakter')
    .max(20_000, 'Isi dokumen maksimal 20.000 karakter'),
  mime: z.enum(['text/plain', 'text/markdown']).optional().default('text/markdown'),
});

export const dateBlockSchema = z.object({
  event_date: calendarDateField,
  reason: z
    .string()
    .optional()
    .default('Tutup / Penuh Total')
    .transform(cleanDisplayText)
    .pipe(z.string().max(200)),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
