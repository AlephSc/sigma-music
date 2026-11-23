'use client';

import {
  AlertTriangle,
  BookOpen,
  CalendarOff,
  ClipboardList,
  LogOut,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { WORKER_URL } from '@/lib/api';

type BookingStatus = 'pending' | 'booked' | 'in_progress' | 'completed' | 'cancelled';

interface AdminBooking {
  id: string;
  created_at: string;
  event_date: string;
  package: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  notes: string | null;
  status: BookingStatus;
  source: string;
  total_price: number | null;
  same_date_count?: number;
}

interface DateBlock {
  event_date: string;
  reason: string | null;
}

interface KnowledgeDoc {
  id: string;
  title: string;
  mime: string;
  status: string;
  chunk_count: number;
  created_at: string;
}

interface ChatSessionLog {
  id: string;
  last_active: string;
  turn_count: number;
  messages: Array<{ id: number; role: string; content: string; created_at: string }>;
}

const STATUS_BADGE: Record<BookingStatus, string> = {
  pending: 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent)]/40',
  booked: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40',
  in_progress: 'bg-amber-500/15 text-amber-500 border-amber-500/40',
  completed: 'bg-[var(--bg-chip)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
  cancelled: 'bg-rose-500/15 text-rose-400 border-rose-500/40',
};

