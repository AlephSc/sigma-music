# Sigma Music v2 — Desain Arsitektur Lengkap

> Status: **F0 (scoping)** — desain untuk disetujui. PRD ditulis setelah desain ini di-approve.
> Tanggal: 2026-11-19 · Repo: `github.com/AlephSc/sigma-music` · Domain produksi: `sigmamusic.my.id`

## 1. Ringkasan

Upgrade landing page Sigma Music (static HTML, SEO sudah jalan) menjadi platform rental dengan:

1. **Jadwal booking publik** — kalender tanggal kosong / terisi / sedang dikerjakan.
2. **Panel admin** — kelola booking dengan alur status `pending → booked → in_progress → completed`.
3. **AI chatbot RAG** — menjawab dari dokumen yang kamu upload (harga, paket, FAQ) + akses jadwal live; boleh membuat **request booking (pending)** yang kamu approve, tidak boleh konfirmasi sendiri.

Batasan keras: **100% free tier, tanpa kartu kredit.** Vercel Hobby hanya frontend; seluruh backend di Cloudflare Workers; database Supabase; LLM Gemini free tier.

## 2. Keputusan final

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend | Next.js 16 App Router + TypeScript strict + Tailwind, Vercel Hobby (root dir `web/`) | Admin + chat + kalender butuh UI stateful; SEO via `generateMetadata`; desain Ultraviolet & konten lama di-port 1:1 |
| Backend | Cloudflare Workers + Hono + zod | Gratis 100rb req/hari, cron trigger gratis (heartbeat), edge dekat user |
| Database | Supabase Postgres region Singapore + pgvector + Storage + Auth | Satu paket gratis: DB, vector RAG, storage dokumen, auth admin (alternatif Neon: §6.5) |
| LLM chat | Gemini free tier — default `gemini-3.5-flash-lite`, fallback `gemini-3.8-flash` (stable, gratis per Nov 2026) | Kualitas + function calling bagus, gratis. **`gemini-2.5-flash` shutdown 1 Des 2026 — jangan dipakai** |
| Embedding | `gemini-embedding-2`, output 768 dimensi | Gratis, satu provider dengan LLM |
| Reranker | Workers AI `bge-reranker-base` (P1, opsional) | Gratis di dalam CF, menaikkan precision retrieval |
| Wewenang chatbot | Buat request `pending`; admin approve | Cegah double-book & salah paham |
| Booking publik | Tanpa akun; cukup nama + no. WA | Friksi minimal, sesuai perilaku customer rental |
| Admin | Single user (kamu), login email+password Supabase Auth | Cukup untuk satu operator |
| Bahasa / zona waktu | Indonesia informal / WIB (Asia/Jakarta) | Sesuai audiens |
| Kebijakan datacenter-IP | A (halaman publik/SEO) + B (chat & booking, observe-first) | Lindungi Googlebot; throttle endpoint abuse |

> **Asumsi (belum dikonfirmasi — tandai saat review):**
> - 1 event per hari (satu kru) → `settings.max_events_per_day = 1`, bisa diubah.
> - Harga hanya dari dokumen RAG yang kamu upload; belum ada dokumen → jawab "harga menyesuaikan, hubungi WA".
> - Domain `sigmamusic.my.id` sudah aktif dan akan diarahkan ke frontend baru.
> - Notifikasi booking baru: belum ada di MVP (cek panel admin).
> - Rental dihitung per tanggal acara (`event_date`), rentang jam setup opsional.

## 3. Diagram arsitektur

