import type { Env } from '../types';

export interface BookingWebhookPayload {
  event: 'booking.created';
  booking_id: string;
  event_date: string;
  package: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  notes: string | null;
  status: string;
  source: string;
  created_at: string;
}

/**
 * P2 Home Server Notification Hook:
 * Dispatches a signed JSON webhook to `HOME_SERVER_WEBHOOK_URL` (e.g. via Cloudflare Tunnel).
 * Silently no-ops if `HOME_SERVER_WEBHOOK_URL` is not configured.
 */
export async function dispatchBookingWebhook(env: Env, payload: BookingWebhookPayload): Promise<void> {
  if (!env.HOME_SERVER_WEBHOOK_URL) return;

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'SigmaMusic-Worker/2.0',
  };

  if (env.WEBHOOK_SECRET) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const hex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
    headers['X-Sigma-Signature'] = `sha256=${hex}`;
  }

  try {
    await fetch(env.HOME_SERVER_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body,
    });
  } catch {
    // Non-blocking: home server may be temporarily offline
  }
}
