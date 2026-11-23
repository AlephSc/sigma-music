'use client';

import { Menu, Moon, Sun, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { WA_NUMBER } from '@/lib/api';

export function SiteHeader() {
  const pathname = usePathname();
  const [dark, setDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sigma-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sigma-theme', 'light');
    }
  }

  const navItems = [
    { href: '/', label: 'Beranda' },
    { href: '/#paket-sewa', label: 'Paket Sewa' },
    { href: '/jadwal', label: 'Cek Jadwal' },
    { href: '/#layanan', label: 'Layanan' },
    { href: '/#testimoni', label: 'Testimoni' },
    { href: '/#fasilitas', label: 'Fasilitas' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-page)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] font-display text-lg font-extrabold text-white shadow-sm transition-colors group-hover:bg-[var(--accent-hover)]">
            s
          </div>
          <span className="font-display text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
            sigma music
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigasi utama">
          {navItems.map((item) => {
            const active =
              (item.href === '/' && pathname === '/') ||
              (item.href === '/jadwal' && pathname === '/jadwal');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm transition-colors ${
                  active
                    ? 'font-bold text-[var(--accent-text)]'
                    : 'font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
            title={dark ? 'Mode Terang' : 'Mode Gelap'}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <a
            href={`https://wa.me/${WA_NUMBER}?text=Halo%20Sigma%20Music%2C%20saya%20mau%20tanya%20harga%20sewa.`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] sm:inline-flex"
          >
            Chat WhatsApp
          </a>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu navigasi"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-page)] px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
              >
                {item.label}
              </Link>
            ))}
            <a
              href={`https://wa.me/${WA_NUMBER}?text=Halo%20Sigma%20Music%2C%20saya%20mau%20tanya%20harga%20sewa.`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white"
            >
              Chat WhatsApp
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