```
                 ┌────────────────────────────────────────────┐
 Pengunjung ───> │  Vercel Hobby (frontend saja)              │
 (Google/WA)     │  Next.js 16 · sigmamusic.my.id             │
                 │  / landing+SEO · /jadwal · /admin · widget │
                 └───────────────┬────────────────────────────┘
                                 │ HTTPS (CORS allowlist)
                                 ▼
                 ┌────────────────────────────────────────────┐
                 │  Cloudflare Worker (semua backend)         │
                 │  Hono + zod · /v1/*                        │
                 │  chat(SSE) · availability · bookings       │
                 │  admin CRUD · ingest RAG · cron heartbeat  │
                 └───┬──────────────┬──────────────┬──────────┘
                     │              │              │
        ┌────────────▼───┐   ┌──────▼───────┐   ┌──▼──────────────┐
        │ Supabase       │   │ Gemini API   │   │ Workers AI      │
        │ Postgres+RLS   │   │ flash-lite   │   │ reranker (P1)   │
        │ pgvector       │   │ embedding    │   │ fallback LLM(P1)│
        │ Storage (docs) │   │ free tier    │   └─────────────────┘
        │ Auth (admin)   │   └──────────────┘
        └────────────────┘
```

Tidak ada API route di Next.js — semua mutasi dan data lewat Worker. Vercel murni menyajikan UI.

## 4. Frontend — Vercel (`web/`)

| Route | Isi | Render |
|---|---|---|
| `/` | Landing port 1:1 dari `index.html` sekarang (hero, layanan, area, kontak, FAQ) + widget chat | RSC statis |
| `/jadwal` | Kalender bulan: kosong / terisi / sedang dikerjakan; klik tanggal kosong → form booking (nama, WA, paket, catatan) | RSC + client calendar |
| `/admin` | Login → dashboard: tabel booking + transisi status, upload dokumen RAG, log chat, settings | Client (dilindungi JWT) |
| global | Widget chat mengambang (bottom sheet di mobile) | Client |

Aturan main:
- RSC default; `"use client"` hanya untuk widget chat, kalender, dan admin (file terpisah — jangan definisikan handler di Server Component).
- **SEO:** `generateMetadata` per route (title, description, OG, twitter, canonical `https://sigmamusic.my.id/`), JSON-LD `LocalBusiness` + `FAQPage` di-port dari `index.html`, `sitemap.ts`, `robots.ts`, `next/image` + WebP (hero sudah ada), semantik `main/nav/article`.
- **Desain:** token Ultraviolet yang sekarang dipindah ke `:root` (OKLCH), font Outfit + Onest tetap; tanpa hex literal di komponen.
- **Chat widget:** fetch SSE ke `POST /v1/chat`; 8 state (hover/focus/active/disabled/loading/empty/error/content); sitasi dokumen tampil sebagai label sumber; tombol eskalasi "chat WA manusia"; batas 20 turn/sesi.
- **Kalender:** fetch `GET /v1/availability?month=YYYY-MM`; refetch setelah booking dibuat; warna status + legend + aria-label per sel.
- **Admin:** `supabase-js` signIn → JWT dikirim sebagai Bearer ke Worker; Worker yang memverifikasi, bukan frontend.
- `NEXT_PUBLIC_*` hanya: URL Worker, Supabase URL + anon key (memang publik). **Tidak ada secret di frontend.**

## 5. Backend — Cloudflare Worker (`worker/`)

Hono router, validasi zod di setiap boundary, error RFC 7807, prefix `/v1`.

| Endpoint | Method | Auth | Fungsi |
|---|---|---|---|
| `/v1/availability?month=` | GET | publik | Status per tanggal bulan itu, **tanpa PII** |
| `/v1/packages` | GET | publik | Daftar paket (dari settings/knowledge), cache 5 menit |
| `/v1/chat` | POST | publik + rate-limit | Chat SSE; body `{session_id?, message}` |
| `/v1/bookings` | POST | publik + rate-limit + honeypot | Buat request `pending` (nama, WA, tanggal, paket, catatan) |
| `/v1/admin/bookings` | GET | JWT admin | List + filter status/bulan |
| `/v1/admin/bookings/:id` | PATCH | JWT admin | Transisi status & edit field (re-check konflik saat approve) |
| `/v1/admin/knowledge` | GET/POST/DELETE | JWT admin | List/upload/hapus dokumen; upload memicu ingest |
| `/v1/admin/chats` | GET | JWT admin | Log sesi & pesan (audit sitasi) |
| `/v1/admin/settings` | GET/PUT | JWT admin | Jam operasional, WA, max event/hari, teks refusal |
| cron (daily) | scheduled | internal | Heartbeat Supabase + purge chat > 30 hari |