export function AdminDashboardClient() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<'bookings' | 'blocks' | 'knowledge' | 'chats'>('bookings');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [blocks, setBlocks] = useState<DateBlock[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [chats, setChats] = useState<ChatSessionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [blockDate, setBlockDate] = useState('');
  const [blockReason, setBlockReason] = useState('Kru Libur / Perbaikan Alat');
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');

  useEffect(() => {
    const saved = window.sessionStorage.getItem('sigma_admin_jwt');
    if (saved) setToken(saved);
  }, []);

  const authFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!token) throw new Error('Belum login');
      const res = await fetch(`${WORKER_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init?.headers || {}),
        },
      });
      if (res.status === 401) {
        window.sessionStorage.removeItem('sigma_admin_jwt');
        setToken(null);
        throw new Error('Sesi berakhir, silakan login ulang.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Permintaan gagal');
      return data;
    },
    [token]
  );

  const loadTabData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setActionError(null);
    try {
      if (tab === 'bookings') {
        const q = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
        const data = (await authFetch(`/v1/admin/bookings${q}`)) as { bookings: AdminBooking[] };
        setBookings(data.bookings || []);
      } else if (tab === 'blocks') {
        const data = (await authFetch('/v1/admin/blocks')) as { blocks: DateBlock[] };
        setBlocks(data.blocks || []);
      } else if (tab === 'knowledge') {
        const data = (await authFetch('/v1/admin/knowledge')) as { documents: KnowledgeDoc[] };
        setDocs(data.documents || []);
      } else if (tab === 'chats') {
        const data = (await authFetch('/v1/admin/chats')) as { sessions: ChatSessionLog[] };
        setChats(data.sessions || []);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [token, tab, statusFilter, authFetch]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch(`${WORKER_URL}/v1/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Login gagal');
      }
      window.sessionStorage.setItem('sigma_admin_jwt', data.token);
      setToken(data.token);
      setPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleStatusChange(id: string, nextStatus: BookingStatus) {
    setActionError(null);
    try {
      await authFetch(`/v1/admin/bookings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadTabData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal memperbarui status');
    }
  }

  async function handleAddBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!blockDate) return;
    setActionError(null);
    try {
      await authFetch('/v1/admin/blocks', {
        method: 'POST',
        body: JSON.stringify({ event_date: blockDate, reason: blockReason }),
      });
      setBlockDate('');
      await loadTabData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menutup tanggal');
    }
  }

  async function handleDeleteBlock(date: string) {
    await authFetch(`/v1/admin/blocks/${date}`, { method: 'DELETE' });
    await loadTabData();
  }

  async function handleAddKnowledge(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await authFetch('/v1/admin/knowledge', {
        method: 'POST',
        body: JSON.stringify({ title: docTitle, content: docContent, mime: 'text/markdown' }),
      });
      setDocTitle('');
      setDocContent('');
      await loadTabData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mengunggah dokumen RAG');
    }
  }

  async function handleDeleteKnowledge(id: string) {
    await authFetch(`/v1/admin/knowledge/${id}`, { method: 'DELETE' });
    await loadTabData();
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 shadow-lg">
        <h2 className="mb-2 font-display text-2xl font-bold text-[var(--text-primary)]">
          Login Admin
        </h2>
        <p className="mb-6 text-sm text-[var(--text-secondary)]">
          Masuk untuk mengelola jadwal booking, dokumen AI, dan pengaturan operasional Sigma Music.
        </p>
        <form onSubmit={handleLogin} className="space-y-4 text-sm">
          <div>
            <label htmlFor="admin_email" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              Email Admin
            </label>
            <input
              id="admin_email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@sigmamusic.my.id"
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-3.5 py-2.5 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="admin_password" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              Password
            </label>
            <input
              id="admin_password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-3.5 py-2.5 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          {loginError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-400">
              {loginError}
            </div>
          )}
          <button
            type="submit"
            disabled={loggingIn}
            className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
          >
            {loggingIn ? 'Memverifikasi...' : 'Masuk Dashboard'}
          </button>
        </form>
      </div>
    );
  }

  const tabBtnClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
      active
        ? 'bg-[var(--accent)] text-white shadow-sm'
        : 'border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTab('bookings')} className={tabBtnClass(tab === 'bookings')}>
            <ClipboardList className="h-4 w-4" />
            <span>Booking</span>
          </button>
          <button type="button" onClick={() => setTab('blocks')} className={tabBtnClass(tab === 'blocks')}>
            <CalendarOff className="h-4 w-4" />
            <span>Tutup Tanggal</span>
          </button>
          <button type="button" onClick={() => setTab('knowledge')} className={tabBtnClass(tab === 'knowledge')}>
            <BookOpen className="h-4 w-4" />
            <span>Dokumen AI</span>
          </button>
          <button type="button" onClick={() => setTab('chats')} className={tabBtnClass(tab === 'chats')}>
            <MessageSquare className="h-4 w-4" />
            <span>Log Chat</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            window.sessionStorage.removeItem('sigma_admin_jwt');
            setToken(null);
          }}
          className={tabBtnClass(false)}
        >
          <LogOut className="h-4 w-4" />
          <span>Keluar</span>
        </button>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-400">
          {actionError}
        </div>
      )}

      {tab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'pending', 'booked', 'in_progress', 'completed', 'cancelled'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition ${
                  statusFilter === st
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]'
                }`}
              >
                {st === 'all' ? 'Semua' : st}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Memuat daftar booking...</p>
          ) : bookings.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center text-sm text-[var(--text-muted)]">
              Belum ada data booking untuk filter ini.
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <article
                  key={b.id}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="num text-base font-bold text-[var(--text-primary)]">
                          {b.event_date}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[b.status]}`}
                        >
                          {b.status}
                        </span>
                        {(b.same_date_count ?? 0) > 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Ada {b.same_date_count} permohonan di tanggal ini
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {b.customer_name} ·{' '}
                        <a
                          href={`https://wa.me/${b.customer_phone}?text=${encodeURIComponent(
                            `Halo Kak ${b.customer_name}, kami dari Sigma Music Jombang mengonfirmasi permohonan sewa ${b.package} untuk tanggal ${b.event_date}.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent-text)] underline"
                        >
                          +{b.customer_phone}
                        </a>
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">Paket: {b.package}</p>
                      {b.customer_address && (
                        <p className="text-xs text-[var(--text-muted)]">Lokasi: {b.customer_address}</p>
                      )}
                      {b.notes && <p className="text-xs text-[var(--text-muted)]">Catatan: {b.notes}</p>}
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {b.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(b.id, 'booked')}
                          className="rounded-full bg-emerald-600 px-3.5 py-2 font-semibold text-white hover:bg-emerald-700"
                        >
                          Approve (Booked)
                        </button>
                      )}
                      {b.status === 'booked' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(b.id, 'in_progress')}
                          className="rounded-full bg-amber-600 px-3.5 py-2 font-semibold text-white hover:bg-amber-700"
                        >
                          Mulai (In Progress)
                        </button>
                      )}
                      {b.status === 'in_progress' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(b.id, 'completed')}
                          className="rounded-full bg-[var(--accent)] px-3.5 py-2 font-semibold text-white hover:bg-[var(--accent-hover)]"
                        >
                          Selesai (Completed)
                        </button>
                      )}
                      {(b.status === 'pending' || b.status === 'booked') && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(b.id, 'cancelled')}
                          className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 font-semibold text-rose-400 hover:bg-rose-500/20"
                        >
                          Tolak / Batal
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'blocks' && (
        <div className="grid gap-6 md:grid-cols-2">
          <form
            onSubmit={handleAddBlock}
            className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-sm"
          >
            <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
              Tutup Tanggal Manual
            </h3>
            <div>
              <label htmlFor="block_date" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                Tanggal
              </label>
              <input
                id="block_date"
                type="date"
                required
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-3.5 py-2.5 text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label htmlFor="block_reason" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                Alasan
              </label>
              <input
                id="block_reason"
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-3.5 py-2.5 text-[var(--text-primary)]"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              Tandai Tutup Total
            </button>
          </form>

          <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-sm">
            <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
              Daftar Tanggal Ditutup
            </h3>
            {blocks.length === 0 ? (
              <p className="text-[var(--text-muted)]">Tidak ada tanggal yang ditutup manual.</p>
            ) : (
              blocks.map((bl) => (
                <div
                  key={bl.event_date}
                  className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-4 py-2.5"
                >
                  <div>
                    <p className="num font-semibold text-[var(--text-primary)]">{bl.event_date}</p>
                    <p className="text-xs text-[var(--text-muted)]">{bl.reason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteBlock(bl.event_date)}
                    aria-label={`Buka kembali ${bl.event_date}`}
                    className="rounded-full p-2 text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'knowledge' && (
        <div className="grid gap-6 md:grid-cols-2">
          <form
            onSubmit={handleAddKnowledge}
            className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-sm"
          >
            <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
              Tambah Dokumen Pengetahuan AI
            </h3>
            <div>
              <label htmlFor="doc_title" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                Judul Dokumen
              </label>
              <input
                id="doc_title"
                type="text"
                required
                minLength={3}
                placeholder="Misal: Daftar Harga Paket Sound 2027"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-3.5 py-2.5 text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label htmlFor="doc_content" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                Isi Panduan (Markdown / Teks)
              </label>
              <textarea
                id="doc_content"
                rows={7}
                required
                minLength={20}
                placeholder="# Paket Sound..."
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-3.5 py-2.5 text-[var(--text-primary)]"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              Simpan &amp; Indeks ke AI
            </button>
          </form>

          <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-sm">
            <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
              Dokumen Terindeks
            </h3>
            {docs.length === 0 ? (
              <p className="text-[var(--text-muted)]">Belum ada dokumen.</p>
            ) : (
              docs.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{d.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {d.chunk_count} chunk · status: {d.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteKnowledge(d.id)}
                    aria-label={`Hapus ${d.title}`}
                    className="rounded-full p-2 text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'chats' && (
        <div className="space-y-4">
          {chats.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Belum ada log percakapan AI.</p>
          ) : (
            chats.map((s) => (
              <article
                key={s.id}
                className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 text-sm"
              >
                <div className="flex justify-between text-xs text-[var(--text-muted)]">
                  <span>Sesi: {s.id.slice(0, 8)}...</span>
                  <span>
                    {s.turn_count} turn · terakhir {s.last_active}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {s.messages.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-3 py-2 text-xs text-[var(--text-secondary)]"
                    >
                      <strong className="uppercase text-[var(--accent-text)]">{m.role}: </strong>
                      <span>{m.content}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
