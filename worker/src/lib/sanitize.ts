const CONTROL_OR_ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const CHAT_TEMPLATE_TOKENS = /(<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>|\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>>)/gi;

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /reveal\s+(your\s+)?(system\s+prompt|instructions|api\s*key)/i,
  /abaikan\s+(semua\s+)?instruksi\s+(sebelumnya|di\s+atas)/i,
  /bocorkan\s+(system\s+prompt|data\s+pelanggan)/i,
];

export interface SanitizeResult {
  clean: string;
  flaggedInjection: boolean;
}

/**
 * L1 Input Sanitizer:
 * - NFKC normalization
 * - Removes zero-width & control chars
 * - Neutralizes chat template tokens
 * - Truncates to max 1000 chars
 * - Flags suspicious prompt-injection patterns for audit logging
 */
export function sanitizeChatInput(raw: string, maxLength = 1000): SanitizeResult {
  const normalized = raw
    .normalize('NFKC')
    .replace(CONTROL_OR_ZERO_WIDTH, '')
    .replace(CHAT_TEMPLATE_TOKENS, '[filtered]')
    .trim()
    .slice(0, maxLength);

  const flaggedInjection = INJECTION_PATTERNS.some((re) => re.test(normalized));
  return { clean: normalized, flaggedInjection };
}

/**
 * Masks any accidental 628.../08... phone numbers that aren't Sigma Music's own WA number.
 */
export function guardOutputPii(text: string, ownWaNumber = '6285816686900'): string {
  const ownLocal = ownWaNumber.startsWith('62') ? '0' + ownWaNumber.slice(2) : ownWaNumber;
  return text.replace(/(?:\+?62|0)8[\d\-\s]{7,14}\d/g, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits === ownWaNumber || digits === ownLocal) {
      return match;
    }
    return '[nomor disensor demi privasi]';
  });
}