Pipeline chat per request:

```
sanitize L1 → muat sesi (6 turn terakhir) → embed query
→ hybrid retrieve (RRF) → [rerank P1] → confidence gate
→ Gemini + tools (check_availability, create_booking_request)
→ grounding + sitasi → stream SSE
```

- Tool `create_booking_request` **hanya menulis `pending`**; server validasi ulang tanggal & nomor WA; output tool tidak pernah memuat PII customer lain.
- Budget CPU Workers free 10ms/request: retrieval & LLM itu I/O (tidak makan CPU); parsing PDF berat hanya saat ingest (jarang, admin) — pakai parser ringan + `ctx.waitUntil`, batas file 2MB.
- Rate-limit app: sliding window per IP via Workers KV (chat 10/menit, booking 3/jam) — lapis kedua di belakang edge rule CF.

## 6. Database — Supabase

### 6.1 Kenapa Supabase
pgvector (RAG) + Storage (dokumen asli) + Auth (admin) satu paket gratis; 500MB lebih dari cukup. **Free pause setelah 1 minggu idle** → diatasi cron Worker harian (`SELECT 1`). Region Singapore = dekat user Indonesia & latency rendah dari Workers.

### 6.2 Skema (migration `db/migrations/0001_init.sql`)

```sql
create extension if not exists vector;

create type booking_status as enum
  ('pending','booked','in_progress','completed','cancelled');

create table bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_date date not null,
  setup_start time, setup_end time,          -- opsional
  package text,
  items jsonb not null default '[]',
  customer_name text not null,
  customer_phone text not null,              -- format 62xxx
  customer_address text,
  notes text,
  status booking_status not null default 'pending',
  source text not null default 'web',        -- web | chat | admin
  total_price numeric                        -- diisi admin, bukan AI
);
create index on bookings (event_date);
create index on bookings (status);
-- Guard double-book (max 1 event/hari): hanya status aktif yang dihitung
create unique index bookings_active_date on bookings (event_date)
  where status in ('booked','in_progress');

create table knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  storage_path text not null,
  mime text, status text not null default 'processing',
  content_hash text, created_at timestamptz default now()
);

create table rag_chunks (
  id bigserial primary key,
  document_id uuid not null references knowledge_docs(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  tsv tsvector generated always as (to_tsvector('simple', content)) stored,
  embedding vector(768),
  section text, content_hash text, updated_at timestamptz default now(),
  unique (document_id, chunk_index)
);
create index on rag_chunks using hnsw (embedding vector_cosine_ops);
create index on rag_chunks using gin (tsv);

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  last_active timestamptz default now(),
  turn_count int not null default 0,
  ip_hash text                               -- bukan IP mentah
);
create table chat_messages (
  id bigserial primary key,
  session_id uuid references chat_sessions(id) on delete cascade,
  role text not null,                        -- user | assistant | tool
  content text not null,
  chunk_ids bigint[],                        -- audit trail sitasi
  created_at timestamptz default now()
);

create table settings (key text primary key, value jsonb not null);
-- seed: wa_number, business_hours, max_events_per_day=1, refusal_text, area_served
```

