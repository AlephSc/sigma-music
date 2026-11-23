export const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL?.replace(/\/+$/, '') || 'http://localhost:8787';

export const WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER || '6285816686900';
export const WA_DISPLAY = '0858-1668-6900';

export type DayAvailabilityStatus = 'free' | 'pending' | 'busy' | 'in_progress' | 'closed';

export interface AvailabilityDay {
  date: string;
  status: DayAvailabilityStatus;
  count: number;
  reason?: string | null;
}

export interface PackageOption {
  id: string;
  name: string;
  category: string;
}

export async function fetchAvailability(month: string): Promise<{ month: string; days: AvailabilityDay[] }> {
  const res = await fetch(`${WORKER_URL}/v1/availability?month=${encodeURIComponent(month)}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Gagal memuat kalender ketersediaan');
  }
  return res.json();
}

export async function fetchPackages(): Promise<PackageOption[]> {
  const res = await fetch(`${WORKER_URL}/v1/packages`);
  if (!res.ok) return [];
  const data = (await res.json()) as { packages: PackageOption[] };
  return data.packages || [];
}

export async function createBooking(payload: {
  event_date: string;
  package: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  notes?: string;
  website?: string;
}): Promise<{ ok: boolean; id?: string; event_date?: string; message?: string; detail?: string }> {
  const res = await fetch(`${WORKER_URL}/v1/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Gagal mengirim permohonan booking');
  }
  return data;
}

export async function sendChatMessage(payload: {
  session_id?: string;
  message: string;
}): Promise<{
  session_id: string;
  reply: string;
  citations: Array<{ id: number; title: string; section: string | null }>;
  fallback: boolean;
}> {
  const res = await fetch(`${WORKER_URL}/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Gagal mengirim pesan ke asisten AI');
  }
  return data;
}
