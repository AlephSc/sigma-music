import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CalendarBookingClient } from '@/components/CalendarBookingClient';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Jadwal & Booking Online | Sigma Music Jombang',
  description:
    'Cek kalender ketersediaan sound system, lighting, tenda, dan alat pesta Sigma Music Jombang. Ajukan booking tanggal acara secara online.',
  alternates: {
    canonical: '/jadwal',
  },
};

export default function JadwalPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[var(--bg-page)] pt-24 pb-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mb-8 max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              <span>Live Schedule Check</span>
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              Tentukan Tanggal &amp; Sesi Pelaksanaan
            </h1>
            <p className="text-sm text-[var(--text-secondary)] sm:text-base">
              Pilih tanggal acara untuk memverifikasi ketersediaan armada dan kru kami di Jombang
              dan sekitarnya. Pengajuan berstatus pending akan dikonfirmasi pemilik lewat WhatsApp.
            </p>
          </div>

          <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-[var(--bg-card)]" />}>
            <CalendarBookingClient />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
