/** Tiny client-side form validation helpers (Turkish messages). */

export const E164_RE = /^\+[1-9]\d{6,14}$/;

export function isValidE164(value: string): boolean {
  return E164_RE.test(value.trim());
}

/** Normalize a phone the user typed: strip spaces/dashes/parens, keep leading +. */
export function normalizePhoneInput(value: string): string {
  const cleaned = value.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  // "05321234567" → "+905321234567" (Turkish national format)
  if (/^0\d{10}$/.test(cleaned)) return `+9${cleaned}`;
  if (/^90\d{10}$/.test(cleaned)) return `+${cleaned}`;
  if (/^5\d{9}$/.test(cleaned)) return `+90${cleaned}`;
  return cleaned;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const MSG = {
  required: 'Bu alan zorunludur.',
  email: 'Geçerli bir e-posta adresi girin.',
  phone: 'Telefonu uluslararası biçimde girin, örn: +905321234567',
  passwordMin: 'Şifre en az 8 karakter olmalıdır.',
} as const;
