'use client';

import { MessageSquare } from 'lucide-react';

export function OpenChatButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('sigma:open-chat'))}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-7 py-3.5 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)] sm:w-auto"
    >
      <MessageSquare className="h-5 w-5 text-[var(--accent-text)]" />
      <span>Chat AI CS / Konsultasi</span>
    </button>
  );
}
