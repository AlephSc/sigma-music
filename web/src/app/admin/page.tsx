import type { Metadata } from 'next';
import { AdminDashboardClient } from '@/components/AdminDashboardClient';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Panel Admin | Sigma Music Jombang',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[var(--bg-page)] pt-24 pb-16">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mb-8 space-y-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              Panel Operasional Admin
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Kelola permohonan booking, tanggal tutup manual, dokumen pengetahuan AI, dan log percakapan.
            </p>
          </div>
          <AdminDashboardClient />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
