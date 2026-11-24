'use client';

import { Minus, Send, ShieldCheck, X, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { sendChatMessage, WA_DISPLAY, WA_NUMBER } from '@/lib/api';

function AiWaveMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="currentColor" fillOpacity="0.16" />
      <rect x="9" y="16" width="3" height="8" rx="1.5" fill="currentColor" />
      <rect x="14.5" y="11" width="3" height="18" rx="1.5" fill="currentColor" />
      <rect x="20" y="7" width="3" height="26" rx="1.5" fill="currentColor" />
      <rect x="25.5" y="13" width="3" height="14" rx="1.5" fill="currentColor" />
      <rect x="31" y="17" width="3" height="6" rx="1.5" fill="currentColor" />
    </svg>
  );
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{ id: number; title: string; section: string | null }>;
}

const QUICK_PROMPTS = [
  '⚡ Hitung Kebutuhan Watt Acara',
  '🎤 Cek Paket Hajatan vs Akustik',
  '🔌 Butuh Genset Berapa kVA?',
  '📍 Estimasi Ongkir Area Jombang',
];

const FALLBACK_TEMPLATES = [
  `Koneksi ke asisten AI sedang sibuk sebentar. Untuk respon cepat seputar paket & jadwal, yuk langsung chat WhatsApp admin di ${WA_DISPLAY}!`,
  `Sepertinya jalur chat AI sedang padat. Anda bisa langsung cek tanggal kosong di halaman Jadwal atau hubungi WhatsApp ${WA_DISPLAY}.`,
  `Asisten AI sedang penyesuaian sejenak. Silakan kirim tanggal & lokasi acara Anda lewat WhatsApp ${WA_DISPLAY}, tim kami siap membantu hari ini.`,
];

function pickClientFallback(seed: string): string {
  let h = Date.now();
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_TEMPLATES[h % FALLBACK_TEMPLATES.length];
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Halo Mas/Mbak! Saya asisten cerdas Sigma Music Jombang. Mau tanya estimasi daya watt, cek paket hajatan vs akustik, kebutuhan genset, atau rekomendasi sound untuk venue Anda?',
    },
  ]);

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('sigma:open-chat', onOpen);
    return () => window.removeEventListener('sigma:open-chat', onOpen);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendChatMessage({ session_id: sessionId, message: trimmed });
      setSessionId(res.session_id);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          citations: res.citations,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-fb-${Date.now()}`,
          role: 'assistant',
          content: pickClientFallback(trimmed),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka asisten AI Sigma Music"
          className="fixed bottom-5 right-5 z-[400] flex items-center gap-2.5 rounded-full border border-[var(--border-subtle)] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(109,40,217,0.38)] transition hover:bg-[var(--accent-hover)] active:scale-95"
        >
          <span className="flex h-7 w-7 items-center justify-center text-white">
            <AiWaveMark className="h-7 w-7" />
          </span>
          <span>Sigma Audio AI</span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label="Sigma Audio AI"
          className="fixed inset-x-0 bottom-0 z-[400] flex h-[620px] max-h-[88vh] flex-col overflow-hidden rounded-t-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[0_25px_60px_-15px_rgba(109,40,217,0.28)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[420px] sm:rounded-3xl"
        >
          {/* 1. POPUP HEADER */}
          <header className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--accent-text)]">
                <AiWaveMark className="h-9 w-9" />
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--bg-card)] bg-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-base font-bold leading-tight tracking-tight text-[var(--text-primary)]">
                    Sigma Audio AI
                  </p>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                    Online
                  </span>
                </div>
                <p className="text-xs font-medium text-[var(--accent-text)]">
                  Konsultan Sound &amp; Event Jombang
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[var(--text-muted)]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Minimize"
                aria-label="Minimize chat"
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[var(--bg-chip)] hover:text-[var(--text-primary)]"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Tutup Chat"
                aria-label="Tutup chat"
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[var(--bg-chip)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* SUBHEADER */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 text-[11px] text-[var(--accent-text)]">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="h-3.5 w-3.5" />
              Respon instan &amp; rekomendasi paket otomatis
            </span>
            <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 font-bold text-[var(--text-primary)]">
              Free Konsultasi
            </span>
          </div>

          {/* 2. CHAT FEED */}
          <div
            ref={listRef}
            className="chat-scroll flex-1 space-y-4 overflow-y-auto bg-[var(--bg-lowest)] p-4"
          >
            <div className="flex justify-center">
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)]">
                Hari ini
              </span>
            </div>

            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-xs border border-[var(--border-subtle)] bg-[var(--accent)] p-3 text-xs leading-relaxed text-white shadow-xs whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2.5">
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--accent-text)]">
                    <AiWaveMark className="h-6 w-6" />
                  </div>
                  <div className="max-w-[86%] space-y-1.5">
                    <div className="rounded-2xl rounded-tl-xs border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-xs leading-relaxed text-[var(--text-primary)] shadow-xs whitespace-pre-wrap">
                      {m.content}
                    </div>
                    {m.citations && m.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-1">
                        {m.citations.slice(0, 2).map((c) => (
                          <span
                            key={c.id}
                            className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
                          >
                            Sumber: {c.section || c.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--accent-text)]">
                  <AiWaveMark className="h-6 w-6" />
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs text-[var(--text-muted)]">
                  Sedang memeriksa paket &amp; jadwal...
                </div>
              </div>
            )}

            {messages.length <= 1 && (
              <div className="pl-9 pr-1">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Pertanyaan Cepat:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSend(q)}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. BOTTOM INPUT BAR */}
          <footer className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] p-3.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tulis pertanyaan seputar sound & event..."
                maxLength={1000}
                aria-label="Ketik pertanyaan untuk asisten AI"
                className="flex-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                title="Kirim Pesan"
                aria-label="Kirim pesan"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-sm transition hover:bg-[var(--accent-hover)] disabled:opacity-45"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-[var(--text-muted)]">
              <a
                href={`https://wa.me/${WA_NUMBER}?text=Halo%20Sigma%20Music%2C%20saya%20ingin%20konsultasi%20langsung.`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--accent-text)] hover:underline"
              >
                Chat WA Admin ({WA_DISPLAY})
              </a>
              <span className="flex items-center gap-1 font-medium text-[var(--accent-text)]">
                <ShieldCheck className="h-3 w-3" />
                Didukung AI Akustik Sigma Music
              </span>
            </div>
          </footer>
        </section>
      )}
    </>
  );
}
