/**
 * Apex LifeOS: Secure Mobile Companion Pairing Service
 * 
 * Generates obfuscated, zero-exposure pairing tokens, visual QR codes,
 * and masked credential representations so that raw API keys and database
 * endpoints are NEVER exposed in plain text on desktop or mobile screens.
 */

import QRCode from 'qrcode';

export interface MobilePairingPayload {
  v: number;          // Protocol version: 1
  u: string;          // Supabase Project URL
  k: string;          // Supabase Anonymous Public Key
  uid: string;        // User Auth UUID
  ts: number;         // Issued at timestamp (ms)
}

const TOKEN_PREFIX = 'apex_pair_v1_';

/**
 * Encodes connection parameters into an opaque single-string pairing token.
 * Prevents plain text display of keys, URLs, and UUIDs.
 */
export function generatePairingToken(
  supabaseUrl: string,
  anonKey: string,
  userId: string
): string {
  const payload: MobilePairingPayload = {
    v: 1,
    u: supabaseUrl.trim().replace(/\/+$/, ''),
    k: anonKey.trim(),
    uid: userId.trim(),
    ts: Date.now(),
  };

  const jsonStr = JSON.stringify(payload);
  const base64 = btoa(unescape(encodeURIComponent(jsonStr)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${TOKEN_PREFIX}${base64}`;
}

/**
 * Decodes and validates a secure pairing token.
 */
export function parsePairingToken(token: string): MobilePairingPayload | null {
  try {
    if (!token || !token.startsWith(TOKEN_PREFIX)) {
      return null;
    }

    let base64 = token.slice(TOKEN_PREFIX.length)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    const jsonStr = decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(jsonStr) as MobilePairingPayload;

    if (parsed.v === 1 && parsed.u && parsed.k && parsed.uid) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates a high-contrast visual QR code Data URL representing the pairing token.
 */
export async function generatePairingQrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    width: 256,
    margin: 2,
    color: {
      dark: '#FFFFFF',
      light: '#020617', // Match OLED dark mode background
    },
    errorCorrectionLevel: 'M',
  });
}

/**
 * Safely masks a project URL (e.g. https://abcdefghij.supabase.co -> https://abcd••••.supabase.co)
 */
export function maskSupabaseUrl(url: string): string {
  if (!url) return 'https://••••••••.supabase.co';
  try {
    const parsed = new URL(url);
    const hostParts = parsed.hostname.split('.');
    if (hostParts.length >= 3) {
      const projectRef = hostParts[0];
      const maskedRef = projectRef.length > 4 
        ? `${projectRef.slice(0, 4)}••••` 
        : '••••';
      return `${parsed.protocol}//${maskedRef}.${hostParts.slice(1).join('.')}`;
    }
    return `${parsed.protocol}//••••••••`;
  } catch {
    return 'https://••••••••.supabase.co';
  }
}

/**
 * Safely masks an API anon key or JWT token, showing only leading 6 and trailing 4 characters.
 */
export function maskSecretKey(key: string): string {
  if (!key) return '••••••••••••••••••••••••••••••••';
  if (key.length <= 12) return '••••••••••••';
  return `${key.slice(0, 6)}••••••••••••••••••••${key.slice(-4)}`;
}

/**
 * Safely masks a UUID.
 */
export function maskUuid(uuid: string): string {
  if (!uuid) return '••••••••-••••-••••-••••-••••••••••••';
  if (uuid.length < 8) return '••••••••';
  return `${uuid.slice(0, 4)}••••-••••-••••-••••••••${uuid.slice(-4)}`;
}
