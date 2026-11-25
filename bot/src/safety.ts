import crypto from 'node:crypto';

export function randomBetween(min: number, max: number): number {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.floor(low + Math.random() * (high - low + 1));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verifies `X-Sigma-Signature: sha256=<hex>` from Cloudflare Worker (`worker/src/lib/webhook.ts`).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!secret) return true;
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const providedHex = signatureHeader.slice('sha256='.length).trim();

  const a = Buffer.from(expectedHex, 'hex');
  const b = Buffer.from(providedHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Calculates a realistic typing duration based on reply length.
 */
export function calculateTypingDelayMs(text: string, minMs = 1500, maxMs = 4200): number {
  const scaled = Math.min(maxMs, Math.max(minMs, 900 + text.length * 18));
  return randomBetween(Math.floor(scaled * 0.85), Math.min(maxMs, Math.ceil(scaled * 1.15)));
}

/**
 * Sequential outbound queue with randomized spacing to avoid burst-rate bans.
 */
export class OutboundQueue {
  private chain: Promise<void> = Promise.resolve();
  private pendingCount = 0;

  constructor(
    private readonly minJitterMs = 2200,
    private readonly maxJitterMs = 5000,
    private readonly maxQueueSize = 50
  ) {}

  get size(): number {
    return this.pendingCount;
  }

  enqueue(task: () => Promise<void>): Promise<void> {
    if (this.pendingCount >= this.maxQueueSize) {
      return Promise.reject(new Error('Outbound queue full — skipping to protect WhatsApp account'));
    }

    this.pendingCount += 1;
    const run = this.chain.then(async () => {
      try {
        await task();
      } finally {
        this.pendingCount = Math.max(0, this.pendingCount - 1);
        await sleep(randomBetween(this.minJitterMs, this.maxJitterMs));
      }
    });

    this.chain = run.catch(() => {});
    return run;
  }
}

/**
 * Per-JID cooldown and message ID deduplication to prevent spam loops or history-sync floods.
 */
export class MessageGuard {
  private readonly lastReplyByJid = new Map<string, number>();
  private readonly seenMessageIds = new Set<string>();

  constructor(
    private readonly cooldownMs = 5000,
    private readonly bootTimestampSec = Math.floor(Date.now() / 1000)
  ) {}

  shouldProcess(params: {
    jid: string;
    messageId?: string | null;
    timestampSec?: number | null;
    fromMe?: boolean;
  }): boolean {
    if (params.fromMe) return false;
    if (!params.jid || params.jid === 'status@broadcast' || params.jid.endsWith('@g.us')) {
      return false;
    }

    // Ignore historical messages synced during reconnect (allow 30s clock skew)
    if (params.timestampSec && params.timestampSec < this.bootTimestampSec - 30) {
      return false;
    }

    if (params.messageId) {
      if (this.seenMessageIds.has(params.messageId)) return false;
      this.seenMessageIds.add(params.messageId);
      if (this.seenMessageIds.size > 2000) {
        const first = this.seenMessageIds.values().next().value;
        if (first) this.seenMessageIds.delete(first);
      }
    }

    const now = Date.now();
    const prev = this.lastReplyByJid.get(params.jid) ?? 0;
    if (now - prev < this.cooldownMs) {
      return false;
    }
    this.lastReplyByJid.set(params.jid, now);
    return true;
  }
}
