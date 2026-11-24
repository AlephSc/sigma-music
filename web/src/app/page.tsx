import {
  Activity,
  ArrowRight,
  Calendar,
  Home,
  Layers,
  Lightbulb,
  Map as MapIcon,
  MapPin,
  Phone,
  Star,
  Utensils,
  Video,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { OpenChatButton } from '@/components/OpenChatButton';
import { PackageTabsSection } from '@/components/PackageTabsSection';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { WA_DISPLAY, WA_NUMBER } from '@/lib/api';

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Sigma Music',
  description:
    'Jasa rental sound system, lighting, panggung, tenda, dekorasi, kursi, meja, alat makan, genset silent, dan fotografer untuk acara di Jombang dan sekitarnya',
  telephone: '+6285816686900',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Jl. KH. Rifai Romly RT.30/RW.04, Wonokerto Selatan',
    addressLocality: 'Peterongan, Jombang',
    addressRegion: 'Jawa Timur',
    postalCode: '61481',
    addressCountry: 'ID',
  },
  areaServed: ['Jombang', 'Mojokerto', 'Kediri', 'Surabaya', 'Nganjuk'],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Layanan persewaan Sigma Music',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Sewa sound system Jombang' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Sewa lighting dan panggung' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Sewa tenda dan dekorasi' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Sewa kursi, meja, dan alat makan' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Jasa fotografer & live streaming' } },
    ],
  },
  sameAs: ['https://sigmamusic.my.id/'],
  priceRange: '$$',
  openingHours: 'Mo-Su 08:00-21:00',
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Apakah bisa sewa sound system saja tanpa paket?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Bisa. Sound system, lighting, tenda, panggung, dekorasi, kursi, meja, alat makan, dan fotografer bisa disewa satuan atau paket sesuai kebutuhan acara.',
      },
    },
    {
      '@type': 'Question',
      name: 'Di area mana Sigma Music melayani?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Seluruh Jombang (kota dan kabupaten) serta sekitarnya seperti Mojokerto, Kediri, Nganjuk, dan Surabaya untuk acara besar.',
      },
    },
    {
      '@type': 'Question',
      name: 'Bagaimana cara booking?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Cek tanggal kosong di halaman Jadwal atau hubungi WhatsApp 0858-1668-6900 dengan menyebut tanggal, lokasi, dan perkiraan jumlah tamu.',
      },
    },
  ],
};