### 6.3 Ketersediaan & anti double-book
- "Belum di-booking" = tanggal tanpa booking aktif; bukan status tersendiri.
- `pending` **tidak memblokir** tanggal (boleh banyak request di tanggal sama; admin yang memilih).
- Approve (`pending → booked`) dilakukan dalam transaksi: re-check konflik → unique index menolak → HTTP 409 dengan pesan jelas.
- Endpoint publik hanya mengembalikan `{date, status: 'free'|'busy'|'in_progress'}` — nama/telepon customer tidak pernah keluar.

### 6.4 RLS & akses
- Anon key **tidak** diberi akses tabel langsung; satu-satunya baca publik: fungsi `get_month_availability(month)` (security definer, output tanpa PII).
- Semua tulis & baca admin lewat Worker dengan `service_role` key, **setelah** JWT admin diverifikasi di Worker. RLS tetap aktif sebagai defense-in-depth.

### 6.5 Alternatif Neon (bila kamu lebih suka)
Neon + pgvector juga bisa dan tidak pause (compute suspend, cold start ~1-2 detik), tapi auth admin harus bikin sendiri (JWT + bcrypt) dan storage dokumen pindah ke UploadThing → lebih banyak kerjaan. Supabase tetap default; lapisan DB di-abstraksi supaya swap mungkin.

## 7. AI & RAG (wajib, konteks terbatas)

### 7.1 Model & kuota
- Default `gemini-3.5-flash-lite`; fallback `gemini-3.8-flash`; model di-set via env (mudah ganti). **Jangan pakai `gemini-2.5-*` — shutdown 1 Des 2026.**
- Rate limit free tier (RPM/TPM/RPD) tidak dipublikasikan → cek di AI Studio saat setup; kuota reset midnight Pacific.
- Proteksi: rate-limit per IP + cap turn sesi (20) + cap panjang pesan (1000 char). Kuota habis → pesan sopan + link WA (P1: fallback Workers AI).

### 7.2 Ingest (admin upload → index)
`parse → chunk → embed → index`:
- Parse layout-aware (PDF: tabel & heading utuh); txt/md langsung.
- Chunk structure-aware 256–512 token, overlap 10–20% hanya saat hard-cut, prepend judul+heading, buang chunk < 40 char.
- `embedMany` batch; upsert dengan `content_hash` (skip bila tidak berubah); file asli masuk Supabase Storage.

### 7.3 Retrieve
- Hybrid: keyword `tsvector('simple')` + dense `embedding <=> query`, fuse **RRF k=60**, over-fetch 30 → ambil **top 5–8**.
- Session-aware: embed 6 turn terakhir + pesan terbaru; keyword hanya pesan terbaru.
- Confidence gate (min-score): konteks tidak mendukung → **refusal tetap**, bukan mengarang.

### 7.4 Grounding & sitasi
- System prompt: jawab HANYA dari konteks berlabel + hasil tool; sitasi `[1]` per klaim (label = judul dokumen); di luar itu → kalimat refusal tetap + arahkan WA.
- Harga/paket tidak boleh dari memori model — hanya dokumen RAG.
- Retrieved content & input user = **DATA**, dibungkus `<user_request>…</user_request>` (context firewall); system prompt terpisah (Gemini `systemInstruction`).

### 7.5 Tools (function calling)
| Tool | Input | Output | Efek |
|---|---|---|---|
| `check_availability` | date_from, date_to | `[{date, status}]` tanpa PII | read-only |
| `create_booking_request` | date, name, phone, package, notes | id pending + konfirmasi + link WA | tulis `pending` saja |

LLM tidak pernah bisa set `booked`/`in_progress` — transisi itu hanya admin.

### 7.6 Keamanan AI
- Sanitasi L1: NFKC, buang zero-width, netralkan token chat-template (`<|im_start|>`, `[INST]`, dll), truncasi 1000 char.
- Injection: detect-and-log (jangan block heuristik saja); **output validation = gate sebenarnya** (zod envelope, buang yang invalid).
- PII guard: output tool & jawaban tidak boleh memuat nama/nomor customer lain; system prompt tidak boleh bocor.
- Unit test sanitizer = regression gate.

