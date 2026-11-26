export class PayloadTooLargeError extends Error {
  readonly maxBytes: number;

  constructor(maxBytes: number) {
    super(`Ukuran body maksimal ${Math.round(maxBytes / 1024)} KB`);
    this.name = 'PayloadTooLargeError';
    this.maxBytes = maxBytes;
  }
}

/**
 * Reads a Request body up to `maxBytes` using streaming chunks so oversized
 * chunked payloads without `Content-Length` are aborted before `JSON.parse()` (F-26b).
 */
export async function readTextWithLimit(req: Request, maxBytes: number): Promise<string> {
  const clHeader = req.headers.get('Content-Length');
  if (clHeader !== null) {
    const parsedLength = Number(clHeader);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new PayloadTooLargeError(maxBytes);
    }
  }

  if (!req.body) {
    return '';
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.byteLength === 0) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new PayloadTooLargeError(maxBytes);
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(combined);
}

/**
 * Reads parsed text cached by the Worker's size-cap middleware (or reads the raw body directly)
 * and parses it as JSON. Throws `SyntaxError` if the body is invalid JSON.
 */
export async function readContextJson(
  c: { get: (k: 'rawBody') => string | undefined; req: { raw: Request } },
  maxBytes = 64 * 1024
): Promise<unknown> {
  const raw = c.get('rawBody') ?? (await readTextWithLimit(c.req.raw, maxBytes));
  if (!raw.trim()) {
    throw new SyntaxError('Empty JSON body');
  }
  return JSON.parse(raw);
}
