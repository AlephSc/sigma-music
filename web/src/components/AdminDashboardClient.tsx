'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { WORKER_URL } from '@/lib/api';

const AdminWorkspace = dynamic(() => import('./AdminWorkspace'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center text-sm text-[var(--text-secondary)]">
      Memuat dashboard operasional...
    </div>
  ),
});

export function AdminDashboardClient() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const saved = window.sessionStorage.getItem('sigma_admin_jwt');
    if (saved) setToken(saved);
  }, []);

  const handleSessionExpired = useCallback(() => {
    window.sessionStorage.removeItem('sigma_admin_jwt');
    setToken(null);
  }, []);

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

  if (!token) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 shadow-lg">
        <h2 className="mb-2 font-display text-2xl font-bold text-[var(--text-primary)]">
          Login Admin
        </h2>
        <p className="mb-6 text-sm text-[var(--text-secondary)]">
          Masuk untuk mengelola jadwal, katalog layanan, dan asisten AI Sigma Music.
        </p>
        <form onSubmit={handleLogin} className="space-y-4 text-sm">
          <div>
            <label htmlFor="admin_email" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              Email Admin
            </label>
            <input
              id="admin_email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Masukkan email admin"
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-lowest)] px-3.5 py-2.5 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="admin_password" className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              Password
            </label>
            <input
              id="admin_password"
              name="password"
              type="password"
              autoComplete="current-password"
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

  return <AdminWorkspace token={token} onSessionExpired={handleSessionExpired} />;
}
