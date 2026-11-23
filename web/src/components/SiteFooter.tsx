import Link from 'next/link';
import { WA_DISPLAY, WA_NUMBER } from '@/lib/api';

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-lowest)] py-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="space-y-3 md:col-span-5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] font-display text-base font-extrabold text-white">
                s
              </div>
              <span className="font-display text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
                sigma music
              </span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
              Solusi rental sound system, lighting panggung, tenda dekorasi, genset silent, dan
              perlengkapan pesta profesional di Jombang dan Jawa Timur.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Pondok Pesantren Darul Ulum, Jl. Jenderal Sudirman Km 01, Peterongan, Jombang
            </p>
          </div>

          <div className="space-y-2.5 text-sm md:col-span-3">
            <p className="font-display font-bold text-[var(--text-primary)]">Navigasi</p>
            <ul className="space-y-2 text-[var(--text-secondary)]">
              <li>
                <Link href="/#paket-sewa" className="hover:text-[var(--accent-text)]">
                  Paket Sound System
                </Link>
              </li>
              <li>
                <Link href="/jadwal" className="hover:text-[var(--accent-text)]">
                  Cek Ketersediaan Jadwal
                </Link>
              </li>
              <li>
                <Link href="/#layanan" className="hover:text-[var(--accent-text)]">
                  Layanan Tambahan
                </Link>
              </li>
              <li>
                <Link href="/#fasilitas" className="hover:text-[var(--accent-text)]">
                  Lokasi &amp; FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5 text-sm md:col-span-4">
            <p className="font-display font-bold text-[var(--text-primary)]">Kontak &amp; Operasional</p>
            <p className="text-[var(--text-secondary)]">Senin – Minggu · 08:00 – 21:00 WIB</p>
            <p>
              <a
                href={`https://wa.me/${WA_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--accent-text)] hover:underline"
              >
                WhatsApp {WA_DISPLAY}
              </a>
            </p>
            <div className="pt-2">
              <Link
                href="/admin"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline"
              >
                Panel Admin Operasional →
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border-subtle)] pt-6 text-xs text-[var(--text-muted)]">
          <span>© 2026 Sigma Music Jombang. All rights reserved.</span>
          <span>
            Foto panggung:{' '}
            <a
              href="https://commons.wikimedia.org/wiki/File:Beach-Please-2022-crowd-stage-lights-night-performance.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--text-secondary)]"
            >
              PinkBeachPlanet (CC BY-SA 4.0)
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
