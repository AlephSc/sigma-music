# Sigma Music WhatsApp Bot (Home Server)

Bot WhatsApp ringan berbasis `@whiskeysockets/baileys` (tanpa headless browser) yang dirancang khusus untuk **meminimalkan risiko suspend akun WhatsApp tidak resmi**.

## Prinsip Anti-Suspend yang Diterapkan
1. **Mode Notifikasi Owner-Only Secara Default (`ENABLE_PUBLIC_AI_REPLY=false`):**
   - Saat ada booking baru dari website, Worker mengirim webhook ke bot, lalu bot **hanya mengirim notifikasi ke nomor Owner (`OWNER_WA_NUMBER`)**.
   - Bot **tidak pernah** mengirim pesan otomatis ke nomor pelanggan baru yang belum pernah chat (penyebab utama akun WhatsApp terblokir).
2. **Simulasi Perilaku Manusia:**
   - Jeda baca natural, status `composing` proporsional terhadap panjang balasan, dan antrean keluar berurutan (`OutboundQueue`) dengan jeda acak 2.2–5 detik.
   - `markOnlineOnConnect: false` agar tidak merebut status online dari HP utama Anda.
3. **Filter Spam & Reconnect Aman:**
   - Mengabaikan grup, `status@broadcast`, pesan duplikat, dan pesan lama saat sinkronisasi ulang.
   - Cooldown per pengguna (5 detik) dan backoff eksponensial saat koneksi terputus.

## Cara Menjalankan di Home Server
1. Masuk ke folder `bot/` dan salin konfigurasi:
   ```bash
   cd bot
   npm install
   cp .env.example .env
   ```
2. Isi `.env` (`OWNER_WA_NUMBER`, `WEBHOOK_SECRET`, dll).
3. Jalankan bot & scan QR dari menu **Perangkat Tertaut** di WhatsApp HP Anda (disarankan memakai nomor khusus bisnis yang sudah aktif/hangat, bukan nomor baru langsung kirim banyak pesan):
   ```bash
   npm start
   ```
4. (Opsional) Ekspos `http://localhost:3099` menggunakan **Cloudflare Tunnel** (`cloudflared tunnel`) tanpa IP publik, lalu set `HOME_SERVER_WEBHOOK_URL=https://<tunnel-domain>/webhook/booking` dan `WEBHOOK_SECRET` di Cloudflare Worker (`worker/`).
