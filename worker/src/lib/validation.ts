import { z } from 'zod';

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

  // Indonesian mobile numbers: 628 followed by 7-12 digits (total 10-15 digits)
  if (!/^628\d{7,12}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

export const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
export const monthRegex = /^\d{4}-\d{2}$/;

export const createBookingSchema = z.object({
  event_date: z
    .string()
    .regex(dateRegex, 'Format tanggal harus YYYY-MM-DD')
    .refine((val) => !Number.isNaN(Date.parse(val)), 'Tanggal tidak valid'),
  package: z.string().trim().min(2, 'Pilih paket atau jenis acara').max(120),
  customer_name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
  customer_phone: z
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
    }),
  customer_address: z.string().trim().min(3, 'Alamat acara wajib diisi').max(250),
  notes: z.string().trim().max(500).optional().default(''),
  setup_start: z.string().trim().max(10).optional(),
  setup_end: z.string().trim().max(10).optional(),
  // Honeypot field: bots often fill hidden `website` field
  website: z.string().optional(),
});

export const updateBookingSchema = z.object({
  status: z.enum(['pending', 'booked', 'in_progress', 'completed', 'cancelled']).optional(),
  notes: z.string().trim().max(500).optional(),
  total_price: z.number().nonnegative().nullable().optional(),
  package: z.string().trim().min(2).max(120).optional(),
});

export const chatRequestSchema = z.object({
  session_id: z.string().uuid().optional(),
  message: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(1000, 'Pesan maksimal 1000 karakter'),
});

export const knowledgeUploadSchema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(140),
  content: z.string().trim().min(20, 'Isi dokumen minimal 20 karakter').max(200_000),
  mime: z.enum(['text/plain', 'text/markdown']).optional().default('text/markdown'),
});

export const dateBlockSchema = z.object({
  event_date: z.string().regex(dateRegex, 'Format tanggal harus YYYY-MM-DD'),
  reason: z.string().trim().max(200).optional().default('Tutup / Penuh Total'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
