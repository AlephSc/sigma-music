# Panduan Deployment & Setup (100% Free Tier)

Dokumen ini menjelaskan langkah deploy Sigma Music Platform v2 sesuai [PRD.md](file:///d:/Aleph/sigma-music/docs/PRD.md).

## 1. Database — Neon Postgres + `pgvector`
1. Buat project gratis di [Neon](https://neon.tech) (pilih region Singapore `ap-southeast-1`).
2. Jalankan migrasi SQL secara berurutan di Neon SQL Editor atau `psql`:
   - `db/migrations/0001_init.sql`
   - `db/seed.sql`
3. Salin `DATABASE_URL` (pooled connection string).

## 2. Backend API — Cloudflare Workers (`worker/`)
1. Masuk ke folder `worker/`:
   ```bash
   cd worker
   npm install
   ```
2. (Opsional) Buat KV namespace untuk rate-limiting persisten:
   ```bash
   npx wrangler kv namespace create RATE_LIMIT_KV
   ```
   Lalu masukkan ID-nya di `worker/wrangler.toml`.
3. Set secrets melalui `wrangler secret put`:
   - `DATABASE_URL`
   - `OPENROUTER_API_KEY` (dari OpenRouter.ai)
   - `GEMINI_API_KEY` (opsional, dari Google AI Studio untuk embedding 768-dim)
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET` (string acak minimal 32 karakter)
   - `SYNC_API_KEY` (opsional, untuk P2 home server backup)
   - `HOME_SERVER_WEBHOOK_URL` & `WEBHOOK_SECRET` (opsional, untuk P2 notifikasi bot WA/TG)
4. Deploy Worker:
   ```bash
   npx wrangler deploy
   ```

## 3. Frontend — Next.js (`web/`) di Vercel / Netlify
1. Import repository ke Vercel/Netlify dengan **Root Directory = `web`**.
2. Tambahkan Environment Variables:
   - `NEXT_PUBLIC_WORKER_URL` = URL Cloudflare Worker Anda (misal `https://sigma-music-worker.<subdomain>.workers.dev`)
   - `NEXT_PUBLIC_SITE_URL` = `https://sigmamusic.my.id`
   - `NEXT_PUBLIC_WA_NUMBER` = `6285816686900`
3. Deploy.

## 4. P2 Home Server (Opsional)
- **Notifikasi Bot WA/Telegram**: Jalankan bot lokal yang menerima HTTP POST `/webhook` dan ekspos aman via `cloudflared tunnel` tanpa IP publik, lalu set `HOME_SERVER_WEBHOOK_URL` di Worker.
- **Backup Cron Lokal**: Jalankan `scripts/sync-homeserver.mjs` via crontab harian di Home Server.