### 7.7 Evaluasi (gate rilis)
Golden set ≥ 30 Q&A: answerable, **unanswerable (≥10)**, dan kasus injection. Ukur recall@k retrieval terpisah dari faithfulness generation; refusal path harus lolos sebelum ship.

## 8. Alur booking & status

```
pending ──approve──> booked ──hari-H──> in_progress ──selesai──> completed
   │                    │
   └──tolak──> cancelled└──batal──> cancelled
```

1. Pengunjung tanya chat: "20 Desember masih kosong?" → tool `check_availability` → jawab.
2. Pengunjung kasih nama + WA + paket → `create_booking_request` → masuk `pending`.
3. Kamu approve di `/admin` (transaksi re-check konflik; 409 bila sudah terisi) → `booked`.
4. Konfirmasi ke customer via WA (link pre-filled dari panel; otomatis penuh = P1).
5. Hari-H: set `in_progress`; selesai: `completed`.
6. Kalender publik & chatbot selalu baca status terbaru dari DB yang sama.

## 9. Keamanan (app + edge)

**App (Worker + Next):**
- zod di setiap trust boundary; mutasi & otorisasi hanya server-side.
- Admin: verifikasi JWT Supabase (HS256, `SUPABASE_JWT_SECRET`) + cek email admin di Worker; IDOR → 403/404.
- CORS allowlist: `https://sigmamusic.my.id` + `http://localhost:3000` (dev); tolak Origin asing untuk mutasi.
- CSP via `next.config` headers (tanpa `unsafe-inline`); cookie sesi admin httpOnly+Secure+SameSite bila dipakai.
- Rate-limit app (KV sliding window): chat 10/menit/IP, booking 3/jam/IP; honeypot + waktu isi minimum di form booking.
- Secrets hanya di `wrangler secret` / env Vercel server-side; `secrets-scan` sebelum commit; tidak ada key di repo/history.
- Log chat disimpan 30 hari (cron purge), IP di-hash; endpoint publik nol PII.

**Edge (Cloudflare Free plan):**
- Managed Ruleset OWASP aktif (default action).
- Rate-limit free = **1 rule (IP, periode 10s)** → pakai untuk `POST /v1/chat` + `/v1/bookings` (threshold ±8/10s, Managed Challenge, 429 + Retry-After).
- Datacenter-IP: **A** untuk halaman publik (SEO — Googlebot/ChatGPT tidak boleh ke-block); **B** untuk chat/booking: LOG ASN cloud ~1 minggu → baru Managed Challenge (bukan Block).
- Allowlist verified bot sebelum aturan block apa pun; jangan allowlist by User-Agent (spoofable).
- Smoke test F3b: good bot 200, mutasi tanpa Origin ditolak, burst → 429 + Retry-After.

## 10. Batas free tier & mitigasi

| Komponen | Batas gratis | Mitigasi |
|---|---|---|
| Vercel Hobby | 100GB bandwidth/bulan, frontend saja | Situs ringan + `next/image`; semua API di Worker |
| CF Workers | 100rb req/hari, 10ms CPU/req, cron gratis | Retrieval = I/O; ingest berat via `waitUntil`; cache availability |
| Supabase | 500MB DB, 1GB storage, 5GB egress, **pause 1 minggu idle** | Cron heartbeat harian; dokumen ≤2MB; purge chat 30 hari |
| Gemini free | RPM/TPM/RPD per project (cek AI Studio), reset midnight Pacific | Cap per IP + cap sesi; refusal sopan + WA saat kuota habis; model via env |
| GitHub | repo & Actions menit gratis | CI ringan: tsc + lint + build |

Semua tanpa kartu kredit. Bila traffic tumbuh melewati batas, upgrade path jelas (Supabase Pro / Gemini Tier 1) tanpa perubahan arsitektur.

## 11. Struktur repo & deployment

