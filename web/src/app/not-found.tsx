import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { WA_DISPLAY, WA_NUMBER } from '@/lib/api';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[75vh] bg-[var(--bg-page)] pt-28 pb-20">
        <div className="mx-auto max-w-3xl px-4 lg:px-8">
          <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 shadow-lg sm:p-12">
            <span className="inline-block rounded-full bg-[var(--accent-soft)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
              404 · Halaman Tidak Ditemukan
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-5xl">
              Halaman yang Anda cari tidak ada.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[var(--text-secondary)]">
              Mungkin tautan sudah berpindah atau salah ketik. Anda bisa kembali ke beranda, cek
              kalender jadwal acara, atau langsung hubungi tim kami lewat WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
              >
                Kembali ke Beranda
              </Link>
              <Link
                href="/jadwal"
                className="inline-flex items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)]"
              >
                Cek Jadwal Acara
              </Link>
              <a
                href={`https://wa.me/${WA_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-[var(--border-subtle)] bg-transparent px-6 py-3 text-sm font-semibold text-[var(--accent-text)] transition hover:border-[var(--accent)]"
              >
                WhatsApp {WA_DISPLAY}
              </a>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
