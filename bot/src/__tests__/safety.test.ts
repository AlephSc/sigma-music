import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { calculateTypingDelayMs, MessageGuard, OutboundQueue, verifyWebhookSignature } from '../safety.js';

describe('Webhook HMAC verification', () => {
  it('verifies valid sha256 signature and rejects tampered payload', () => {
    const secret = 'my-webhook-secret';
    const body = JSON.stringify({ event: 'booking.created', event_date: '2026-12-20' });
    const hex = crypto.createHmac('sha256', secret).update(body).digest('hex');

    expect(verifyWebhookSignature(body, `sha256=${hex}`, secret)).toBe(true);
    expect(verifyWebhookSignature(body + ' ', `sha256=${hex}`, secret)).toBe(false);
    expect(verifyWebhookSignature(body, 'sha256=deadbeef', secret)).toBe(false);
  });
});

describe('Anti-suspend MessageGuard', () => {
  it('blocks groups, broadcasts, fromMe, stale history, duplicates, and rapid bursts', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const guard = new MessageGuard(5000, nowSec);

    expect(guard.shouldProcess({ jid: '123@g.us', messageId: 'm1', timestampSec: nowSec })).toBe(false);
    expect(guard.shouldProcess({ jid: 'status@broadcast', messageId: 'm2', timestampSec: nowSec })).toBe(false);
    expect(guard.shouldProcess({ jid: '62812@s.whatsapp.net', messageId: 'm3', timestampSec: nowSec, fromMe: true })).toBe(
      false
    );
    expect(
      guard.shouldProcess({ jid: '62812@s.whatsapp.net', messageId: 'm4', timestampSec: nowSec - 120 })
    ).toBe(false);

    // First valid message passes
    expect(guard.shouldProcess({ jid: '62812@s.whatsapp.net', messageId: 'm5', timestampSec: nowSec })).toBe(true);
    // Duplicate ID blocked
    expect(guard.shouldProcess({ jid: '62812@s.whatsapp.net', messageId: 'm5', timestampSec: nowSec })).toBe(false);
    // Immediate second message from same JID blocked by cooldown
    expect(guard.shouldProcess({ jid: '62812@s.whatsapp.net', messageId: 'm6', timestampSec: nowSec })).toBe(false);
  });
});

describe('Typing delay & OutboundQueue', () => {
  it('computes bounded typing delay', () => {
    const d = calculateTypingDelayMs('Halo kak, tanggal 20 Desember masih kosong ya.', 1500, 4200);
    expect(d).toBeGreaterThanOrEqual(1200);
    expect(d).toBeLessThanOrEqual(4200);
  });

  it('executes queued tasks sequentially', async () => {
    const q = new OutboundQueue(10, 20);
    const order: number[] = [];
    await Promise.all([
      q.enqueue(async () => {
        order.push(1);
      }),
      q.enqueue(async () => {
        order.push(2);
      }),
    ]);
    expect(order).toEqual([1, 2]);
  });
});
