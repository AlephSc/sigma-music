'use client';

import { CheckCircle2, Mic, Sliders, Speaker, Users, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

type FilterCategory = 'all' | 'akustik' | 'hajatan' | 'konser';

interface PackageTier {
  id: string;
  category: Exclude<FilterCategory, 'all'>;
  powerBadge: string;
  venueBadge: string;
  title: string;
  description: string;
  price: string;
  featured?: boolean;
  specs: Array<{ icon: 'speaker' | 'console' | 'mic' | 'crew'; label: string; value: string }>;
  ctaText: string;
}

const PACKAGE_TIERS: PackageTier[] = [
  {
    id: 'akustik',
    category: 'akustik',
    powerBadge: '1.000W - 2.000W',
    venueBadge: 'Indoor / Semi-Outdoor',
    title: 'Paket Akustik & Seminar',
    description:
      'Pilihan ideal untuk intimate wedding, pelantikan, seminar kampus, cafe acoustic gig, dan pengajian keluarga.',
    price: 'Rp 750.000',
    specs: [
      { icon: 'speaker', label: 'Speaker Aktif', value: '2x 15" High-Power' },
      { icon: 'console', label: 'Mixing Console', value: '8-Ch Digital DSP' },
      { icon: 'mic', label: 'Microphone', value: '2x UHF Wireless' },
      { icon: 'crew', label: 'Sound Engineer', value: '1 Crew Standby' },
    ],
    ctaText: 'Pilih Jadwal & Tanggal Acara',
  },
  {
    id: 'hajatan',
    category: 'hajatan',
    powerBadge: '3.000W - 5.000W',
    venueBadge: 'Outdoor & Gedung Besar',
    title: 'Paket Hajatan & Wedding',
    description:
      'Standar baku resepsi pernikahan modern, campursari, hiburan electone, khitanan, hingga temu akbar warga.',
    price: 'Rp 2.500.000',
    featured: true,
    specs: [
      { icon: 'speaker', label: 'Subwoofer + Array', value: '4x 18" Sub + 4 Mid-High' },
      { icon: 'console', label: 'Digital Console', value: 'X32 Producer 16-Ch' },
      { icon: 'mic', label: 'Microphone UHF', value: '4x Shure / Sennheiser' },
      { icon: 'crew', label: 'Dedicated Crew', value: '2 Audio Engineers' },
    ],
    ctaText: 'Pilih Jadwal & Tanggal Acara',
  },
  {
    id: 'konser',
    category: 'konser',
    powerBadge: '10.000W - 25.000W+',
    venueBadge: 'Stadion & Lapangan Terbuka',
    title: 'Paket Konser & Festival',
    description:
      'Konfigurasi pro audio touring concert grade dengan cakupan lontaran suara ribuan penonton merata dan jernih.',
    price: 'Rp 6.000.000',
    specs: [
      { icon: 'speaker', label: 'Line Array System', value: 'Flying Rigging 8-12 Box' },
      { icon: 'speaker', label: 'Subwoofer Monster', value: 'Dual 18" Horn Loaded' },
      { icon: 'console', label: 'FOH & Monitor Console', value: 'Midas M32 / Yamaha QL5' },
      { icon: 'crew', label: 'Team Teknis', value: 'Full FOH & Rigging Crew' },
    ],
    ctaText: 'Konsultasi Riders Konser',
  },
];

function SpecIcon({ type }: { type: 'speaker' | 'console' | 'mic' | 'crew' }) {
  if (type === 'speaker') return <Speaker className="h-4 w-4 text-[var(--accent-text)]" />;
  if (type === 'console') return <Sliders className="h-4 w-4 text-[var(--accent-text)]" />;
  if (type === 'mic') return <Mic className="h-4 w-4 text-[var(--accent-text)]" />;
  return <Users className="h-4 w-4 text-[var(--accent-text)]" />;
}

export function PackageTabsSection() {
  const [filter, setFilter] = useState<FilterCategory>('all');

  const visible = filter === 'all' ? PACKAGE_TIERS : PACKAGE_TIERS.filter((t) => t.category === filter);

  return (
    <section
      id="paket-sewa"
      className="w-full border-t border-[var(--border-subtle)] bg-[var(--bg-lowest)] py-16 lg:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
              <Wrench className="h-4 w-4 text-[var(--accent-text)]" />
              <span>Pilihan Paket Rental Terpopuler</span>
            </div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--text-primary)] lg:text-4xl">
              Paket Sound System Audio Precision
            </h2>
            <p className="mt-2 max-w-xl text-base text-[var(--text-secondary)]">
              Telah dikonfigurasi optimal dengan daya stabil, perlindungan grounding anti-statis, dan
              operator FOH bersertifikasi.
            </p>
          </div>

          <div className="flex items-center gap-1 self-start rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1 md:self-auto">
            {(
              [
                { id: 'all', label: 'Semua Paket' },
                { id: 'akustik', label: 'Akustik' },
                { id: 'hajatan', label: 'Hajatan' },
                { id: 'konser', label: 'Konser' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  filter === tab.id
                    ? 'bg-[var(--text-primary)] text-[var(--bg-page)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`grid grid-cols-1 items-stretch gap-8 ${
            visible.length === 1 ? 'mx-auto max-w-lg' : 'lg:grid-cols-3'
          }`}
        >
          {visible.map((tier) => (
            <article
              key={tier.id}
              className={`relative flex flex-col justify-between rounded-2xl border p-8 shadow-sm transition-all duration-300 ${
                tier.featured
                  ? 'border-[var(--accent)]/60 bg-[var(--bg-elevated)] shadow-md'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50'
              }`}
            >
              {tier.featured && (
                <div className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border-subtle)] bg-[var(--bg-chip)] px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)] shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                  <span>PAKET PALING LARIS</span>
                </div>
              )}

              <div>
                <div className="mb-4 mt-1 flex items-center justify-between gap-2">
                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-chip)] px-3 py-1 text-xs font-bold text-[var(--accent-text)]">
                    {tier.powerBadge}
                  </span>
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    {tier.venueBadge}
                  </span>
                </div>

                <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
                  {tier.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{tier.description}</p>

                <div className="my-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Mulai Dari
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="num font-display text-3xl font-extrabold text-[var(--text-primary)]">
                      {tier.price}
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">/ event</span>
                  </div>
                </div>

                <div className="mb-6 space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] p-4">
                  {tier.specs.map((sp) => (
                    <div key={sp.label} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <SpecIcon type={sp.icon} />
                        {sp.label}
                      </span>
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {sp.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href={`/jadwal?paket=${encodeURIComponent(tier.title)}`}
                  className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                    tier.featured
                      ? 'bg-[var(--accent)] text-white shadow-sm hover:bg-[var(--accent-hover)]'
                      : 'border border-[var(--border-subtle)] bg-[var(--bg-chip)] text-[var(--text-primary)] hover:border-[var(--accent)]'
                  }`}
                >
                  {tier.ctaText}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
