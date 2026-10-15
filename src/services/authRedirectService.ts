import { supabase } from '../supabaseClient';

export interface AuthFeedback {
  error: string | null;
  isVerified: boolean;
}

/**
 * Resolves the exact application base URL for auth redirects.
 * Automatically handles GitHub Pages repo subpath, local development port, or custom domains.
 */
export function getAuthRedirectUrl(): string {
  if (typeof window === 'undefined') return '';

  const origin = window.location.origin;
  let pathname = window.location.pathname;

  // Strip trailing filenames like index.html or 404.html if present
  pathname = pathname.replace(/\/[^/]+\.[^/]+$/, '');

  // Ensure trailing slash for SPA directory base
  if (!pathname.endsWith('/')) {
    pathname += '/';
  }

  return `${origin}${pathname}`;
}

/**
 * Inspects query params and hash fragments to detect Supabase auth feedback:
 * - Errors (such as expired or invalid OTP links)
 * - Successful email confirmation or token grants
 */
export function parseAuthFeedbackFromUrl(): AuthFeedback {
  if (typeof window === 'undefined') {
    return { error: null, isVerified: false };
  }

  const url = new URL(window.location.href);
  const searchParams = url.searchParams;

  // Supabase can deliver payload in hash (#access_token=... or #error=...)
  const rawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(rawHash);

  // Check for error parameters in search or hash
  const errorParam = searchParams.get('error') || hashParams.get('error');
  const errorDesc = searchParams.get('error_description') || hashParams.get('error_description');

  if (errorParam || errorDesc) {
    let cleanMessage = errorDesc
      ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
      : 'Authentication failed or verification link expired.';

    // Provide friendly wording for standard error patterns
    if (/otp_expired|expired/i.test(errorParam || '') || /expired/i.test(cleanMessage)) {
      cleanMessage = 'Your email verification link has expired. Please request a new verification link below.';
    } else if (/invalid/i.test(cleanMessage)) {
      cleanMessage = 'This verification link is invalid or has already been used. Please log in or request a new link.';
    }

    return { error: cleanMessage, isVerified: false };
  }

  // Detect verification indicators
  const type = searchParams.get('type') || hashParams.get('type');
  const hasAccessToken = hashParams.has('access_token');
  const hasCode = searchParams.has('code');

  const isVerified = type === 'signup' || type === 'email_confirmation' || hasAccessToken || hasCode;

  return { error: null, isVerified };
}

/**
 * Cleans ugly auth parameters (?code=..., #access_token=..., #error=...)
 * from the browser address bar without triggering a page reload.
 */
export function cleanAuthUrl(): void {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    let changed = false;

    const authQueryParams = ['code', 'error', 'error_code', 'error_description', 'type'];
    for (const param of authQueryParams) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    }

    if (url.hash) {
      // Preserve application routing hashes like #admin
      if (url.hash.includes('admin')) {
        url.hash = '#admin';
        changed = true;
      } else if (
        url.hash.includes('access_token') ||
        url.hash.includes('error') ||
        url.hash.includes('refresh_token')
      ) {
        url.hash = '';
        changed = true;
      }
    }

    if (changed) {
      const cleanPath = url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
      window.history.replaceState(null, '', cleanPath);
    }
  } catch (e) {
    console.warn('Could not clean auth URL:', e);
  }
}

/**
 * Resends the signup confirmation email with the explicit redirect URL attached.
 */
export async function resendVerificationEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const redirectUrl = getAuthRedirectUrl();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to resend verification email';
    return { success: false, error: msg };
  }
}
