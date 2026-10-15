/**
 * phoneNormalization.ts — Canonical Phone Normalization & Matching Utility
 *
 * Ensures all phone numbers across Olive Pizza backend and client apps conform to
 * E.164 and 10-digit national formats, supporting robust Firestore and PostgreSQL queries.
 */

export interface NormalizedPhone {
  raw: string;
  e164: string;      // e.g. "+919876543210"
  national: string;  // e.g. "9876543210"
  countryCode: string; // "91"
  isValid: boolean;
}

/**
 * Normalizes any phone number string into canonical E.164 and national 10-digit format.
 * Defaults to India (+91) if a 10-digit number is provided without a country prefix.
 */
export function normalizePhone(rawPhone?: string | null): NormalizedPhone {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      raw: '',
      e164: '',
      national: '',
      countryCode: '91',
      isValid: false
    };
  }

  // Strip all non-digit characters except leading '+'
  const trimmed = rawPhone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (!digitsOnly) {
    return {
      raw: trimmed,
      e164: '',
      national: '',
      countryCode: '91',
      isValid: false
    };
  }

  let countryCode = '91';
  let national = '';

  if (digitsOnly.length === 10) {
    // 10-digit Indian mobile number
    national = digitsOnly;
    countryCode = '91';
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    // 0 + 10-digit number
    national = digitsOnly.substring(1);
    countryCode = '91';
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    // 91 + 10-digit number
    national = digitsOnly.substring(2);
    countryCode = '91';
  } else if (digitsOnly.length > 10) {
    // General international number
    national = digitsOnly.slice(-10);
    countryCode = digitsOnly.slice(0, -10);
  } else {
    // Less than 10 digits — invalid for full authentication
    national = digitsOnly;
    return {
      raw: trimmed,
      e164: hasPlus ? `+${digitsOnly}` : digitsOnly,
      national,
      countryCode,
      isValid: false
    };
  }

  // Validate Indian mobile format: 10 digits starting with 6, 7, 8, or 9
  const isIndianMobile = countryCode === '91' && /^[6-9]\d{9}$/.test(national);
  const isValid = isIndianMobile || (digitsOnly.length >= 10 && digitsOnly.length <= 15);

  const e164 = `+${countryCode}${national}`;

  return {
    raw: trimmed,
    e164,
    national,
    countryCode,
    isValid
  };
}

/**
 * Returns an array of search variants to query database fields that might have stored
 * the phone number in E.164, 10-digit national, or prefixed format.
 */
export function getPhoneQueryVariants(rawPhone?: string | null): string[] {
  const norm = normalizePhone(rawPhone);
  if (!norm.isValid && !norm.national) return [];

  const variants = new Set<string>();
  if (norm.e164) variants.add(norm.e164);
  if (norm.national) {
    variants.add(norm.national);
    variants.add(`0${norm.national}`);
    variants.add(`91${norm.national}`);
  }
  if (norm.raw) variants.add(norm.raw);

  return Array.from(variants);
}

/**
 * Safely compares two phone numbers regardless of formatting (+91, spaces, dashes, leading zero).
 */
export function phonesMatch(phoneA?: string | null, phoneB?: string | null): boolean {
  if (!phoneA || !phoneB) return false;
  const normA = normalizePhone(phoneA);
  const normB = normalizePhone(phoneB);

  if (normA.isValid && normB.isValid) {
    return normA.e164 === normB.e164;
  }
  return normA.national === normB.national && normA.national.length >= 10;
}