const ADDITIONAL_SERVICES = [
  {
    icon: Home,
    title: 'Tenda Rigging & Sarnafil',
    desc: 'Aluminium heavy duty truss rigging panggung, tenda kerucut sarnafil 3x3 & 5x5 m, serta tenda VIP dekorasi plafon serut anti bocor.',
    spec: 'Rentang Bentang 6m - 14m',
  },
  {
    icon: Lightbulb,
    title: 'Tata Cahaya & Stage Lighting',
    desc: 'Moving Head Beam 230/260, Par LED RGBW 54x3W, Strobe Light, DMX Console, serta Smoke Gun & Haze machine dramatis.',
    spec: 'DMX512 Controlled',
  },
  {
    icon: Zap,
    title: 'Genset Silent (Power Backup)',
    desc: 'Unit generator super silent 20 kVA hingga 60 kVA. Termasuk pasokan solar, kabel tembaga standar PLN, dan operator kelistrikan.',
    spec: '20 kVA s/d 60 kVA',
  },
  {
    icon: Layers,
    title: 'Panggung Modular & LED Rig',
    desc: 'Panggung level ketinggian 40cm - 150cm berlapis melamin hitam glossy atau karpet bersih, kokoh untuk acara & full band.',
    spec: 'Kapasitas Beban 750kg/m²',
  },
  {
    icon: Utensils,
    title: 'Peralatan Prasmanan & Catering',
    desc: 'Roll top chafing dish stainless steel, pemanas sup, dispenser sirup, piring, sendok, garpu, kursi tamu, dan meja lengkap.',
    spec: 'Stainless Steel 304',
  },
  {
    icon: Video,
    title: 'Fotografer & Live Streaming',
    desc: 'Dokumentasi foto acara, setup kamera multicam, video switcher, serta output siaran YouTube/Zoom untuk acara keluarga maupun instansi.',
    spec: 'Full HD & 4K Pipeline',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'Suara vokal pengantin dan musik pengiring jernih tanpa feedback atau mendengung sama sekali. Kru Sigma datang 4 jam sebelum acara, pas gladi bersih semua sudah beres. Sangat direkomendasikan!',
    initials: 'HW',
    name: 'Dr. Hendra W.',
    role: 'Pesta Pernikahan Grand Ballroom, Jombang',
  },
  {
    quote:
      'Line array gantung Sigma menggelegar di lapangan terbuka tapi tetap nyaman di telinga tanpa bikin sakit. Tata panggung dan sound engineer sangat responsif saat artis minta tweak monitor.',
    initials: 'UN',
    name: 'Panitia Dies Natalis UNDAR',
    role: 'Konser Kampus 10.000W, Jombang',
  },
  {
    quote:
      'Sudah langganan lebih dari 3 tahun untuk event corporate dan hajatan di Jombang & sekitarnya. Selalu on-time, kabel tertata rapi, dan kru selalu mengenakan seragam profesional.',
    initials: 'SA',
    name: 'Sarah Amanda',
    role: 'Event Organizer Mitra Jawa Timur',
  },
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SiteHeader />

      <main className="w-full bg-[var(--bg-page)] pt-20">
        {/* HERO SECTION */}
        <section className="relative w-full overflow-hidden py-12 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="flex flex-col items-start text-left lg:col-span-6">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Garansi Audio Jernih &amp; Kru Berpengalaman
                  </span>
                </div>

                <h1 className="mb-6 font-display text-4xl font-extrabold leading-[1.15] tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-[52px]">
                  Rental Sound System &amp; Perlengkapan Acara{' '}
                  <span className="text-[var(--accent-text)]">Profesional di Jombang</span>
                </h1>

                <p className="mb-8 max-w-xl text-base leading-relaxed text-[var(--text-secondary)] lg:text-lg">
                  Presisi audio high-fidelity, konsol digital flagship, dan tata panggung
                  terintegrasi. Menghadirkan performa live audio tanpa distorsi untuk pernikahan,
                  hajatan, pengajian akbar, hingga festival musik se-Jawa Timur.
                </p>

                <div className="flex w-full flex-wrap items-center gap-4 sm:w-auto">
                  <Link
                    href="/jadwal"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] sm:w-auto"
                  >
                    <Calendar className="h-5 w-5" />
                    <span>Lihat Ketersediaan Tanggal</span>
                  </Link>
                  <OpenChatButton />
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-lg">
                  <div className="relative h-[340px] w-full sm:h-[440px] lg:h-[480px]">
                    <Image
                      src="/assets/hero.webp"
                      alt="Lampu panggung menyapu kerumunan saat acara malam, rental Sigma Music Jombang"
                      fill
                      priority
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f0d18]/85 via-transparent to-transparent" />

                    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/95 p-4 shadow-sm backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--accent-text)]">
                          <Activity className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Live Monitoring
                          </div>
                          <div className="num text-sm font-bold text-[var(--text-primary)]">
                            128 dB Peak SPL / 0.003% THD
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-bold uppercase text-[var(--accent-text)]">
                          Dante Network
                        </span>
                        <span className="rounded-full bg-[var(--bg-chip)] px-2.5 py-1 text-[11px] font-bold uppercase text-[var(--text-secondary)]">
                          FOH Wireless
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Stats Bar */}
            <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
              {[
                { num: '500+', title: 'Event Sukses', sub: 'Pernikahan, Konser & Pemkab' },
                { num: '99.8%', title: 'On-Time Setup', sub: 'Tiba 4 Jam Pre-Acara' },
                { num: '4.9/5', title: 'Rating Kepuasan', sub: 'Ulasan Google & WO Mitra' },
                { num: '10+ Thn', title: 'Pengalaman', sub: 'Kru Berlisensi Pro Audio' },
              ].map((stat) => (
                <div
                  key={stat.title}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-left shadow-sm"
                >
                  <div className="num font-display text-3xl font-extrabold text-[var(--accent-text)] lg:text-4xl">
                    {stat.num}
                  </div>
                  <div className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                    {stat.title}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--text-muted)]">{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PACKAGES SECTION */}
        <PackageTabsSection />

        {/* ADDITIONAL SERVICES GRID */}
        <section
          id="layanan"
          className="w-full border-t border-[var(--border-subtle)] bg-[var(--bg-page)] py-16 lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="mb-12">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent-text)]">
                Infrastruktur Lengkap 1 Pintu
              </span>
              <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-[var(--text-primary)] lg:text-4xl">
                Layanan &amp; Perlengkapan Event Tambahan
              </h2>
              <p className="mt-2 max-w-2xl text-base text-[var(--text-secondary)]">
                Sigma Music menyediakan solusi one-stop event equipment. Tidak perlu pusing
                koordinasi banyak vendor terpisah di Jombang &amp; sekitarnya.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {ADDITIONAL_SERVICES.map((srv) => {
                const Icon = srv.icon;
                return (
                  <Link
                    key={srv.title}
                    href={`/jadwal?paket=${encodeURIComponent(srv.title)}`}
                    className="group flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-sm transition-all hover:border-[var(--accent)]/60"
                  >
                    <div>
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-chip)] text-[var(--accent-text)] transition-transform group-hover:scale-105">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                        {srv.title}
                      </h3>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">{srv.desc}</p>
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
                      <span className="text-xs font-bold text-[var(--accent-text)]">{srv.spec}</span>
                      <ArrowRight className="h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section
          id="testimoni"
          className="w-full border-t border-[var(--border-subtle)] bg-[var(--bg-lowest)] py-16 lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent-text)]">
                  Testimoni Klien &amp; Panitia
                </span>
                <h2 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-[var(--text-primary)] lg:text-4xl">
                  Dipercaya Pengantin, Kampus, hingga EO Jawa Timur
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex text-[var(--accent-text)]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  4.9 / 5.0 Skor Google Business
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <article
                  key={t.name}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-sm"
                >
                  <div>
                    <div className="mb-4 flex text-[var(--accent-text)]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <p className="text-sm italic leading-relaxed text-[var(--text-secondary)]">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                  </div>

                  <div className="mt-6 flex items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-chip)] text-sm font-bold text-[var(--accent-text)]">
                      {t.initials}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">{t.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{t.role}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* LOCATION & FAQ SECTION */}
        <section
          id="fasilitas"
          className="w-full border-t border-[var(--border-subtle)] bg-[var(--bg-page)] py-16 lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 shadow-sm lg:col-span-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent-text)]">
                    Workshop &amp; Sound Lab
                  </span>
                  <h2 className="mt-1 font-display text-2xl font-bold text-[var(--text-primary)]">
                    Kunjungi Gudang &amp; Studio Kami
                  </h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Ingin mendengarkan demo audio dan cek fisik peralatan sebelum memutuskan booking?
                    Silakan kunjungi markas Sigma Music Jombang.
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-chip)] text-[var(--accent-text)]">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--text-primary)]">
                          Studio &amp; Gudang Logistik
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          Jl. KH. Rifai Romly RT.30/RW.04, Wonokerto Selatan, Peterongan, Kec.
                          Peterongan, Kabupaten Jombang, Jawa Timur 61481
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-chip)] text-[var(--accent-text)]">
                        <MapIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--text-primary)]">
                          Jangkauan Layanan Siap Antar
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          Jombang Kota &amp; Kabupaten, Mojokerto, Kediri, Nganjuk, dan Surabaya.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-chip)] text-[var(--accent-text)]">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--text-primary)]">
                          Hotline &amp; Konsultasi Teknis
                        </div>
                        <a
                          href={`https://wa.me/${WA_NUMBER}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-[var(--accent-text)] hover:underline"
                        >
                          WhatsApp {WA_DISPLAY}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/jadwal"
                    className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
                  >
                    Cek Kalender &amp; Booking
                  </Link>
                  <a
                    href={`https://wa.me/${WA_NUMBER}?text=Halo%20Sigma%20Music%2C%20saya%20mau%20konsultasi%20acara.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-chip)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)]"
                  >
                    Chat WhatsApp
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 shadow-sm lg:col-span-6">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent-text)]">
                  Pertanyaan Umum (FAQ)
                </span>
                <h2 className="mt-1 font-display text-2xl font-bold text-[var(--text-primary)]">
                  Informasi Penting Sebelum Sewa
                </h2>
                <div className="mt-6 space-y-4">
                  {[
                    {
                      q: 'Apakah bisa sewa sound system saja tanpa paket tenda?',
                      a: 'Bisa. Sound system, lighting, panggung, tenda, kursi/meja, alat makan, hingga fotografer bisa disewa satuan maupun paket lengkap.',
                    },
                    {
                      q: 'Bagaimana sistem pengajuan booking di website?',
                      a: 'Pilih tanggal di halaman Jadwal atau ajukan lewat Asisten AI. Status awal adalah Pending dan tanggal dikunci resmi (Booked) setelah konfirmasi kru & DP dengan admin via WhatsApp.',
                    },
                    {
                      q: 'Berapa jam sebelum acara kru Sigma Music datang?',
                      a: 'Standar SOP kami, kru tiba minimal 4 jam sebelum acara dimulai untuk loading, instalasi rigging, dan soundcheck bebas feedback.',
                    },
                  ].map((item) => (
                    <div
                      key={item.q}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-4"
                    >
                      <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                        {item.q}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                        {item.a}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
