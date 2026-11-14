# Sigma Music Jombang

Landing page satu halaman untuk **Sigma Music** — jasa persewaan sound system, lighting, panggung, tenda, dekorasi, kursi, meja, alat makan, dan fotografer di Jombang, Jawa Timur.

## Kontak

- WhatsApp: [0858-1668-6900](https://wa.me/6285816686900)
- Lokasi: Pondok Pesantren Darul Ulum, Peterongan, Jombang
- Area layanan: Jombang, Mojokerto, Kediri, Nganjuk, Surabaya

## Teknologi

- HTML + CSS murni, tanpa framework, tanpa JavaScript build
- Tema visual: Ultraviolet (Hallmark skill)
- Font: Outfit + Onest via Google Fonts
- Foto: Wikimedia Commons (credit di footer)

## SEO

- Meta title, description, keywords, canonical
- Open Graph + Twitter Card (preview saat link dibagikan)
- JSON-LD `LocalBusiness` + `FAQPage`
- Meta geo (Jombang), robots `max-image-preview:large`

## Struktur

```
index.html   — halaman lengkap (konten + meta + JSON-LD)
styles.css   — style halaman
tokens.css   — design tokens (warna, spacing, type scale)
base.css     — style dasar Hallmark
```

## Deploy

Statis — bisa di-deploy ke hosting mana saja (Vercel, Netlify, GitHub Pages) tanpa build step. Upload folder ini apa adanya.

## Customisasi

- Foto: ganti URL di `window.hallmarkSlots` (bawah `index.html`) dan `og:image` dengan foto asli alat
- No. WA: cari-ganti `6285816686900`
- Domain: sesuaikan `canonical` dan `og:url` setelah pakai domain sendiri
