const encoder = new TextEncoder();

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  if (!/^[A-Za-z0-9\-_]+$/.test(str)) {
    throw new Error('Invalid base64url characters');
  }
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: 'admin';
  jti: string;
  iat: number;
  exp: number;
}

/**
 * Signs an HS256 Admin JWT with a unique `jti` for server-side revocation (F-12).
 * Default TTL: 2 hours (7200s).
 */
export async function signAdminJwt(email: string, secret: string, ttlSeconds = 7200): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload: AdminJwtPayload = {
    sub: email,
    email,
    role: 'admin',
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + ttlSeconds,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${header}.${encodedPayload}`;
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
}

/**
 * Verifies an HS256 Admin JWT safely — malformed base64url segments always return null (401), never throw 500 (F-05).
 */
export async function verifyAdminJwt(token: string, secret: string): Promise<AdminJwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerPart, payloadPart, sigPart] = parts;
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerPart))) as {
      alg?: string;
      typ?: string;
    };
    if (header.alg !== 'HS256') return null;

    const sigBytes = base64UrlDecode(sigPart);
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(`${headerPart}.${payloadPart}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart))) as AdminJwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now || payload.role !== 'admin') {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export async function hashIp(ip: string, salt = 'sigma-music-v2'): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${ip}`));
  const bytes = new Uint8Array(digest).slice(0, 12);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Server-side token revocation store (KV-backed with isolate memory fallback, F-12)
const memoryRevoked = new Map<string, number>();

export async function revokeJwtJti(
  kv: KVNamespace | undefined,
  jti: string,
  expUnixSec: number
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(60, expUnixSec - now + 60);
  if (kv) {
    await kv.put(`revoked:${jti}`, '1', { expirationTtl: ttl });
  }
  memoryRevoked.set(jti, expUnixSec);
}

export async function isJwtRevoked(kv: KVNamespace | undefined, jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  const memExp = memoryRevoked.get(jti);
  if (memExp && memExp >= Math.floor(Date.now() / 1000)) {
    return true;
  }
  if (kv) {
    const found = await kv.get(`revoked:${jti}`);
    return found !== null;
  }
  return false;
}
