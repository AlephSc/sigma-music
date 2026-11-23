'use client';

import {
  AlertCircle,
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  MapPin,
  MessageCircle,
  Receipt,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createBooking,
  fetchAvailability,
  fetchPackages,
  type AvailabilityDay,
  type PackageOption,
  WA_DISPLAY,
  WA_NUMBER,
} from '@/lib/api';

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const WEEKDAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const SESSIONS = [
  {
    id: 'pagi',
    label: 'Pagi / Siang',
    time: '07:00 – 15:00 WIB',
    desc: 'Cocok untuk akad nikah, siraman, pengajian, atau wisuda.',
  },
  {
    id: 'malam',
    label: 'Sore / Malam',
    time: '15:00 – 23:00 WIB',
    desc: 'Resepsi malam, hiburan live musik, atau pengajian akbar.',
  },
  {
    id: 'fullday',
    label: 'Seharian Penuh',
    time: '08:00 – 23:00 WIB',
    desc: 'Paling fleksibel untuk temu manten siang & hiburan malam.',
    favorite: true,
  },
];

function toMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatReadableDate(dateStr: string): string {
  if (!dateStr) return 'Belum dipilih';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${MONTH_NAMES_ID[m - 1]} ${y}`;
}

export function CalendarBookingClient() {
  const searchParams = useSearchParams();
  const initialPkg = searchParams.get('paket') || '';

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loadingCal, setLoadingCal] = useState(true);
  const [calError, setCalError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>('fullday');
  const [selectedPackage, setSelectedPackage] = useState<string>(initialPkg);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [websiteHoneypot, setWebsiteHoneypot] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{
    id?: string;
    event_date?: string;
    message?: string;
  } | null>(null);

  const monthKey = useMemo(() => toMonthKey(currentMonth), [currentMonth]);

  const loadMonth = useCallback(async (mKey: string) => {
    setLoadingCal(true);
    setCalError(null);
    try {
      const res = await fetchAvailability(mKey);
      setDays(res.days);
    } catch {
      setCalError('Jadwal sedang dimuat ulang. Silakan coba beberapa saat lagi.');
      setDays([]);
    } finally {
      setLoadingCal(false);
    }
  }, []);

  useEffect(() => {
    loadMonth(monthKey);
  }, [monthKey, loadMonth]);

  useEffect(() => {
    fetchPackages()
      .then((pkgs) => {
        setPackages(pkgs);
        if (pkgs[0] && !selectedPackage) {
          setSelectedPackage(pkgs[0].name);
        }
      })
      .catch(() => {});
  }, [selectedPackage]);

  const firstWeekday = currentMonth.getDay();
  const leadingBlanks = Array.from({ length: firstWeekday });
  const todayIso = new Date().toISOString().slice(0, 10);
  const activeSessionObj = SESSIONS.find((s) => s.id === selectedSession) || SESSIONS[2];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate) {
      setSubmitError('Silakan klik salah satu tanggal kosong di kalender terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const combinedNotes = [`Sesi: ${activeSessionObj.label} (${activeSessionObj.time})`, notes]
        .filter(Boolean)
        .join(' | ');

      const res = await createBooking({
        event_date: selectedDate,
        package: selectedPackage || 'Paket Custom',
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        notes: combinedNotes,
        website: websiteHoneypot,
      });
      setSubmitSuccess(res);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setNotes('');
      await loadMonth(monthKey);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Permohonan belum bisa dikirim. Silakan hubungi WhatsApp admin.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* 3-Step Progress Header */}
      <div className="flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
            <Check className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-500">
              Langkah 1 Selesai
            </span>
            <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
              {selectedPackage || 'Pilih Paket Layanan'}
            </span>
          </div>
        </div>

        <div className="hidden h-[2px] w-10 rounded-full bg-[var(--accent)]/40 md:block" />

        <div className="flex flex-1 items-center gap-3 rounded-xl bg-[var(--accent-soft)] p-2.5">
          <div className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white shadow-sm">
            2
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
              Langkah Aktif
            </span>
            <span className="block truncate text-sm font-bold text-[var(--text-primary)]">
              Tanggal, Sesi &amp; Lokasi
            </span>
          </div>
        </div>

        <div className="hidden h-[2px] w-10 rounded-full bg-[var(--border-subtle)] md:block" />

        <div className="flex flex-1 items-center gap-3 opacity-70">
          <div className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-chip)] text-xs font-bold text-[var(--text-muted)]">
            3
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Langkah 3
            </span>
            <span className="block truncate text-sm font-semibold text-[var(--text-secondary)]">
              Konfirmasi via WhatsApp
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Booking Grid */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        {/* LEFT COLUMN: Calendar + Session + Location */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          {/* Calendar Card */}
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-sm">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-6 w-6 text-[var(--accent-text)]" />
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                    Ketersediaan Kru Sigma
                  </span>
                  <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                    Pilih Tanggal Acara
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-1 self-start rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] p-1 sm:self-auto">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                  aria-label="Bulan sebelumnya"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-chip)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-3 text-sm font-semibold text-[var(--text-primary)]">
                  {MONTH_NAMES_ID[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                  aria-label="Bulan berikutnya"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-chip)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-4 py-2.5 text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                Kosong
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                Antrean Pending
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Ada Agenda
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                Tutup / Penuh
              </span>
            </div>

            {/* Weekdays */}
            <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-[var(--text-muted)]">
              {WEEKDAYS_ID.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>

            {loadingCal ? (
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 30 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-12 animate-pulse rounded-lg bg-[var(--bg-chip)]"
                  />
                ))}
              </div>
            ) : calError ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-400">
                {calError}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Kalender Ketersediaan">
                {leadingBlanks.map((_, i) => (
                  <div key={`blank-${i}`} aria-hidden="true" />
                ))}
                {days.map((d) => {
                  const dayNum = Number(d.date.slice(8, 10));
                  const isPast = d.date < todayIso;
                  const isClosed = d.status === 'closed';
                  const isSelected = selectedDate === d.date;
                  const disabled = isPast || isClosed;

                  let dotClass = 'bg-sky-400';
                  let statusLabel = 'Kosong';
                  if (isClosed) {
                    dotClass = 'bg-rose-400';
                    statusLabel = 'Tutup';
                  } else if (d.status === 'busy' || d.status === 'in_progress') {
                    dotClass = 'bg-amber-400';
                    statusLabel = 'Ada Agenda';
                  } else if (d.status === 'pending') {
                    dotClass = 'bg-[var(--accent)]';
                    statusLabel = 'Antrean Pending';
                  }

                  return (
                    <button
                      key={d.date}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedDate(d.date);
                        setSubmitSuccess(null);
                        setSubmitError(null);
                      }}
                      aria-label={`${formatReadableDate(d.date)}, status ${statusLabel}`}
                      className={`flex h-12 flex-col items-center justify-center rounded-lg border text-xs transition ${
                        isSelected
                          ? 'scale-[1.03] border-[var(--accent)] bg-[var(--accent)] font-bold text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]'
                          : isClosed
                          ? 'cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-lowest)] text-rose-400 line-through opacity-45'
                          : isPast
                          ? 'cursor-not-allowed border-transparent bg-[var(--bg-lowest)] text-[var(--text-muted)] opacity-35'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--bg-chip)]'
                      }`}
                    >
                      <span className="num font-semibold">{dayNum}</span>
                      {!isPast && (
                        <span
                          className={`mt-1 h-1.5 w-1.5 rounded-full ${
                            isSelected ? 'bg-white' : dotClass
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-4 py-3 text-xs">
              <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <CheckCircle2 className="h-4 w-4 text-[var(--accent-text)]" />
                Tanggal aktif:{' '}
                <strong className="text-[var(--accent-text)]">
                  {formatReadableDate(selectedDate)}
                </strong>
              </span>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 font-bold text-[var(--accent-text)]">
                Status awal: Pending
              </span>
            </div>
          </section>

          {/* Session Picker Card */}
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-[var(--accent-text)]" />
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                    Durasi &amp; Waktu Operasional
                  </span>
                  <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                    Pilih Sesi Acara
                  </h3>
                </div>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-bold text-[var(--accent-text)]">
                SOP Sigma Music
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {SESSIONS.map((s) => {
                const active = selectedSession === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSession(s.id)}
                    className={`relative flex flex-col rounded-xl border p-4 text-left transition ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-sm'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    {s.favorite && (
                      <span className="absolute -top-2.5 right-3 rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        FAVORIT
                      </span>
                    )}
                    <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                      {s.label}
                    </span>
                    <span className="num mt-1 text-xs font-semibold text-[var(--accent-text)]">
                      {s.time}
                    </span>
                    <p className="mt-1.5 text-xs text-[var(--text-secondary)]">{s.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] p-3.5 text-xs text-[var(--text-secondary)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-text)]" />
              <p>
                <strong className="text-[var(--text-primary)]">SOP Soundcheck:</strong> Kru teknis
                kami tiba di lokasi <strong className="text-[var(--accent-text)]">minimal 4 jam sebelum acara</strong> untuk instalasi &amp; tuning bebas feedback.
              </p>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Sticky Order Summary & Form */}
        <aside className="lg:sticky lg:top-24 lg:col-span-5">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-[var(--accent-text)]" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Ringkasan &amp; Form Booking
                </h2>
              </div>
              <span className="rounded bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-text)]">
                Konfirmasi WA
              </span>
            </div>

            {submitSuccess ? (
              <div className="space-y-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-sm">
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Permohonan Booking Tercatat (Pending)</span>
                </div>
                <p className="text-[var(--text-secondary)]">{submitSuccess.message}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Tanggal Acara: <strong className="text-[var(--text-primary)]">{submitSuccess.event_date}</strong>
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <a
                    href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
                      `Halo Sigma Music, saya baru mengajukan booking untuk tanggal ${submitSuccess.event_date}. Mohon konfirmasinya.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
                  >
                    <span>Konfirmasi via WA ({WA_DISPLAY})</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setSubmitSuccess(null)}
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-2.5 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    Buat Pengajuan Lain
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                {/* Honeypot */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={websiteHoneypot}
                    onChange={(e) => setWebsiteHoneypot(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="event_date" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    Tanggal Acara *
                  </label>
                  <input
                    id="event_date"
                    type="date"
                    required
                    min={todayIso}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="package" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    Paket / Layanan *
                  </label>
                  <select
                    id="package"
                    required
                    value={selectedPackage}
                    onChange={(e) => setSelectedPackage(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  >
                    {selectedPackage && !packages.some((p) => p.name === selectedPackage) && (
                      <option value={selectedPackage}>{selectedPackage}</option>
                    )}
                    {packages.length === 0 ? (
                      <option value="Paket Hajatan & Wedding">Paket Hajatan &amp; Wedding</option>
                    ) : (
                      packages.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="customer_name" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    Nama Penanggung Jawab *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      id="customer_name"
                      type="text"
                      required
                      minLength={2}
                      placeholder="Contoh: Bpk. Ahmad Fauzi"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] py-2.5 pl-9 pr-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="customer_phone" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    Nomor WhatsApp Aktif *
                  </label>
                  <div className="relative">
                    <MessageCircle className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      id="customer_phone"
                      type="tel"
                      required
                      placeholder="085816686900"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] py-2.5 pl-9 pr-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="customer_address" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    Alamat Lengkap &amp; Kecamatan *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      id="customer_address"
                      type="text"
                      required
                      minLength={3}
                      placeholder="Contoh: Peterongan, Jombang (dekat masjid)"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] py-2.5 pl-9 pr-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="notes" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    Catatan Tambahan
                  </label>
                  <textarea
                    id="notes"
                    rows={2}
                    placeholder="Perkiraan jumlah tamu, kebutuhan genset/tenda, dll."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>

                {submitError && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-400">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(139,92,246,0.35)] transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  <span>{submitting ? 'Mengirim Permohonan...' : 'Ajukan Booking Tanggal Ini'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-2 pt-1 text-xs text-[var(--text-muted)]">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
                  <span>Anti double-book · Verifikasi resmi langsung oleh pemilik via WA</span>
                </div>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
