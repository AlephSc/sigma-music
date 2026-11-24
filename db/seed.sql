-- Sigma Music Platform v2 — Initial Seed Data

INSERT INTO settings (key, value) VALUES
  ('wa_number', '"6285816686900"'::jsonb),
  ('business_hours', '"Senin - Minggu, 08:00 - 21:00 WIB"'::jsonb),
  ('max_events_per_day', '2'::jsonb),
  ('area_served', '["Jombang Kota", "Kabupaten Jombang", "Mojokerto", "Kediri", "Nganjuk", "Surabaya"]'::jsonb),
  ('refusal_text', '"Maaf, informasi tersebut belum tersedia di panduan resmi kami. Silakan hubungi admin Sigma Music langsung melalui WhatsApp di 0858-1668-6900 untuk konsultasi lebih lanjut."'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO knowledge_docs (id, title, content, mime, status, content_hash)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Katalog Paket & Layanan Resmi Sigma Music Jombang',
  E'# Katalog Paket & Layanan Sigma Music Jombang\n\n'
  '## 1. Paket Sound System (1000W - 5000W)\n'
  '- **Sound System 1000W (Acara Keluarga / Pengajian / Rapat)**: Cocok untuk 50-100 tamu di dalam ruangan atau teras rumah. Termasuk 2 speaker aktif, mixer 8 channel, 2 mikrofon wireless, dan kru operator standby.\n'
  '- **Sound System 2000W - 3000W (Hajatan / Khitanan / Akad Nikah)**: Cocok untuk 150-300 tamu. Termasuk subwoofer, speaker mid-high, mixer digital, 4 mikrofon, kabel lengkap, dan tim teknisi pasang hingga selesai acara.\n'
  '- **Sound System 5000W+ (Resepsi Besar / Panggung / Event Kampus & Instansi)**: Cocok untuk 500+ tamu atau area terbuka. Dilengkapi line array / multi-subwoofer, monitor panggung, mixer digital, dan kru teknis penuh.\n\n'
  '## 2. Paket Tenda, Panggung, Lighting & Dekorasi\n'
  '- **Tenda Pernikahan & Khitanan**: Tersedia tenda plafon, tenda dekorasi serut/balon, ukuran fleksibel menyesuaikan lokasi.\n'
  '- **Panggung & Lighting**: Panggung rigging/portable, lampu par LED, moving head/sorot panggung untuk acara malam.\n'
  '- **Kursi, Meja & Alat Makan**: Kursi plastik/lipat dengan cover, meja prasmanan, piring, sendok, mangkok, dan pemanas makanan.\n'
  '- **Fotografer Acara**: Dokumentasi foto untuk pernikahan, khitanan, acara keluarga, hingga kegiatan kampus/instansi.\n\n'
  '## 3. Layanan Tambahan (Service & Las)\n'
  '- Sigma Music juga melayani jasa perbaikan/service peralatan elektronik rumah tangga (seperti mesin cuci) dan pekerjaan las ringan di area Jombang.\n\n'
  '## 4. Area Layanan & Lokasi Pangkalan\n'
  '- Pangkalan: Jl. KH. Rifai Romly RT.30/RW.04, Wonokerto Selatan, Peterongan, Kec. Peterongan, Kabupaten Jombang, Jawa Timur 61481.\n'
  '- Area layanan utama: Seluruh Jombang kota dan kabupaten (Peterongan, Jombang, Mojoagung, Diwek, Ploso, Perak, Mojowarno, dll).\n'
  '- Luar kota: Mojokerto, Kediri, Nganjuk, dan Surabaya (khusus acara skala menengah/besar).\n\n'
  '## 5. Ketentuan Booking, DP & Pelunasan\n'
  '- Pengajuan jadwal melalui website atau chatbot berstatus PENDING dan akan diverifikasi oleh admin melalui WhatsApp 0858-1668-6900.\n'
  '- Jadwal resmi terkunci (BOOKED) setelah konfirmasi kesediaan alat/kru dengan admin dan pembayaran uang muka (DP) sesuai kesepakatan.\n'
  '- Harga pasti menyesuaikan paket, jarak lokasi, durasi, dan kebutuhan tambahan (seperti genset bila listrik lokasi tidak mencukupi).',
  'text/markdown',
  'indexed',
  'seed-v1'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rag_chunks (document_id, chunk_index, content, section, content_hash)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    0,
    'Paket Sound System Sigma Music Jombang: 1000W (50-100 tamu, acara keluarga/pengajian/rapat, 2 speaker aktif, mixer, 2 mic wireless, operator). 2000W-3000W (150-300 tamu, hajatan/khitanan/akad nikah, subwoofer, speaker mid-high, mixer digital, 4 mic). 5000W+ (500+ tamu/outdoor, resepsi besar/panggung/event kampus, line array, monitor panggung, kru teknis penuh).',
    'Paket Sound System',
    'seed-chunk-0'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    1,
    'Paket Tenda, Panggung, Lighting, Dekorasi, Alat Makan & Fotografer: Tenda pernikahan/khitanan (plafon/dekorasi serut), panggung rigging/portable, lampu par LED & sorot panggung, kursi dengan cover, meja prasmanan, piring/sendok/pemanas makanan, serta jasa fotografer dokumentasi acara.',
    'Tenda & Perlengkapan Pesta',
    'seed-chunk-1'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    2,
    'Lokasi & Area Layanan Sigma Music: Pangkalan di Jl. KH. Rifai Romly RT.30/RW.04, Wonokerto Selatan, Peterongan, Kec. Peterongan, Kabupaten Jombang, Jawa Timur 61481. Melayani seluruh Jombang kota & kabupaten, serta Mojokerto, Kediri, Nganjuk, dan Surabaya untuk acara besar. Tersedia juga jasa service mesin cuci dan las di Jombang.',
    'Area Layanan & Jasa Tambahan',
    'seed-chunk-2'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    3,
    'Ketentuan Booking & Harga Sigma Music: Pengajuan di website/AI berstatus PENDING dan tidak langsung mengunci tanggal. Admin akan menghubungi via WhatsApp 0858-1668-6900 untuk konfirmasi detail, harga pasti (menyesuaikan paket, jarak, durasi, dan kebutuhan genset), serta pembayaran DP secara manual sebelum status diubah menjadi BOOKED.',
    'Ketentuan Booking & DP',
    'seed-chunk-3'
  )
ON CONFLICT (document_id, chunk_index) DO NOTHING;