```
sigma-music/
├─ web/                  # Next.js 16 (Vercel root directory = web/)
│  ├─ src/app/           # /, /jadwal, /admin, sitemap.ts, robots.ts
│  ├─ src/components/    # chat-widget, calendar, admin (client files)
│  └─ src/lib/           # api client, supabase browser client, tokens
├─ worker/               # CF Worker: Hono + wrangler.toml
│  └─ src/               # routes/, rag/, tools/, middleware/, cron
├─ db/migrations/        # SQL Supabase (supabase db push)
├─ docs/                 # ARSITEKTUR.md, PRD.md (nanti), openapi.yaml
└─ .github/workflows/    # CI: tsc + lint + build (opsional)
```

Env:
- `web/.env.local`: `NEXT_PUBLIC_WORKER_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publik by design).
- Worker secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `GEMINI_API_KEY`, `ADMIN_EMAIL`, `GEMINI_MODEL`, `GEMINI_EMBED_MODEL`.

Urutan deploy: **DB (migration + seed admin/settings) → Worker (`wrangler deploy`) → Web (import repo di Vercel, root dir `web/`, domain `sigmamusic.my.id`)**. Situs static lama tetap live sampai versi baru lolos quality gate — tidak ada downtime.

## 12. Roadmap

| Milestone | Isi | Gate |
|---|---|---|
| **M1 Fondasi** | Scaffold Next + port desain/SEO/konten, skema DB, auth admin, API availability, halaman `/jadwal` | `tsc`+build green; kalender live baca DB |
| **M2 Booking ops** | Admin CRUD + transisi status, form booking publik, WA handoff, anti double-book | Alur pending→completed teruji via curl + UI; konflik → 409 |
| **M3 Chatbot RAG** | Ingest + hybrid retrieve + grounding + tool read-only + golden set eval | Recall@k & faithfulness lolos; refusal & injection teruji |
| **M4 Chat booking + hardening** | `create_booking_request` + approval, keamanan F3/F3b, quality gate F4, deploy | Lighthouse Perf>90 / A11y>95 / SEO>90; audit OWASP API+web tanpa High/Critical; secrets-scan bersih; render + click-through terverifikasi |

PRD lengkap (11 bagian, fitur P0/P1/P2 + acceptance criteria) ditulis setelah desain ini disetujui.

## 13. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Model Gemini berubah/shutdown (2.5 sudah dijadwalkan 1 Des 2026) | Chat mati | Model via env + fallback model lain + fallback Workers AI (P1) |
| Supabase pause karena idle | Jadwal/chat error | Cron heartbeat harian + health check |
| Double-booking | Dua customer tanggal sama | Unique index partial + transaksi approve + 409 |
| Prompt injection via chat/dokumen | AI membocorkan data / ngawur | Context firewall + output validation + PII guard + eval |
| Kuota Gemini habis di jam ramai | Chat tidak jawab | Cap per IP + pesan WA fallback yang sopan |
| Parse PDF berat di Workers | CPU limit terlampaui | Batas 2MB, parser ringan, `waitUntil`, txt/md disarankan |
| Free tier terlampaui overall | Layanan turun | Monitoring sederhana + graceful degradation (chat → WA) |

## 14. Pertanyaan terbuka (jawab sebelum PRD)

1. **Dokumen RAG awal** — kirim file harga/paket/FAQ/syarat sewa (txt/md/pdf). Tanpa ini chatbot hanya bisa cek jadwal.
2. **Kapasitas harian** — benar 1 event/hari, atau bisa lebih (mis. 2 kru)?
3. **Jam setup** — perlu rentang jam, atau cukup tanggal acara seharian?
4. **Email admin** — email mana yang dipakai untuk login Supabase Auth?
5. **Rebuild Next.js** — setuju landing lama di-port 1:1 ke Next.js (desain & SEO tetap), atau mau tetap static HTML + widget tempel?